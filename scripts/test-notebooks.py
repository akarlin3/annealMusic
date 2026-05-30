#!/usr/bin/env python3
import os
import json
import sys

def test_notebook(filepath):
    print(f"[TEST] Executing notebook: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    # Check for scientific dependencies, bypass cleanly on local machines if missing
    try:
        import numpy
        import pandas
        import scipy
        import matplotlib
        matplotlib.use('Agg') # Set non-interactive backend
    except ImportError as e:
        if os.environ.get('CI') == 'true':
            print(f"[FATAL] Missing scientific dependencies in CI: {e}")
            return False
        else:
            print(f"[WARNING] Missing scientific dependencies locally ({e}). Skipping headless notebook verification.")
            return True
    
    # Context dictionary to persist state across cell executions
    glob = {
        '__name__': '__main__',
    }
    
    cells = nb.get('cells', [])
    for idx, cell in enumerate(cells):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            if not source.strip():
                continue
            
            try:
                # Compile and execute the cell code
                exec(source, glob)
            except Exception as e:
                print(f"[ERROR] Cell execution failed at index {idx} in {filepath}!")
                print("--- Code ---")
                print(source)
                print("--- Error ---")
                import traceback
                traceback.print_exc()
                return False
    print(f"[SUCCESS] Completed {filepath} with no errors.")
    return True

def main():
    notebooks_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'examples', 'notebooks')
    if not os.path.exists(notebooks_dir):
        print(f"[WARNING] Notebooks directory not found at: {notebooks_dir}")
        sys.exit(0)
    
    files = [os.path.join(notebooks_dir, f) for f in os.listdir(notebooks_dir) if f.endswith('.ipynb')]
    if not files:
        print("[INFO] No notebooks found to test.")
        sys.exit(0)
    
    success = True
    for f in files:
        if not test_notebook(f):
            success = False
            
    if not success:
        print("[FAIL] One or more notebooks failed verification!")
        sys.exit(1)
    else:
        print("[PASS] All notebooks verified successfully.")
        sys.exit(0)

if __name__ == '__main__':
    main()
