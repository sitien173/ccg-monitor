import { basename } from "node:path";
import { readFile } from "node:fs/promises";

export type PhaseTask = {
  task_id: string;
  title: string;
  done: boolean;
};

export type PhaseSnapshot = {
  phase_id: string;
  title: string;
  owner: string;
  status: string;
  tasks: PhaseTask[];
  files_modified: string[];
};

export async function parsePhaseFile(filePath: string): Promise<PhaseSnapshot | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const lines = raw.split(/\r?\n/);
  const heading = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim();
  const filePhaseId = extractPhaseIdFromFileName(basename(filePath));
  const headingPhaseId = extractPhaseIdFromHeading(heading ?? "");
  const phaseId = filePhaseId ?? headingPhaseId;

  if (!phaseId) {
    warnMalformed(filePath, "cannot determine phase id");
    return null;
  }

  const status =
    extractMetadataLine(lines, "status") ??
    extractStrongMetadata(raw, "status") ??
    "pending";
  const owner =
    extractMetadataLine(lines, "owner") ??
    extractStrongMetadata(raw, "owner") ??
    "codex";

  const title = extractTitle(heading ?? "", phaseId);
  const tasks = parseTasks(lines);
  const filesModified = parseFilesModified(raw);

  return {
    phase_id: phaseId,
    title,
    owner,
    status,
    tasks,
    files_modified: filesModified,
  };
}

function parseTasks(lines: string[]): PhaseTask[] {
  const tasks: PhaseTask[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (!match) {
      continue;
    }
    const taskTitleRaw = match[2];
    if (taskTitleRaw === undefined) {
      continue;
    }
    const taskTitle = taskTitleRaw.trim();
    if (!taskTitle) {
      continue;
    }
    tasks.push({
      task_id: `task-${tasks.length + 1}`,
      title: taskTitle,
      done: (match[1] ?? "").toLowerCase() === "x",
    });
  }
  return tasks;
}

function parseFilesModified(raw: string): string[] {
  const sectionMatch = raw.match(
    /^##\s+Files\s+Modified\s*\r?\n([\s\S]*?)(?=^##\s+|$)/im,
  );
  if (!sectionMatch) {
    return [];
  }

  const output: string[] = [];
  const sectionBody = sectionMatch[1];
  if (sectionBody === undefined) {
    return [];
  }
  for (const line of sectionBody.split(/\r?\n/)) {
    const bullet = line.trim().match(/^[-*]\s+(.*)$/);
    if (!bullet) {
      continue;
    }
    const bulletValue = bullet[1];
    if (bulletValue === undefined) {
      continue;
    }
    let value = bulletValue.trim();
    if (!value) {
      continue;
    }
    value = value.replace(/`/g, "");
    if (value) {
      output.push(value);
    }
  }

  return output;
}

function extractMetadataLine(lines: string[], key: string): string | null {
  const expression = new RegExp(`^\\s*[-*]\\s*${escapeRegex(key)}\\s*:\\s*(.+)$`, "i");
  for (const line of lines) {
    const match = line.match(expression);
    if (match) {
      const value = match[1];
      if (value !== undefined) {
        return cleanupValue(value);
      }
    }
  }
  return null;
}

function extractStrongMetadata(markdown: string, key: string): string | null {
  const expression = new RegExp(`\\*\\*${escapeRegex(key)}:\\*\\*\\s*` + "`?" + `([^\\r\\n` + "`" + `]+)` + "`?", "i");
  const match = markdown.match(expression);
  if (!match) {
    return null;
  }
  const value = match[1];
  if (value === undefined) {
    return null;
  }
  return cleanupValue(value);
}

function cleanupValue(value: string): string {
  return value.trim().replace(/[\s.]+$/g, "");
}

function extractPhaseIdFromFileName(fileName: string): string | null {
  const match = fileName.match(/^PHASE-([0-9]+)\.md$/i);
  if (!match) {
    return null;
  }
  const phaseId = match[1];
  return phaseId ?? null;
}

function extractPhaseIdFromHeading(heading: string): string | null {
  const match = heading.match(/phase\s+([0-9]+)/i);
  if (!match) {
    return null;
  }
  const phaseId = match[1];
  return phaseId ?? null;
}

function extractTitle(heading: string, phaseId: string): string {
  const withoutPrefix = heading
    .replace(/^phase\s+[0-9]+\s*[-—:]\s*/i, "")
    .trim();

  if (withoutPrefix) {
    return withoutPrefix;
  }

  return `Phase ${phaseId}`;
}

function warnMalformed(filePath: string, reason: string): void {
  console.warn(`[ccgmon/parsers] phase malformed (${reason}): ${filePath}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
