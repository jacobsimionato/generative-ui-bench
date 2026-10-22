import { parse } from "yaml";
import { CATALOG, REF_PROP_NAMES } from "./catalog.ts";

export type EvalError = { cls: string; detail: string };
export type EvalResult = { renderable: boolean; complete: boolean; n?: number; errs: EvalError[] };

function extractYaml(output: string): string {
  const match = output.match(/```(?:yaml-spec|yaml)?\s*\n([\s\S]*?)\n```/);
  if (match) return match[1];
  return output.trim();
}

export function evaluate(text: string, opts: { reqs?: number } = {}): EvalResult {
  const errs: EvalError[] = [];
  const out: EvalResult = { renderable: false, complete: false, errs };
  const done = (): EvalResult => {
    out.complete = out.renderable && errs.length === 0;
    const reqs = opts.reqs ?? 0;
    if (out.complete && Number.isFinite(out.n) && (out.n as number) < reqs) {
      errs.push({ cls: "coverage-floor", detail: `components ${out.n} < requirements ${reqs}` });
      out.complete = false;
    }
    return out;
  };

  const yamlText = extractYaml(text);
  if (!yamlText) {
    errs.push({ cls: "malformed-syntax", detail: "no YAML spec found" });
    return done();
  }

  let spec: any;
  try {
    spec = parse(yamlText);
  } catch (err: any) {
    errs.push({ cls: "malformed-syntax", detail: `yaml parse error: ${err.message.slice(0, 80)}` });
    return done();
  }

  if (!spec || typeof spec !== "object") {
    errs.push({ cls: "malformed-syntax", detail: "parsed spec is not an object" });
    return done();
  }

  if (!spec.root || typeof spec.root !== "string") {
    errs.push({ cls: "root-missing", detail: "spec has no /root" });
    return done();
  }
  if (!spec.elements || typeof spec.elements !== "object" || Object.keys(spec.elements).length === 0) {
    errs.push({ cls: "root-missing", detail: "spec has no elements" });
    return done();
  }
  if (!spec.elements[spec.root]) {
    errs.push({ cls: "reference-graph", detail: `dangling:root:${spec.root}` });
    return done();
  }
  if (!CATALOG[spec.elements[spec.root]?.type]) {
    errs.push({
      cls: "root-missing",
      detail: `root type unregistered: ${spec.elements[spec.root]?.type}`,
    });
    return done();
  }

  out.renderable = true;
  out.n = Object.keys(spec.elements).length;

  for (const [id, el] of Object.entries<any>(spec.elements)) {
    if (!Array.isArray(el?.children)) continue;
    for (const child of el.children) {
      if (typeof child === "string" && !spec.elements[child]) {
        errs.push({ cls: "reference-graph", detail: `dangling:${id}>${child}` });
      }
    }
  }

  const reached = new Set<string>();
  const queue: string[] = [spec.root];
  while (queue.length) {
    const id = queue.pop() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    const el = spec.elements[id];
    if (!el) continue;
    for (const child of Array.isArray(el.children) ? el.children : []) {
      if (typeof child === "string") queue.push(child);
    }
    const refProps = REF_PROP_NAMES.get(el.type);
    if (refProps && el.props) {
      for (const pn of refProps) {
        const v = el.props[pn];
        for (const x of typeof v === "string" ? [v] : Array.isArray(v) ? v : []) {
          if (typeof x !== "string") continue;
          if (!spec.elements[x])
            errs.push({ cls: "reference-graph", detail: `dangling:${id}.${pn}>${x}` });
          else queue.push(x);
        }
      }
    }
  }
  for (const id of Object.keys(spec.elements)) {
    if (!reached.has(id)) errs.push({ cls: "reference-graph", detail: `orphan:${id}` });
  }

  for (const [id, el] of Object.entries<any>(spec.elements)) {
    if (!el || typeof el !== "object") {
      errs.push({ cls: "reference-graph", detail: `undefined-element:${id}` });
      continue;
    }
    const def = CATALOG[el.type];
    if (!def) {
      errs.push({ cls: "hallucinated-component", detail: `${id}: unknown type ${el.type}` });
      continue;
    }
    const props = el.props ?? {};
    const refProps = def.props.filter(
      ([pn, ty]) => (ty.t === "ref" || ty.t === "refs") && pn !== "children",
    );
    const childAlias =
      refProps.length === 1 && props[refProps[0][0]] === undefined && Array.isArray(el.children)
        ? refProps[0][0]
        : null;

    for (const [pn, ty] of def.props) {
      if (pn === "children") continue;
      const v = props[pn] ?? (pn === childAlias ? el.children : undefined);
      if (ty.req && (v === undefined || v === null)) {
        errs.push({ cls: "required-field", detail: `${id}.${pn} missing` });
        continue;
      }
      if (v === undefined || v === null) continue;
      if (ty.enum && !ty.enum.includes(v)) {
        errs.push({
          cls: "enum-mismatch",
          detail: `${id}.${pn}=${JSON.stringify(v)} not in ${ty.enum.join(",")}`,
        });
      }
    }
  }

  return done();
}
