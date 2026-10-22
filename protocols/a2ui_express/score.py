#!/usr/bin/env python
"""Scores one raw model output using official A2UI SDK methods.

Validation phases:
1. Parsing: ExpressParser.parse_response (parses DSL, validates AST grammar & catalog signatures)
2. State & Topology: MessageProcessor.process_messages & SurfaceComponentsModel.validate_topology
   (validates root presence, reference integrity, orphans, cycles, depth limits)
"""
import json
import os
import sys

from a2ui.core import Catalog
from a2ui.core.processing.message_processor import MessageProcessor
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

    # Step 1: SDK Express Parser
    parts = parser.parse_response(raw_text)
    messages = []
    for p in parts:
      if hasattr(p, "a2ui"):
        for m in p.a2ui:
          m_dict = m.model_dump(exclude_none=True, by_alias=True)
          messages.append(m_dict)

    if not messages:
      result["errors"].append("No valid A2UI message envelopes parsed")
      return result

    # Step 2: SDK MessageProcessor & Surface Topology Validation
    processor = MessageProcessor(catalogs=[cat])
    processor.process_messages(messages)

    all_components = []
    root_found = False

    if processor.model and hasattr(processor.model, "surfaces"):
      for surface_id, surface in processor.model.surfaces.items():
        comp_model = surface.components_model
        all_components.extend(list(comp_model.values))
        if surface.root_id and comp_model.has(surface.root_id):
          root_found = True

        # Run official SDK structural topology verification
        try:
          comp_model.validate_topology()
        except Exception as top_err:
          result["errors"].append(f"Topology error ({surface_id}): {top_err}")

    result["messages"] = messages
    result["components_total"] = len(all_components)
    result["component_ids"] = [
        getattr(c, "id", None)
        if hasattr(c, "id")
        else (c.get("id") if isinstance(c, dict) else None)
        for c in all_components
    ]
    result["root_present"] = root_found
    result["parse_ok"] = len(all_components) > 0 and len(result["errors"]) == 0

  except Exception as e:
    result["errors"].append(str(e))

  return result


if __name__ == "__main__":
  file_path = sys.argv[1] if len(sys.argv) > 1 else "/dev/stdin"
  with open(file_path, "r", encoding="utf-8") as f:
    res = score(f.read())
  print(json.dumps(res))
