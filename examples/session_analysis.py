#!/usr/bin/env python3
"""
AnnealMusic v5.3 · Session Datalog Analysis Recipe
Starter Python script demonstrating how to ingest, clean, and visualize datalogs.

Dependencies:
    pip install pandas numpy matplotlib
"""

import os
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def load_and_analyze(log_path):
    if not os.path.exists(log_path):
        print(f"Error: Log file not found at {log_path}")
        print("Please render a patch with logging or download a log in-app first.")
        return

    print(f"Reading datalog: {log_path}")

    # 1. Read JSONL line-by-line to extract header/footer metadata
    records = []
    header = None
    footer = None

    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            obj = json.loads(line)
            if obj.get('type') == 'header':
                header = obj
            elif obj.get('type') == 'footer':
                footer = obj
            else:
                records.append(obj)

    print("\n--- Session Metadata ---")
    if header:
        print(f"  App Version:        {header.get('appVersion')}")
        print(f"  Logging Mode:       {header.get('mode').upper()}")
        print(f"  Sample Rate:        {header.get('rateHz')} Hz")
        print(f"  Session Start:      {header.get('startTime')}")
    print(f"  Ticks Logged:       {len(records)}")
    if footer:
        print(f"  Session End:        {footer.get('endTime')}")

    # 2. Convert records to a flat Pandas DataFrame
    df = pd.json_normalize(records)
    print("\n--- Columns Discovered ---")
    for col in sorted(df.columns):
        print(f"  - {col}")

    # 3. Perform basic descriptive statistics
    print("\n--- Acoustical Feature Summary ---")
    features = ['features.rms', 'features.spectralCentroid', 'features.zcr', 'drift.orderParameter']
    available_features = [f for f in features if f in df.columns]
    if available_features:
        print(df[available_features].describe())

    # 4. Generate Plot Grid
    plt.figure(figsize=(12, 8))
    plt.suptitle("AnnealMusic Generative Session Data Visualizer", fontsize=14, fontweight='bold')

    # Subplot 1: Order Parameter & Coupling
    plt.subplot(2, 2, 1)
    if 'drift.orderParameter' in df.columns:
        plt.plot(df['timestamp'], df['drift.orderParameter'], color='#a855f7', lw=1.5, label='Phase Coherence r(t)')
    if 'params.coupling' in df.columns:
        plt.plot(df['timestamp'], df['params.coupling'], color='#3b82f6', lw=1.0, ls='--', label='Coupling (K)')
    plt.title("Synchronization Coherence (Kuramoto model)")
    plt.xlabel("Time (s)")
    plt.ylabel("Coherence index [0..1]")
    plt.grid(True, alpha=0.3)
    plt.legend()

    # Subplot 2: Carrier Pitch & Detunes
    plt.subplot(2, 2, 2)
    if 'params.rootFreq' in df.columns:
        plt.plot(df['timestamp'], df['params.rootFreq'], color='#f59e0b', lw=2.0, label='Root carrier pitch (Hz)')
    plt.title("Carrier Pitch Trajectory")
    plt.xlabel("Time (s)")
    plt.ylabel("Frequency (Hz)")
    plt.grid(True, alpha=0.3)
    plt.legend()

    # Subplot 3: ZCR & RMS
    plt.subplot(2, 2, 3)
    if 'features.rms' in df.columns:
        plt.plot(df['timestamp'], df['features.rms'], color='#10b981', lw=1.5, label='RMS Volume')
    if 'features.zcr' in df.columns:
        plt.plot(df['timestamp'], df['features.zcr'], color='#ef4444', lw=1.0, label='ZCR (noise indicator)')
    plt.title("Acoustical Audio Features")
    plt.xlabel("Time (s)")
    plt.ylabel("Amplitude")
    plt.grid(True, alpha=0.3)
    plt.legend()

    # Subplot 4: Spectral Centroid vs. Brightness
    plt.subplot(2, 2, 4)
    if 'features.spectralCentroid' in df.columns:
        plt.plot(df['timestamp'], df['features.spectralCentroid'], color='#6366f1', lw=1.5, label='Spectral Centroid (Hz)')
        plt.title("Spectral Centroid (Brightness indicator)")
        plt.ylabel("Centroid Frequency (Hz)")
    else:
        plt.text(0.5, 0.5, "Centroid data unavailable", ha='center', va='center')
    plt.xlabel("Time (s)")
    plt.grid(True, alpha=0.3)
    plt.legend()

    plt.tight_layout()
    output_img = "session_analysis_plot.png"
    plt.savefig(output_img, dpi=300)
    print(f"\n🎉 Visualization saved successfully to: {output_img}")
    plt.show()

if __name__ == '__main__':
    # Default search for any jsonl log files in workspace
    log_files = [f for f in os.listdir('.') if f.endswith('.jsonl')]
    if log_files:
        load_and_analyze(log_files[0])
    else:
        print("No log files found in current directory. Usage: python session_analysis.py <path_to_log.jsonl>")
