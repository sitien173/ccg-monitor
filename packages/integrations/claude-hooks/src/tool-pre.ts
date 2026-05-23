import { ToolPreEventSchema } from "@ccgmon/shared/events";

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
  const inputPreview = JSON.stringify(input.tool_input ?? "").slice(0, 200);

  const event = ToolPreEventSchema.parse({
    ...makeEnvelope(cwd, sessionId),
    event_type: "tool.pre",
    payload: {
      tool_name: toolName,
      input_preview: inputPreview.length > 0 ? inputPreview : "(empty)",
    },
  });

  await postEvent(event);
}

main().catch((error: unknown) => {
  process.stderr.write(`ccgmon hook warning: ${String(error)}\n`);
  process.exit(0);
});
