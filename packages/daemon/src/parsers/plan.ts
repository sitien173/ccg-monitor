import { readFile } from "node:fs/promises";

export type PlanPhaseEntry = {
  phase_id: string;
  title: string;
  owner: string;
};

export type PlanSnapshot = {
  phases: PlanPhaseEntry[];
};

export async function parsePlanFile(filePath: string): Promise<PlanSnapshot | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const headingRegex = /^##\s+Phase\s+([0-9]+)\s*[-—:]\s*(.+)$/gim;
  const headings = Array.from(raw.matchAll(headingRegex));
  if (headings.length === 0) {
    warnMalformed(filePath, "no phase headings found");
    return {
      phases: [],
    };
  }

  const phases: PlanPhaseEntry[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    if (!match) {
      continue;
    }
    const start = match.index ?? 0;
    const nextMatch = headings[index + 1];
    const end = nextMatch?.index ?? raw.length;
    const block = raw.slice(start, end);

    const phaseId = match[1];
    const title = match[2];
    if (phaseId === undefined || title === undefined) {
      continue;
    }
    const owner = extractOwner(block);
    phases.push({
      phase_id: phaseId,
      title: title.trim(),
      owner,
    });
  }

  return {
    phases,
  };
}

function extractOwner(block: string): string {
  const strongMatch = block.match(/\*\*Owner:\*\*\s*`?([^\r\n`]+)`?/i);
  if (strongMatch?.[1]) {
    return strongMatch[1].trim();
  }

  const listMatch = block.match(/^\s*[-*]\s*Owner\s*:\s*(.+)$/im);
  if (listMatch?.[1]) {
    return listMatch[1].trim().replace(/`/g, "");
  }

  return "codex";
}

function warnMalformed(filePath: string, reason: string): void {
  console.warn(`[ccgmon/parsers] plan malformed (${reason}): ${filePath}`);
}
