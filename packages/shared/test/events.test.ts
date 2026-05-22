import { describe, expect, test } from "vitest";

import { EventSchema } from "../src/events.js";

const BASE_ENVELOPE = {
  event_id: "018f0d6c-cd08-7caa-8f03-8f761de9ad8b",
  event_version: 1,
  ts: "2026-05-22T10:15:30.123Z",
  machine_id: "b064f9ff-1275-4d4d-98e5-4e86b0a4c39b",
  project_id: "project-123",
  repo_root: "F:/projects/ccg-monitor",
} as const;

describe("EventSchema", () => {
  const cases: ReadonlyArray<[string, unknown]> = [
    [
      "session.started",
      {
        ...BASE_ENVELOPE,
        event_type: "session.started",
        source: "claude_hook",
        session_id: "session-1",
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          cwd: "F:/projects/ccg-monitor",
          transcript_path: "F:/projects/ccg-monitor/.claude/transcript.jsonl",
        },
      },
    ],
    [
      "tool.pre",
      {
        ...BASE_ENVELOPE,
        event_type: "tool.pre",
        source: "claude_hook",
        session_id: "session-1",
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          tool_name: "Edit",
          input_preview: "Update event schema",
        },
      },
    ],
    [
      "tool.post",
      {
        ...BASE_ENVELOPE,
        event_type: "tool.post",
        source: "claude_hook",
        session_id: "session-1",
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          tool_name: "Edit",
          duration_ms: 140,
          error: "none",
        },
      },
    ],
    [
      "session.stopped",
      {
        ...BASE_ENVELOPE,
        event_type: "session.stopped",
        source: "claude_hook",
        session_id: "session-1",
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          reason: "user_exit",
          duration_ms: 2500,
        },
      },
    ],
    [
      "route.requested",
      {
        ...BASE_ENVELOPE,
        event_type: "route.requested",
        source: "openmcp",
        session_id: null,
        plan_slug: null,
        payload: {
          backend: "codex",
          cd: "F:/projects/ccg-monitor",
          prompt_bytes: 1200,
        },
      },
    ],
    [
      "route.dispatched",
      {
        ...BASE_ENVELOPE,
        event_type: "route.dispatched",
        source: "openmcp",
        session_id: "mcp-session-1",
        plan_slug: null,
        payload: {
          session_id: "mcp-session-1",
          attempt: 2,
        },
      },
    ],
    [
      "route.completed",
      {
        ...BASE_ENVELOPE,
        event_type: "route.completed",
        source: "openmcp",
        session_id: "mcp-session-1",
        plan_slug: null,
        payload: {
          success: true,
          duration_ms: 3000,
          output_bytes: 2048,
        },
      },
    ],
    [
      "route.failed",
      {
        ...BASE_ENVELOPE,
        event_type: "route.failed",
        source: "openmcp",
        session_id: "mcp-session-1",
        plan_slug: null,
        payload: {
          error_class: "timeout",
          message: "backend timed out",
        },
      },
    ],
    [
      "plan.discovered",
      {
        ...BASE_ENVELOPE,
        event_type: "plan.discovered",
        source: "fs_watcher",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          slug: "2026-05-22-ccg-monitor",
          status: "ACTIVE",
          created_at: "2026-05-22T10:00:00.000Z",
        },
      },
    ],
    [
      "plan.updated",
      {
        ...BASE_ENVELOPE,
        event_type: "plan.updated",
        source: "fs_watcher",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          slug: "2026-05-22-ccg-monitor",
          diff_summary: "Updated acceptance criteria",
        },
      },
    ],
    [
      "phase.updated",
      {
        ...BASE_ENVELOPE,
        event_type: "phase.updated",
        source: "fs_watcher",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          slug: "2026-05-22-ccg-monitor",
          phase_id: "1",
          status: "ACTIVE",
          owner: "codex",
        },
      },
    ],
    [
      "handover.updated",
      {
        ...BASE_ENVELOPE,
        event_type: "handover.updated",
        source: "fs_watcher",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          slug: "2026-05-22-ccg-monitor",
          status: "ACTIVE",
          current_phase: "1",
        },
      },
    ],
    [
      "sessions.updated",
      {
        ...BASE_ENVELOPE,
        event_type: "sessions.updated",
        source: "fs_watcher",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          slug: "2026-05-22-ccg-monitor",
          sessions: [
            { backend: "codex", mcp_session_id: "session-codex-1" },
            { backend: "agy", mcp_session_id: "session-agy-1" },
          ],
        },
      },
    ],
    [
      "gate.passed",
      {
        ...BASE_ENVELOPE,
        event_type: "gate.passed",
        source: "backfill",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          gate: "review",
          result: "PASS_WITH_DEBT",
          debt_notes: "Minor cleanup pending",
        },
      },
    ],
    [
      "gate.failed",
      {
        ...BASE_ENVELOPE,
        event_type: "gate.failed",
        source: "backfill",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          gate: "execute",
          result: "FAIL",
          debt_notes: "Test failures",
        },
      },
    ],
    [
      "review.recorded",
      {
        ...BASE_ENVELOPE,
        event_type: "review.recorded",
        source: "backfill",
        session_id: null,
        plan_slug: "2026-05-22-ccg-monitor",
        payload: {
          spec_status: "PASS",
          quality_findings: ["No findings"],
        },
      },
    ],
  ];

  test.each(cases)("round-trip parse: %s", (_name, event) => {
    const parsed = EventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  test("rejects malformed envelope with useful zod error path", () => {
    const malformed: unknown = {
      ...BASE_ENVELOPE,
      event_id: "not-a-uuid-v7",
      event_type: "session.started",
      source: "claude_hook",
      session_id: "session-1",
      plan_slug: "2026-05-22-ccg-monitor",
      payload: {
        cwd: "F:/projects/ccg-monitor",
        transcript_path: "transcript.jsonl",
      },
    };

    const result = EventSchema.safeParse(malformed);
    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected parse to fail for malformed event envelope");
    }

    const issuePaths = result.error.issues.map((issue) => issue.path.join("."));
    expect(issuePaths).toContain("event_id");
  });
});
