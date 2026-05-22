import type { z } from "zod";

import {
  EventSchema,
  GateFailedEventSchema,
  GatePassedEventSchema,
  HandoverUpdatedEventSchema,
  PhaseUpdatedEventSchema,
  PlanDiscoveredEventSchema,
  PlanUpdatedEventSchema,
  ReviewRecordedEventSchema,
  RouteCompletedEventSchema,
  RouteDispatchedEventSchema,
  RouteFailedEventSchema,
  RouteRequestedEventSchema,
  SessionStartedEventSchema,
  SessionStoppedEventSchema,
  SessionsUpdatedEventSchema,
  ToolPostEventSchema,
  ToolPreEventSchema,
} from "./events.js";

export type SessionStartedEvent = z.infer<typeof SessionStartedEventSchema>;
export type ToolPreEvent = z.infer<typeof ToolPreEventSchema>;
export type ToolPostEvent = z.infer<typeof ToolPostEventSchema>;
export type SessionStoppedEvent = z.infer<typeof SessionStoppedEventSchema>;
export type RouteRequestedEvent = z.infer<typeof RouteRequestedEventSchema>;
export type RouteDispatchedEvent = z.infer<typeof RouteDispatchedEventSchema>;
export type RouteCompletedEvent = z.infer<typeof RouteCompletedEventSchema>;
export type RouteFailedEvent = z.infer<typeof RouteFailedEventSchema>;
export type PlanDiscoveredEvent = z.infer<typeof PlanDiscoveredEventSchema>;
export type PlanUpdatedEvent = z.infer<typeof PlanUpdatedEventSchema>;
export type PhaseUpdatedEvent = z.infer<typeof PhaseUpdatedEventSchema>;
export type HandoverUpdatedEvent = z.infer<typeof HandoverUpdatedEventSchema>;
export type SessionsUpdatedEvent = z.infer<typeof SessionsUpdatedEventSchema>;
export type GatePassedEvent = z.infer<typeof GatePassedEventSchema>;
export type GateFailedEvent = z.infer<typeof GateFailedEventSchema>;
export type ReviewRecordedEvent = z.infer<typeof ReviewRecordedEventSchema>;
export type Event = z.infer<typeof EventSchema>;
