import sys
import json
import os

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is not installed. Please install it using: pip install pandas")
    sys.exit(1)

def convert(input_path, output_path, output_format):
    if not os.path.exists(input_path):
        print(f"ERROR: Input file does not exist: {input_path}")
        sys.exit(1)

    records = []
    header = None
    footer = None
    
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                if obj.get('type') == 'header':
                    header = obj
                elif obj.get('type') == 'footer':
                    footer = obj
                else:
                    records.append(obj)
            except Exception as e:
                print(f"WARNING: Skipping malformed line in JSONL: {e}")
                
    if not records:
        print("ERROR: No session records found in the JSONL log file.")
        sys.exit(1)

    # Convert to flat pandas DataFrame
    df = pd.json_normalize(records)
    
    # Standardize column mappings to match native CSV dot-notation
    # pd.json_normalize uses dot notation by default, which is perfect!

    output_format = output_format.lower()
    
    if output_format == 'csv':
        df.to_csv(output_path, index=False)
        print(f"SUCCESS: Converted {len(records)} ticks to CSV: {output_path}")
    elif output_format == 'parquet':
        try:
            # Convert nested list/dict columns to json string or pyarrow compatible type
            for col in df.columns:
                if df[col].apply(lambda x: isinstance(x, (list, dict))).any():
                    df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (list, dict)) else x)
            df.to_parquet(output_path, index=False, engine='pyarrow')
            print(f"SUCCESS: Converted {len(records)} ticks to Parquet: {output_path}")
        except ImportError:
            print("ERROR: pyarrow or fastparquet is required for Parquet export. Please install it: pip install pyarrow")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: Parquet export failed: {e}")
            sys.exit(1)
    elif output_format in ['hdf5', 'h5']:
        try:
            # HDF5 table format doesn't support complex objects, serialize them to strings
            for col in df.columns:
                if df[col].apply(lambda x: isinstance(x, (list, dict))).any():
                    df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (list, dict)) else x)
            df.to_hdf(output_path, key='datalog', mode='w', format='table')
            print(f"SUCCESS: Converted {len(records)} ticks to HDF5: {output_path}")
        except ImportError:
            print("ERROR: tables (PyTables) is required for HDF5 export. Please install it: pip install tables")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: HDF5 export failed: {e}")
            sys.exit(1)
    else:
        print(f"ERROR: Unsupported export format: {output_format}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python converter.py <input_jsonl> <output_file> <format>")
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2], sys.argv[3])
