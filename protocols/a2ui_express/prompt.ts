import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PY =
  process.env.A2UI_PYTHON ??
  (existsSync(join(__dirname, "../../../.venv/bin/python"))
    ? join(__dirname, "../../../.venv/bin/python")
    : "python3");

let cachedPrompt: string | null = null;

export function systemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  const scriptPath = join(__dirname, "prompt.py");
  cachedPrompt = execFileSync(PY, [scriptPath, "--stdout"], { encoding: "utf8" });
  return cachedPrompt;
}
