#!/usr/bin/env python
"""Generates the A2UI Direct JSON benchmark system prompt with official SDK.

Usage:
  python prompt.py [--stdout]
"""
import json
import os
import sys

from a2ui.core import Catalog
from a2ui.inference_formats.direct_json import DirectJsonFormat

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(HERE, "catalog-a2ui.json")
PROMPT_PATH = os.path.join(HERE, "system-prompt.txt")


def generate_prompt(catalog_path=CATALOG_PATH):
  with open(catalog_path, "r", encoding="utf-8") as f:
    cat_dict = json.load(f)
  cat = Catalog.from_json(cat_dict)
  fmt = DirectJsonFormat(catalogs=[cat])
  return fmt.prompt_generator.generate()


def main():
  prompt = generate_prompt()
  if len(sys.argv) > 1 and sys.argv[1] == "--stdout":
    sys.stdout.write(prompt)
    return
  with open(PROMPT_PATH, "w", encoding="utf-8") as f:
    f.write(prompt)
  print(f"wrote {PROMPT_PATH} ({len(prompt)} chars)")


if __name__ == "__main__":
  main()
