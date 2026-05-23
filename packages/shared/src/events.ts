import { z } from "zod";

const UuidV7StringSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "event_id must be a UUIDv7 string",
  );

const IsoDateTimeStringSchema = z.string().datetime({ offset: true });

const SourceSchema = z.enum([
  "openmcp",
  "openmcp_tail",
  "claude_hook",
  "fs_watcher",
  "backfill",
]);
const BackendSchema = z.enum(["codex", "agy"]);
const GateSchema = z.enum(["plan", "execute", "review"]);
const GateResultSchema = z.enum(["PASS", "PASS_WITH_DEBT", "FAIL", "BLOCKED"]);
const PlanStatusSchema = z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]);
const OwnerSchema = z.enum(["claude", "codex", "gemini"]);
const ErrorClassSchema = z.enum([
  "timeout",
  "network",
  "fatal",
  "cancelled",
  "unknown",
]);

const EnvelopeBaseSchema = z.object({
  event_id: UuidV7StringSchema,
  event_version: z.number().int().min(1),
  ts: IsoDateTimeStringSchema,
  source: SourceSchema,
  machine_id: z.string().min(1),
  project_id: z.string().min(1),
  repo_root: z.string().min(1),
  session_id: z.string().nullable(),
  plan_slug: z.string().nullable(),
});

const makeEventSchema = <TType extends string, TPayload extends z.ZodTypeAny>(
  eventType: TType,
  payload: TPayload,
) =>
  EnvelopeBaseSchema.extend({
    event_type: z.literal(eventType),
    payload,
  });

export const SessionStartedEventSchema = makeEventSchema(
  "session.started",
  z.object({
    cwd: z.string().min(1),
    transcript_path: z.string().min(1),
  }),
);

export const ToolPreEventSchema = makeEventSchema(
  "tool.pre",
  z.object({
    tool_name: z.string().min(1),
    input_preview: z.string().min(1),
  }),
);

export const ToolPostEventSchema = makeEventSchema(
  "tool.post",
  z.object({
    tool_name: z.string().min(1),
    duration_ms: z.number().int().min(0),
    error: z.string().min(1).optional(),
  }),
);

export const SessionStoppedEventSchema = makeEventSchema(
  "session.stopped",
  z.object({
    reason: z.string().min(1),
    duration_ms: z.number().int().min(0),
  }),
);

export const RouteRequestedEventSchema = makeEventSchema(
  "route.requested",
  z.object({
    backend: BackendSchema,
    cd: z.string().min(1),
    prompt_bytes: z.number().int().min(0),
  }),
);

export const RouteDispatchedEventSchema = makeEventSchema(
  "route.dispatched",
  z.object({
    session_id: z.string().min(1),
    attempt: z.number().int().min(1),
  }),
);

export const RouteCompletedEventSchema = makeEventSchema(
  "route.completed",
  z.object({
    success: z.boolean(),
    duration_ms: z.number().int().min(0),
    output_bytes: z.number().int().min(0),
  }),
);

export const RouteFailedEventSchema = makeEventSchema(
  "route.failed",
  z.object({
    error_class: ErrorClassSchema,
    message: z.string().min(1),
  }),
);

export const PlanDiscoveredEventSchema = makeEventSchema(
  "plan.discovered",
  z.object({
    slug: z.string().min(1),
    status: PlanStatusSchema,
    created_at: IsoDateTimeStringSchema,
  }),
);

export const PlanUpdatedEventSchema = makeEventSchema(
  "plan.updated",
  z.object({
    slug: z.string().min(1),
    diff_summary: z.string().min(1),
  }),
);

export const PhaseUpdatedEventSchema = makeEventSchema(
  "phase.updated",
  z.object({
    slug: z.string().min(1),
    phase_id: z.string().min(1),
    status: z.string().min(1),
    owner: OwnerSchema,
  }),
);

export const HandoverUpdatedEventSchema = makeEventSchema(
  "handover.updated",
  z.object({
    slug: z.string().min(1),
    status: z.enum(["ACTIVE", "COMPLETED"]),
    current_phase: z.string().nullable(),
  }),
);

export const SessionsUpdatedEventSchema = makeEventSchema(
  "sessions.updated",
  z.object({
    slug: z.string().min(1),
    sessions: z.array(
      z.object({
        backend: BackendSchema,
        mcp_session_id: z.string().min(1),
      }),
    ),
  }),
);

const GatePayloadSchema = z.object({
  gate: GateSchema,
  result: GateResultSchema,
  debt_notes: z.string().min(1).optional(),
});

export const GatePassedEventSchema = makeEventSchema(
  "gate.passed",
  GatePayloadSchema,
);

export const GateFailedEventSchema = makeEventSchema(
  "gate.failed",
  GatePayloadSchema,
);

export const ReviewRecordedEventSchema = makeEventSchema(
  "review.recorded",
  z.object({
    spec_status: GateResultSchema,
    quality_findings: z.array(z.string()),
  }),
);

export const EventSchema = z.discriminatedUnion("event_type", [
  SessionStartedEventSchema,
  ToolPreEventSchema,
  ToolPostEventSchema,
  SessionStoppedEventSchema,
  RouteRequestedEventSchema,
  RouteDispatchedEventSchema,
  RouteCompletedEventSchema,
  RouteFailedEventSchema,
  PlanDiscoveredEventSchema,
  PlanUpdatedEventSchema,
  PhaseUpdatedEventSchema,
  HandoverUpdatedEventSchema,
  SessionsUpdatedEventSchema,
  GatePassedEventSchema,
  GateFailedEventSchema,
  ReviewRecordedEventSchema,
]);
