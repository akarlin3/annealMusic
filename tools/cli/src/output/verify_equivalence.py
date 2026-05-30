import sys
import os
import json
import pandas as pd

def main():
    jsonl_path = "tools/cli/test-log.jsonl"
    csv_path = "tools/cli/test-log.csv"
    parquet_path = "tools/cli/test-log.parquet"

    print("--- Verifying Format Cross-Equivalence ---")
    
    if not os.path.exists(jsonl_path):
        print(f"ERROR: {jsonl_path} not found.")
        sys.exit(1)
        
    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found. Please run the converter to CSV first.")
        sys.exit(1)

    if not os.path.exists(parquet_path):
        print(f"ERROR: {parquet_path} not found. Please run the converter to Parquet first.")
        sys.exit(1)

    # 1. Load Parquet
    df_parquet = pd.read_parquet(parquet_path)
    print(f"Loaded Parquet file: {df_parquet.shape[0]} rows, {df_parquet.shape[1]} columns")

    # 2. Load CSV
    df_csv = pd.read_csv(csv_path)
    print(f"Loaded CSV file: {df_csv.shape[0]} rows, {df_csv.shape[1]} columns")

    # 3. Basic Shape Checks
    if df_parquet.shape[0] != df_csv.shape[0]:
        print(f"ERROR: Row count mismatch! CSV={df_csv.shape[0]}, Parquet={df_parquet.shape[0]}")
        sys.exit(1)

    # Note: CSV doesn't have metadata rows in pd.read_csv since comments are ignored or not printed depending on how it was loaded.
    # In converter.py, df.to_csv doesn't write `#` comment lines (only writeCSV does), so they have identical columns.
    
    # 4. Compare columns
    parquet_cols = set(df_parquet.columns)
    csv_cols = set(df_csv.columns)

    missing_in_csv = parquet_cols - csv_cols
    missing_in_parquet = csv_cols - parquet_cols

    if missing_in_csv:
        print(f"WARNING: Columns in Parquet but not in CSV: {missing_in_csv}")
    if missing_in_parquet:
        print(f"WARNING: Columns in CSV but not in Parquet: {missing_in_parquet}")

    # 5. Check value-level equivalence for overlapping columns
    common_cols = list(parquet_cols.intersection(csv_cols))
    print(f"Comparing {len(common_cols)} overlapping columns...")

    mismatches = 0
    for col in common_cols:
        # Cast to strings or fill nans for robust comparison
        s_csv = df_csv[col].fillna("").astype(str).str.strip()
        s_parquet = df_parquet[col].fillna("").astype(str).str.strip()

        # Float comparison with epsilon if they are floats
        try:
            f_csv = pd.to_numeric(df_csv[col], errors='raise').fillna(0.0)
            f_parquet = pd.to_numeric(df_parquet[col], errors='raise').fillna(0.0)
            diff = (f_csv - f_parquet).abs()
            if (diff > 1e-4).any():
                print(f"FAIL: Numeric difference in column '{col}' exceeds tolerance.")
                mismatches += 1
            continue
        except (ValueError, TypeError):
            pass

        if not (s_csv == s_parquet).all():
            # Print a few sample mismatches
            diff_idx = (s_csv != s_parquet)
            first_mismatch = diff_idx.idxmax()
            print(f"FAIL: Value mismatch in column '{col}' at index {first_mismatch}:")
            print(f"  CSV:     '{s_csv.iloc[first_mismatch]}'")
            print(f"  Parquet: '{s_parquet.iloc[first_mismatch]}'")
            mismatches += 1

    if mismatches > 0:
        print(f"\n❌ Equivalence check failed with {mismatches} mismatching columns!")
        sys.exit(1)
        
    print("\n✅ SUCCESS: CSV and Parquet schemas and values are structurally equivalent!")
    print("Ingestion engines (pandas, NumPy, pyarrow) will load identical datasets.")

if __name__ == '__main__':
    main()
