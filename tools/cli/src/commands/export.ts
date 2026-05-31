/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs';

export async function runExportCommand(
  studyId: string,
  options: { output?: string; includeData?: boolean },
) {
  const apiUrl = process.env.ANNEALMUSIC_API_URL || 'http://localhost:8000';
  const outPath = options.output || `${studyId}.zip`;
  const includeData = !!options.includeData;

  console.log(`Exporting study ${studyId}...`);
  console.log(`- API URL: ${apiUrl}`);
  console.log(`- Include Subject Data: ${includeData}`);

  try {
    // 1. Fetch study versions to find the latest snapshot
    const versionsRes = await fetch(
      `${apiUrl}/api/v1/studies/${studyId}/versions`,
    );
    if (!versionsRes.ok) {
      throw new Error(
        `Failed to list study versions: ${await versionsRes.text()}`,
      );
    }
    const { items } = (await versionsRes.json()) as {
      items: { id: string; version_label: string }[];
    };
    if (items.length === 0) {
      throw new Error(
        `No snapshot versions found for study ${studyId}. Please create a snapshot first.`,
      );
    }

    // Use the latest version for CLI export
    const versionId = items[0].id;
    const versionLabel = items[0].version_label;
    console.log(`- Target Version: ${versionLabel} (${versionId})`);

    // 2. Trigger study export
    const exportRes = await fetch(
      `${apiUrl}/api/v1/studies/${studyId}/export`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: versionId,
          reproducibility_level: 'bytes-identical',
          includes_subject_data: includeData,
          pi_attestation: includeData,
        }),
      },
    );

    if (!exportRes.ok) {
      throw new Error(`Export request failed: ${await exportRes.text()}`);
    }

    const exportMeta = (await exportRes.json()) as { id: string };
    const exportId = exportMeta.id;
    console.log(`- Export ID: ${exportId}`);

    // 3. Download study export ZIP bundle
    console.log(`Downloading bundle...`);
    const dlRes = await fetch(
      `${apiUrl}/api/v1/study-exports/${exportId}/download`,
    );
    if (!dlRes.ok) {
      throw new Error(`Download failed: ${await dlRes.text()}`);
    }

    const buffer = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(outPath, buffer);
    console.log(
      `✅ Study export bundle saved to: ${outPath} (${buffer.length} bytes)`,
    );
  } catch (err: any) {
    console.error(`❌ Export failed: ${err.message}`);
    process.exit(1);
  }
}
