import { readFile } from "node:fs/promises";

export type SessionsSnapshot = Record<string, string | null>;

export async function parseSessionsFile(filePath: string): Promise<SessionsSnapshot> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      warnMalformed(filePath, "root value must be an object");
      return {};
    }

    const output: SessionsSnapshot = {};
    for (const [backend, value] of Object.entries(parsed)) {
      if (value === null || typeof value === "string") {
        output[backend] = value;
        continue;
      }
      warnMalformed(filePath, `invalid session value for backend ${backend}`);
      output[backend] = null;
    }

    return output;
  } catch {
    warnMalformed(filePath, "invalid JSON");
    return {};
  }
}

function warnMalformed(filePath: string, reason: string): void {
  console.warn(`[ccgmon/parsers] sessions malformed (${reason}): ${filePath}`);
}
