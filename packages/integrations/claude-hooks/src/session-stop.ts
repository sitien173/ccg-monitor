import { SessionStoppedEventSchema } from "@ccgmon/shared/events";

import { makeEnvelope, postEvent, readStdinJson } from "./lib/post.js";

async function main(): Promise<void> {
  const input = await readStdinJson();
  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const sessionId = typeof input.session_id === "string" ? input.session_id : null;
  const reason = typeof input.reason === "string" && input.reason.length > 0 ? input.reason : "unknown";
  const durationMs = Number.isInteger(input.duration_ms) && input.duration_ms >= 0 ? input.duration_ms : 0;

  const event = SessionStoppedEventSchema.parse({
    ...makeEnvelope(cwd, sessionId),
    event_type: "session.stopped",
    payload: {
      reason,
      duration_ms: durationMs,
    },
  });

  await postEvent(event);
}

main().catch((error: unknown) => {
  process.stderr.write(`ccgmon hook warning: ${String(error)}\n`);
  process.exit(0);
});
