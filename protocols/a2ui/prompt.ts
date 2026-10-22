import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync, readFileSync } from "node:fs";
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
  try {
    cachedPrompt = execFileSync(PY, [scriptPath, "--stdout"], { encoding: "utf8" });
  } catch {
    const fallbackPath = join(__dirname, "system-prompt.txt");
    if (existsSync(fallbackPath)) {
      cachedPrompt = readFileSync(fallbackPath, "utf8");
    } else {
      throw new Error(`Failed to generate a2ui prompt and ${fallbackPath} missing`);
    }
  }
  return cachedPrompt;
}
