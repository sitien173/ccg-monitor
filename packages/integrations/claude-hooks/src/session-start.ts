import { SessionStartedEventSchema } from "@ccgmon/shared/events";

import { makeEnvelope, postEvent, readStdinJson } from "./lib/post.js";

async function main(): Promise<void> {
  const input = await readStdinJson();
  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const transcriptPath =
    typeof input.transcript_path === "string" && input.transcript_path.length > 0
      ? input.transcript_path
      : "unknown";
  const sessionId = typeof input.session_id === "string" ? input.session_id : null;

  const event = SessionStartedEventSchema.parse({
    ...makeEnvelope(cwd, sessionId),
    event_type: "session.started",
    payload: {
      cwd,
      transcript_path: transcriptPath,
    },
  });

  await postEvent(event);
}

main().catch((error: unknown) => {
  process.stderr.write(`ccgmon hook warning: ${String(error)}\n`);
  process.exit(0);
});
