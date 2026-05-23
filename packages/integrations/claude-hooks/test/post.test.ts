import { describe, expect, test } from "vitest";

import { makeEnvelope } from "../src/lib/post.js";

describe("makeEnvelope", () => {
  test("produces valid envelope shape", () => {
    const env = makeEnvelope("/home/user/project", "session-abc");
    expect(env.source).toBe("claude_hook");
    expect(env.event_version).toBe(1);
    expect(env.session_id).toBe("session-abc");
    expect(env.plan_slug).toBeNull();
    expect(env.repo_root).toBe("/home/user/project");
    expect(typeof env.event_id).toBe("string");
    expect(typeof env.ts).toBe("string");
    expect(typeof env.machine_id).toBe("string");
    expect(typeof env.project_id).toBe("string");
  });

  test("normalizes backslashes in project_id hash", () => {
    const a = makeEnvelope("C:\\Users\\me\\project", null);
    const b = makeEnvelope("C:/Users/me/project", null);
    expect(a.project_id).toBe(b.project_id);
  });

  test("null session_id when not provided", () => {
    const env = makeEnvelope("/tmp", null);
    expect(env.session_id).toBeNull();
  });
});
