import { describe, expect, test } from "vitest";

import { mergeCcgmonHooks, removeCcgmonHooks } from "../src/lib/settings-merge.js";

describe("mergeCcgmonHooks", () => {
  const commands = {
    SessionStart: "node /dist/session-start.js",
    PreToolUse: "node /dist/tool-pre.js",
    PostToolUse: "node /dist/tool-post.js",
    Stop: "node /dist/session-stop.js",
  } as const;

  test("adds hooks to empty settings", () => {
    const result = mergeCcgmonHooks({}, commands);
    expect(result.hooks).toBeDefined();
    expect(result.hooks!.SessionStart).toHaveLength(1);
    expect(result.hooks!.SessionStart![0].hooks[0]._ccgmon).toBe(true);
    expect(result.hooks!.SessionStart![0].hooks[0].command).toBe(commands.SessionStart);
    expect(result.hooks!.SessionStart![0].matcher).toBe("");
  });

  test("preserves existing non-ccgmon hooks", () => {
    const existing = {
      hooks: {
        SessionStart: [
          { matcher: "", hooks: [{ type: "command" as const, command: "echo user-hook" }] },
        ],
      },
    };
    const result = mergeCcgmonHooks(existing, commands);
    const groups = result.hooks!.SessionStart!;
    expect(groups).toHaveLength(2);
    expect(groups[0].hooks[0].command).toBe("echo user-hook");
    expect(groups[1].hooks[0]._ccgmon).toBe(true);
  });

  test("replaces existing ccgmon hooks on re-install", () => {
    const first = mergeCcgmonHooks({}, commands);
    const second = mergeCcgmonHooks(first, {
      ...commands,
      SessionStart: "node /new/session-start.js",
    });
    const groups = second.hooks!.SessionStart!;
    expect(groups).toHaveLength(1);
    expect(groups[0].hooks[0].command).toBe("node /new/session-start.js");
  });

  test("preserves non-hooks settings", () => {
    const result = mergeCcgmonHooks({ permissions: { allow: ["Read"] } }, commands);
    expect((result as any).permissions).toEqual({ allow: ["Read"] });
  });
});

describe("removeCcgmonHooks", () => {
  const commands = {
    SessionStart: "node /dist/session-start.js",
    PreToolUse: "node /dist/tool-pre.js",
    PostToolUse: "node /dist/tool-post.js",
    Stop: "node /dist/session-stop.js",
  } as const;

  test("removes ccgmon hooks, keeps user hooks", () => {
    const merged = mergeCcgmonHooks(
      {
        hooks: {
          SessionStart: [
            { matcher: "", hooks: [{ type: "command" as const, command: "echo user" }] },
          ],
        },
      },
      commands,
    );
    const result = removeCcgmonHooks(merged);
    expect(result.hooks!.SessionStart).toHaveLength(1);
    expect(result.hooks!.SessionStart![0].hooks[0].command).toBe("echo user");
  });

  test("deletes hooks key when all hooks removed", () => {
    const merged = mergeCcgmonHooks({}, commands);
    const result = removeCcgmonHooks(merged);
    expect(result.hooks).toBeUndefined();
  });

  test("noop on empty settings", () => {
    const result = removeCcgmonHooks({});
    expect(result.hooks).toBeUndefined();
  });
});
