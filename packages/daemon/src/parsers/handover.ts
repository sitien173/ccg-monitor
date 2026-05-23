import { readFile } from "node:fs/promises";

export type HandoverSnapshot = {
  status: string;
  current_phase: string | null;
  next_action: string;
  read_first: string[];
  blocked_on: string[];
};

export async function parseHandoverFile(filePath: string): Promise<HandoverSnapshot | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const frontmatterMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    warnMalformed(filePath, "missing YAML frontmatter delimiters");
    return null;
  }

  const frontmatterRaw = frontmatterMatch[1];
  if (frontmatterRaw === undefined) {
    warnMalformed(filePath, "missing frontmatter block");
    return null;
  }
  const frontmatter = parseFrontmatter(frontmatterRaw);
  if (!frontmatter) {
    warnMalformed(filePath, "invalid YAML key/value structure");
    return null;
  }

  const body = frontmatterMatch[2] ?? "";
  const status = getString(frontmatter, "status") ?? "ACTIVE";
  const currentPhaseRaw = getString(frontmatter, "current_phase");
  const nextAction =
    getString(frontmatter, "next_action") ??
    getSectionBody(body, "next_action") ??
    "";

  return {
    status,
    current_phase: currentPhaseRaw && currentPhaseRaw.toLowerCase() !== "null" ? currentPhaseRaw : null,
    next_action: nextAction.trim(),
    read_first: parseListSection(body, "read_first"),
    blocked_on: parseListSection(body, "blocked_on"),
  };
}

function parseFrontmatter(raw: string): Map<string, string> | null {
  const output = new Map<string, string>();
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (!match) {
      return null;
    }
    const key = match[1];
    const value = match[2];
    if (key === undefined || value === undefined) {
      return null;
    }
    output.set(key, value.trim());
  }

  return output;
}

function getString(entries: Map<string, string>, key: string): string | null {
  const value = entries.get(key);
  if (value === undefined) {
    return null;
  }
  return stripQuotes(value);
}

function parseListSection(markdown: string, sectionName: string): string[] {
  const body = getSectionBody(markdown, sectionName);
  if (!body) {
    return [];
  }

  const lines = body.split(/\r?\n/);
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.toLowerCase() === "empty") {
      return [];
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (!bullet) {
      continue;
    }
    const bulletValue = bullet[1];
    if (bulletValue === undefined) {
      continue;
    }
    const item = bulletValue.trim();
    if (item) {
      items.push(stripQuotes(item));
    }
  }

  return items;
}

function getSectionBody(markdown: string, sectionName: string): string | null {
  const expression = new RegExp(
    `^##\\s+${escapeRegex(sectionName)}\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s+|$)`,
    "im",
  );
  const match = markdown.match(expression);
  if (!match) {
    return null;
  }
  const body = match[1];
  if (body === undefined) {
    return null;
  }
  return body.trim();
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function warnMalformed(filePath: string, reason: string): void {
  console.warn(`[ccgmon/parsers] handover malformed (${reason}): ${filePath}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
