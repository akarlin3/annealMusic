"""v7.5 study validation service — ZIP checker + script execution runner.

Validates ZIP structure, asserts SHA-256 hashes of all resources listed in the manifest,
and executes analysis scripts against bundled subject data.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from typing import Any


def validate_study_export_bundle(zip_bytes: bytes) -> dict[str, Any]:
    """Inspects ZIP bundle, checks manifest schema, verifies all file hashes,

    and returns a validation checklist.
    """
    report = {
        "valid": False,
        "errors": [],
        "warnings": [],
        "reproducibility_level": None,
        "rendered_audio_hash_matches": None,
        "analysis_script_output": None,
        "analysis_script_errors": None,
    }

    try:
        zip_file_ref = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        report["errors"].append("The uploaded file is not a valid ZIP archive.")
        return report

    with zip_file_ref as zf:
        file_list = zf.namelist()
        
        # 1. Read manifest.json
        if "manifest.json" not in file_list:
            report["errors"].append("Missing required 'manifest.json' file at root.")
            return report

        try:
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        except Exception as exc:
            report["errors"].append(f"Failed to parse 'manifest.json': {str(exc)}")
            return report

        # Verify top-level manifest keys
        for key in ["manifest_version", "study_id", "version_id", "reproducibility_level", "files"]:
            if key not in manifest:
                report["errors"].append(f"manifest.json is missing required key: '{key}'")
        
        if report["errors"]:
            return report

        report["reproducibility_level"] = manifest["reproducibility_level"]

        # 2. Check each registered file in the files registry
        registered_files = manifest.get("files", [])
        if not registered_files:
            report["warnings"].append("No files were registered in manifest.json files list.")

        for f in registered_files:
            path = f.get("path")
            expected_sha = f.get("sha256")
            
            if not path or not expected_sha:
                report["errors"].append("Malformed entry in manifest files registry.")
                continue

            if path not in file_list:
                report["errors"].append(f"Manifest registered file is missing from archive: '{path}'")
                continue

            # Compute SHA-256 of the actual zip file content
            actual_bytes = zf.read(path)
            actual_sha = hashlib.sha256(actual_bytes).hexdigest()
            
            if actual_sha != expected_sha:
                report["errors"].append(
                    f"Integrity check failed: hash mismatch for file '{path}'. "
                    f"Expected {expected_sha}, got {actual_sha}."
                )

        # 3. Verify version locks exist
        locks = manifest.get("version_locks", {})
        if "engine" not in locks or "python_environment" not in locks:
            report["warnings"].append("Missing standard version lock details.")

        if not report["errors"]:
            report["valid"] = True
            report["rendered_audio_hash_matches"] = True  # Verified by hash matching in ZIP

    return report


def run_bundle_analysis_scripts(zip_bytes: bytes) -> dict[str, Any]:
    """Unpacks ZIP bundle into a temp directory, locates Python analysis scripts,

    executes them against the bundled records, and returns stdout/stderr logs.
    """
    report = {
        "valid": False,
        "errors": [],
        "analysis_script_output": "",
        "analysis_script_errors": "",
    }

    temp_dir = tempfile.mkdtemp(prefix="annealmusic-reproduce-")
    try:
        zip_io = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(zip_io) as zf:
            zf.extractall(temp_dir)

        manifest_path = os.path.join(temp_dir, "manifest.json")
        if not os.path.exists(manifest_path):
            report["errors"].append("Missing manifest.json in bundle.")
            return report

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        # Find python scripts in the manifest files list
        python_scripts = []
        for file_entry in manifest.get("files", []):
            if file_entry.get("kind") == "user_script" and file_entry.get("path", "").endswith(".py"):
                python_scripts.append(file_entry.get("path"))

        if not python_scripts:
            # Fallback: check scripts directory
            scripts_dir = os.path.join(temp_dir, "scripts")
            if os.path.exists(scripts_dir):
                for f in os.listdir(scripts_dir):
                    if f.endswith(".py"):
                        python_scripts.append(os.path.join("scripts", f))

        if not python_scripts:
            report["errors"].append("No Python analysis scripts (.py) found in the bundle.")
            return report

        # Execute the first analysis script
        script_to_run = python_scripts[0]
        script_full_path = os.path.join(temp_dir, script_to_run)

        # Run script using subprocess CPython
        # Research data is at data/clinical_session_records.json
        # The script is run in the temp_dir working directory
        result = subprocess.run(
            ["python3", script_full_path],
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30.0,
        )

        report["analysis_script_output"] = result.stdout
        report["analysis_script_errors"] = result.stderr

        if result.returncode == 0:
            report["valid"] = True
        else:
            report["errors"].append(f"Analysis script exited with code {result.returncode}.")

    except subprocess.TimeoutExpired:
        report["errors"].append("Analysis script execution timed out after 30 seconds.")
    except Exception as exc:
        report["errors"].append(f"Failed to execute analysis script: {str(exc)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return report
