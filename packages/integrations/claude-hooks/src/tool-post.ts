import { ToolPostEventSchema } from "@ccgmon/shared/events";

import { makeEnvelope, postEvent, readStdinJson } from "./lib/post.js";

const TOOL_MATCHER = /^(Edit|Write|Bash|Task|mcp__)/;

async function main(): Promise<void> {
  const input = await readStdinJson();
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";

  if (!TOOL_MATCHER.test(toolName)) {
    return;
  }

  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const sessionId = typeof input.session_id === "string" ? input.session_id : null;
  const durationMs = Number.isInteger(input.duration_ms) && input.duration_ms >= 0 ? input.duration_ms : 0;
  const errorMessage = typeof input.error === "string" && input.error.length > 0 ? input.error : undefined;

  const event = ToolPostEventSchema.parse({
    ...makeEnvelope(cwd, sessionId),
    event_type: "tool.post",
    payload: {
      tool_name: toolName,
      duration_ms: durationMs,
      ...(errorMessage ? { error: errorMessage } : {}),
    },
  });

  await postEvent(event);
}

main().catch((error: unknown) => {
  process.stderr.write(`ccgmon hook warning: ${String(error)}\n`);
  process.exit(0);
});
