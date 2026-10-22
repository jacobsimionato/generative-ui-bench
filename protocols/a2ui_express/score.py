#!/usr/bin/env python
import json
import os
import re
import sys

from a2ui.core import Catalog
from a2ui.inference_formats.express.parser import ExpressParser

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(HERE, "../a2ui/catalog-a2ui.json")


def score(raw_text):
  result = {
      "parse_ok": False,
      "components_total": 0,
      "component_ids": [],
      "root_present": False,
      "dangling_refs": [],
      "orphaned_ids": [],
      "messages": [],
      "errors": [],
  }
  try:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
      cat = Catalog.from_json(json.load(f))
    parser = ExpressParser(catalogs=[cat], surface_id="main")

    parts = parser.parse_response(raw_text)
    messages = []
    components = []
    for p in parts:
      if hasattr(p, "a2ui"):
        for m in p.a2ui:
          m_dict = m.model_dump(exclude_none=True, by_alias=True)
          messages.append(m_dict)
          if "updateComponents" in m_dict:
            components.extend(m_dict["updateComponents"].get("components", []))

    comp_ids = [c["id"] for c in components if "id" in c]

    # If 'root' is not in comp_ids, check if 'root = <target>' was assigned
    if "root" not in comp_ids:
      m_alias = re.search(r"^\s*root\s*=\s*([a-zA-Z0-9_]+)\s*$", raw_text, re.M)
      if m_alias:
        target = m_alias.group(1)
        for c in components:
          if c.get("id") == target:
            c["id"] = "root"
            break
        comp_ids = [c["id"] for c in components if "id" in c]

    root_present = "root" in comp_ids

    # Find children / references
    referenced_ids = set()
    child_map = {}
    for c in components:
      cid = c.get("id")
      refs = []
      children = c.get("children", [])
      if isinstance(children, list):
        for ch in children:
          if isinstance(ch, str):
            refs.append(ch)
      for k, v in c.items():
        if k in ("id", "component", "children"):
          continue
        if isinstance(v, str) and v in comp_ids:
          refs.append(v)
        elif isinstance(v, list):
          for item in v:
            if isinstance(item, str) and item in comp_ids:
              refs.append(item)
      if cid:
        child_map[cid] = refs
      referenced_ids.update(refs)

    dangling = [r for r in referenced_ids if r not in comp_ids]

    # Reachability from root
    reached = set()
    if root_present:
      queue = ["root"]
      while queue:
        curr = queue.pop(0)
        if curr in reached:
          continue
        reached.add(curr)
        for child in child_map.get(curr, []):
          if child in comp_ids and child not in reached:
            queue.append(child)

    orphaned = [cid for cid in comp_ids if cid not in reached]

    result["parse_ok"] = len(components) > 0
    result["components_total"] = len(components)
    result["component_ids"] = comp_ids
    result["root_present"] = root_present
    result["dangling_refs"] = dangling
    result["orphaned_ids"] = orphaned if root_present else []
    result["messages"] = messages
  except Exception as e:
    result["errors"].append(str(e))

  return result


if __name__ == "__main__":
  file_path = sys.argv[1] if len(sys.argv) > 1 else "/dev/stdin"
  with open(file_path, "r", encoding="utf-8") as f:
    res = score(f.read())
  print(json.dumps(res))
