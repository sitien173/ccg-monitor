export type HookCommand = {
  type: "command";
  command: string;
  _ccgmon?: true;
};

type HookGroup = {
  matcher: string;
  hooks: HookCommand[];
};

type ClaudeSettings = {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
};

const KEYS = ["SessionStart", "PreToolUse", "PostToolUse", "Stop"] as const;

export function mergeCcgmonHooks(settings: ClaudeSettings, commands: Record<(typeof KEYS)[number], string>): ClaudeSettings {
  const next: ClaudeSettings = { ...settings, hooks: { ...(settings.hooks ?? {}) } };

  for (const key of KEYS) {
    const existing = Array.isArray(next.hooks?.[key]) ? next.hooks![key]! : [];
    const cleaned = existing
      .map((group) => ({ ...group, hooks: group.hooks.filter((entry) => entry._ccgmon !== true) }))
      .filter((group) => group.hooks.length > 0);

    cleaned.push({
      matcher: "",
      hooks: [{ type: "command", command: commands[key], _ccgmon: true }],
    });

    next.hooks![key] = cleaned;
  }

  return next;
}

export function removeCcgmonHooks(settings: ClaudeSettings): ClaudeSettings {
  const next: ClaudeSettings = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  for (const key of KEYS) {
    const existing = Array.isArray(next.hooks?.[key]) ? next.hooks![key]! : [];
    const cleaned = existing
      .map((group) => ({ ...group, hooks: group.hooks.filter((entry) => entry._ccgmon !== true) }))
      .filter((group) => group.hooks.length > 0);
    if (cleaned.length === 0) {
      delete next.hooks![key];
    } else {
      next.hooks![key] = cleaned;
    }
  }
  if (next.hooks && Object.keys(next.hooks).length === 0) {
    delete next.hooks;
  }
  return next;
}
