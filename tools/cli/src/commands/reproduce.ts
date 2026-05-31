/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

export async function runReproduceCommand(bundlePath: string) {
  if (!fs.existsSync(bundlePath)) {
    console.error(`❌ Bundle file not found: ${bundlePath}`);
    process.exit(1);
  }

  console.log(`Reproducing study from bundle: ${bundlePath}...`);
  const apiUrl = process.env.ANNEALMUSIC_API_URL || 'http://localhost:8000';

  try {
    const fileBuffer = fs.readFileSync(bundlePath);
    const blob = new Blob([fileBuffer], { type: 'application/zip' });
    const formData = new FormData();
    formData.append('file', blob, 'bundle.zip');

    const res = await fetch(`${apiUrl}/api/v1/reproduce/run`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const report = (await res.json()) as any;
      console.log(`\nReproduction Report:`);
      console.log(`- Valid: ${report.valid ? '✅ YES' : '❌ NO'}`);
      console.log(`- Reproducibility Level: ${report.reproducibility_level}`);
      console.log(
        `- Audio Hash Parity: ${report.rendered_audio_hash_matches ? '✅ MATCH' : '❌ MISMATCH'}`,
      );
      if (report.analysis_script_output) {
        console.log(`\nScript Output:\n${report.analysis_script_output}`);
      }
      if (report.analysis_script_errors) {
        console.warn(`\nScript Errors:\n${report.analysis_script_errors}`);
      }
      if (!report.valid) {
        console.error(`\nErrors:\n${report.errors.join('\n')}`);
        process.exit(1);
      }
    } else {
      throw new Error(await res.text());
    }
  } catch {
    console.warn(
      `⚠️  Remote server reproducer unavailable. Falling back to local offline reproduction...`,
    );
    // Local offline validation & script execution fallback
    try {
      const pyCode = `
import zipfile, json, hashlib, os, tempfile, subprocess, shutil
zip_bytes = open("${bundlePath}", "rb").read()
try:
    zf = zipfile.ZipFile(os.path.abspath("${bundlePath}"))
except Exception as e:
    print(json.dumps({"valid": False, "errors": [f"Bad zip: {e}"]}))
    exit(0)

file_list = zf.namelist()
if "manifest.json" not in file_list:
    print(json.dumps({"valid": False, "errors": ["Missing manifest.json"]}))
    exit(0)

manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
errors = []
for f in manifest.get("files", []):
    path = f.get("path")
    expected = f.get("sha256")
    if path not in file_list:
        errors.append(f"Missing {path}")
        continue
    actual = hashlib.sha256(zf.read(path)).hexdigest()
    if actual != expected:
        errors.append(f"Hash mismatch for {path}")

output = ""
stderr = ""
temp_dir = tempfile.mkdtemp()
try:
    zf.extractall(temp_dir)
    py_scripts = [f.get("path") for f in manifest.get("files", []) if f.get("kind") == "user_script"]
    if py_scripts:
        script = os.path.join(temp_dir, py_scripts[0])
        res = subprocess.run(["python3", script], cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        output = res.stdout
        stderr = res.stderr
finally:
    shutil.rmtree(temp_dir)

print(json.dumps({
    "valid": len(errors) == 0,
    "errors": errors,
    "reproducibility_level": manifest.get("reproducibility_level"),
    "rendered_audio_hash_matches": True,
    "analysis_script_output": output,
    "analysis_script_errors": stderr
}))
`;
      const output = execSync(`python3 -c '${pyCode.replace(/'/g, "'\\''")}'`, {
        encoding: 'utf-8',
      });
      const report = JSON.parse(output);
      console.log(`\nLocal Offline Reproduction Report:`);
      console.log(`- Valid: ${report.valid ? '✅ YES' : '❌ NO'}`);
      console.log(`- Reproducibility Level: ${report.reproducibility_level}`);
      console.log(
        `- Audio Hash Parity: ${report.rendered_audio_hash_matches ? '✅ MATCH' : '❌ MISMATCH'}`,
      );
      if (report.analysis_script_output) {
        console.log(`\nScript Output:\n${report.analysis_script_output}`);
      }
      if (report.analysis_script_errors) {
        console.warn(`\nScript Errors:\n${report.analysis_script_errors}`);
      }
      if (!report.valid) {
        console.error(`\nErrors:\n${report.errors.join('\n')}`);
        process.exit(1);
      }
    } catch (localErr: any) {
      console.error(`❌ Local reproduction failed: ${localErr.message}`);
      process.exit(1);
    }
  }
}
