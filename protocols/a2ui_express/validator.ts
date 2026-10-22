import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rowFromScore, type BenchError, type Verdict } from "../a2ui/validator.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PY =
  process.env.A2UI_PYTHON ??
  (existsSync(join(__dirname, "../../../.venv/bin/python"))
    ? join(__dirname, "../../../.venv/bin/python")
    : "python3");

export type { BenchError, Verdict };

export function evalA2uiExpress(rawPath: string, opts: { reqs?: number } = {}): Verdict {
  const rawOut = execFileSync(PY, [join(__dirname, "score.py"), rawPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const s = JSON.parse(rawOut);
  return rowFromScore(s, opts);
}

export function evaluate(text: string, opts: { reqs?: number } = {}): Verdict {
  const rawOut = execFileSync(PY, [join(__dirname, "score.py"), "/dev/stdin"], {
    input: text,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const s = JSON.parse(rawOut);
  return rowFromScore(s, opts);
}
