"""
Robust extractor for the user-provided keneya JSON file (which has formatting issues:
- Missing commas between objects
- Trailing commas inside objects
- Multiple top-level arrays concatenated
- Stray array closers at the end
- Mixed concatenated array opens [ [

Strategy: scan character-by-character for balanced `{...}` blocks (top-level only), then
JSON-decode each candidate after a cleanup of trailing commas.
"""
import json
import re
import sys
from pathlib import Path


def extract_objects(raw: str) -> list:
    """Return a list of dicts found in the raw text by balanced-brace scanning."""
    objects = []
    depth = 0
    start = None
    in_string = False
    escape = False
    for i, ch in enumerate(raw):
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                block = raw[start:i + 1]
                # Clean trailing commas
                cleaned = re.sub(r',(\s*[}\]])', r'\1', block)
                try:
                    obj = json.loads(cleaned)
                    if isinstance(obj, dict):
                        objects.append(obj)
                except json.JSONDecodeError:
                    pass
                start = None
    return objects


if __name__ == "__main__":
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/keneya_import.json")
    raw = src.read_text(encoding="utf-8")
    records = extract_objects(raw)
    print(f"Extracted {len(records)} dict records")
    from collections import Counter
    print("Types:", Counter(r.get("user_type", "?") for r in records))
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/keneya_import_fixed.json")
    out.write_text(json.dumps(records, ensure_ascii=False, indent=2))
    print(f"Saved {out}")
