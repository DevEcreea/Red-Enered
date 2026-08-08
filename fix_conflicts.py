import os
import re
from pathlib import Path

def fix_conflicts_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if '<<<<<<<' not in content:
            return False
            
        # Pattern to match:
        # <<<<<<< HEAD (or any commit)
        # [local changes]
        # =======
        # [incoming changes]
        # >>>>>>> [commit hash]
        
        # Regex to capture just the HEAD part
        pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> [^\n]+\n', re.DOTALL)
        
        new_content, count = pattern.subn(r'\1\n', content)
        
        # In case the marker didn't match the regex exactly, try a broader one
        if count == 0:
            pattern2 = re.compile(r'<<<<<<<.*?\n(.*?)\n=======\n.*?\n>>>>>>>.*?\n', re.DOTALL)
            new_content, count = pattern2.subn(r'\1\n', content)
            
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed {count} conflicts in {filepath}")
            return True
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
    return False

def main():
    root_dir = Path(r"C:\Users\ceoem\Downloads\Red-Enered-main (2)\Red-Enered")
    
    # Process all JS/JSX/PY files
    for ext in ['*.js', '*.jsx', '*.py']:
        for filepath in root_dir.rglob(ext):
            if 'node_modules' in str(filepath) or '.venv' in str(filepath):
                continue
            fix_conflicts_in_file(filepath)

if __name__ == '__main__':
    main()
