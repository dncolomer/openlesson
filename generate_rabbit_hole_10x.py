#!/usr/bin/env python3
"""
10x Rabbit Hole Questions Generator
Strictly follows the world-class "Rabbit Hole" designer style rules.

Usage:
    python3 generate_rabbit_hole_10x.py --help
    python3 generate_rabbit_hole_10x.py --batch history 8
    python3 generate_rabbit_hole_10x.py --validate
"""

import csv
import sys
import argparse
from collections import defaultdict
from pathlib import Path
import re

# =============================================================================
# STRICT STYLE RULES (from user)
# =============================================================================
ALLOWED_HOOKS = [
    "What if", "But what if", "Why does", "Is it possible that",
    "Imagine accepting that", "Did humans", "If ", "Would you",
    "Does that", "Knowing that", "Every time you"
]

def is_valid_hook(text: str) -> bool:
    text = text.strip()
    for hook in ALLOWED_HOOKS:
        if text.startswith(hook):
            return True
    return False

def word_count(text: str) -> int:
    return len(re.findall(r'\b\w+\b', text))

def validate_question(text: str, min_w=15, max_w=35) -> tuple[bool, str]:
    wc = word_count(text)
    if wc < min_w or wc > max_w:
        return False, f"word count {wc} (must be {min_w}-{max_w})"
    if not is_valid_hook(text):
        return False, "does not start with allowed hook"
    if "lorem" in text.lower() or "todo" in text.lower() or "placeholder" in text.lower():
        return False, "contains placeholder text"
    return True, "ok"

# =============================================================================
# CSV HELPERS
# =============================================================================
COLUMNS = ["id", "discipline", "top_id", "top_question", "q_id", "depth",
           "question_text", "branch_type", "parent_q_id", "keywords",
           "expansion_note", "grok_trigger"]

def load_existing(path: Path):
    if not path.exists():
        return [], 0, set()
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    max_id = max(int(r["id"]) for r in rows) if rows else 0
    existing_tops = {(r["discipline"], r["top_question"]) for r in rows if r["branch_type"] == "Top"}
    return rows, max_id, existing_tops

def write_csv(path: Path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

# =============================================================================
# GENERATION HELPERS (to be called by human or future LLM batch)
# =============================================================================
def new_row(**kwargs):
    row = {k: "" for k in COLUMNS}
    row.update(kwargs)
    return row

def make_grok_trigger(path_keywords: list[str]) -> str:
    keywords = " + ".join(path_keywords)
    return f"Path taken: {keywords}. Grok, generate the ultimate new mind-bender from here…"

def validate_tree(rows_in_tree):
    """Basic structural validation for a list of rows belonging to one tree."""
    errors = []
    for r in rows_in_tree:
        if r["branch_type"] != "Top":
            wc_ok, msg = validate_question(r["question_text"])
            if not wc_ok:
                errors.append(f"q_id={r['q_id']}: {msg}")
    return errors

# =============================================================================
# MAIN
# =============================================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="rabbit-hole-questions-expanded.csv")
    parser.add_argument("--output", default="rabbit-hole-questions-10x.csv")
    parser.add_argument("--batch", help="Generate a batch for a discipline (e.g. history 5)")
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    existing_rows, max_id, existing_tops = load_existing(input_path)
    print(f"Loaded {len(existing_rows)} rows from {input_path}")
    print(f"Next id will be {max_id + 1}")

    if args.validate:
        bad = 0
        for r in existing_rows:
            if r["branch_type"] != "Top":
                ok, msg = validate_question(r["question_text"])
                if not ok:
                    print(f"BAD row id={r['id']}: {msg} | {r['question_text'][:80]}...")
                    bad += 1
        print(f"Validation complete. Bad non-Top questions: {bad}")
        return

    if args.batch:
        print("Batch generation mode is intended to be driven by the human + LLM.")
        print("Example: python3 generate_rabbit_hole_10x.py --batch 'History 6'")
        print("Then paste the generated rows into the script or a temp file and re-run with --append-batch")
        return

    print("\nNo action specified. Use --batch or --validate")
    print("Current Top counts:")
    tops = [r for r in existing_rows if r["branch_type"] == "Top"]
    from collections import Counter
    print(Counter(r["discipline"] for r in tops))

if __name__ == "__main__":
    main()
