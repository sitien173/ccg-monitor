import { randomUUID } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { OPENMCP_DEFAULT_LOG_PATH } from "@ccgmon/shared/constants";
import type { Event } from "@ccgmon/shared/types";

import { type CcgmonDatabase, normalizeRepoRoot, projectIdFromRepoRoot } from "./db.js";
import type { EventProjector } from "./projector.js";

type TailEvent = {
  event: Event;
  repoRoot: string;
};

export class OpenmcpTailer {
  private readonly db: CcgmonDatabase;
  private readonly projector: EventProjector;
  private readonly defaultRepoRoot: string;
  private readonly machineId: string;
  private watcher: FSWatcher | null = null;
  private abortListener: (() => void) | null = null;
  private started = false;
  private logPath = "";
  private byteOffset = 0;
  private inode = "";
  private pollQueue: Promise<void> = Promise.resolve();
  private lastErrorClass = "unknown";
  private readonly retryAttempts = new Map<string, number>();

  public constructor(options: {
    db: CcgmonDatabase;
    projector: EventProjector;
    defaultRepoRoot?: string;
    machineId?: string;
  }) {
    this.db = options.db;
    this.projector = options.projector;
    this.defaultRepoRoot = normalizeRepoRoot(options.defaultRepoRoot ?? process.cwd());
    this.machineId = options.machineId ?? hostname();
  }

  public async start(abortSignal: AbortSignal): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    this.logPath = resolveOpenmcpLogPath();

    const saved = this.db.getTailState();
    if (saved && saved.log_path === this.logPath) {
      this.byteOffset = saved.byte_offset;
      this.inode = saved.inode;
    }

    this.abortListener = () => this.stop();
    abortSignal.addEventListener("abort", this.abortListener, { once: true });

    await this.poll();

    const watchedDir = dirname(this.logPath);
    const watchedName = basename(this.logPath);
    this.watcher = watch(watchedDir, (_eventType, fileName) => {
      if (typeof fileName === "string" && fileName !== watchedName) {
        return;
      }
      this.enqueuePoll();
    });
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private enqueuePoll(): void {
    this.pollQueue = this.pollQueue.then(() => this.poll()).catch(() => {
      // fail-silent: tailing should never crash daemon
    });
  }

  private async poll(): Promise<void> {
    if (!this.started) {
      return;
    }

    const fileStat = await stat(this.logPath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      return;
    }

    const currentInode = `${fileStat.dev}:${fileStat.ino}`;
    if (this.inode && this.inode !== currentInode) {
      this.byteOffset = 0;
    }
    if (fileStat.size < this.byteOffset) {
      this.byteOffset = 0;
    }

    const buffer = await readFile(this.logPath);
    if (this.byteOffset > buffer.length) {
      this.byteOffset = 0;
    }

    const unread = buffer.subarray(this.byteOffset);
    const lastNewline = unread.lastIndexOf(0x0a);
    if (lastNewline < 0) {
      this.inode = currentInode;
      this.db.setTailState(this.logPath, this.byteOffset, this.inode);
      return;
    }

    const complete = unread.subarray(0, lastNewline + 1);
    await this.processCompleteLines(complete, this.byteOffset);

    this.byteOffset += lastNewline + 1;
    this.inode = currentInode;
    this.db.setTailState(this.logPath, this.byteOffset, this.inode);
  }

  private async processCompleteLines(chunk: Buffer, baseOffset: number): Promise<void> {
    let cursor = 0;
    while (cursor < chunk.length) {
      const newline = chunk.indexOf(0x0a, cursor);
      if (newline < 0) {
        break;
      }

      let lineBytes = chunk.subarray(cursor, newline);
      if (lineBytes.length > 0 && lineBytes[lineBytes.length - 1] === 0x0d) {
        lineBytes = lineBytes.subarray(0, lineBytes.length - 1);
      }

      const line = lineBytes.toString("utf8");
      const absoluteOffset = baseOffset + cursor;
      const parsed = this.parseLine(line, absoluteOffset);
      if (parsed) {
        await this.emit(parsed.event, parsed.repoRoot);
      }

      cursor = newline + 1;
    }
  }

  private parseLine(line: string, logOffset: number): TailEvent | null {
    const errorClassMatch = line.match(/\berror_class=(\w+)\b/);
    if (errorClassMatch) {
      this.lastErrorClass = errorClassMatch[1] ?? "unknown";
    }

    const repoRoot = normalizeRepoRoot(extractCd(line) ?? this.defaultRepoRoot);

    const requestedNew = line.match(/^run\(\) backend=(\w+) session_id=<new>\b/);
    if (requestedNew) {
      const backend = normalizeBackend(requestedNew[1]);
      return {
        repoRoot,
        event: this.makeEvent({
          eventType: "route.requested",
          repoRoot,
          sessionId: null,
          payload: {
            backend,
            cd: repoRoot,
            prompt_bytes: parseIntMatch(line, /\bprompt_bytes=(\d+)\b/),
            log_offset: logOffset,
          },
        }),
      };
    }

    const requestedExisting = line.match(/^run\(\) backend=(\w+) session_id=(\S+)\b/);
    if (requestedExisting && requestedExisting[2] !== "<new>") {
      const backend = normalizeBackend(requestedExisting[1]);
      const sessionId = requestedExisting[2] ?? null;
      if (sessionId) {
        const prior = this.retryAttempts.get(sessionId) ?? 1;
        this.retryAttempts.set(sessionId, Math.max(prior, 2));
      }
      return {
        repoRoot,
        event: this.makeEvent({
          eventType: "route.requested",
          repoRoot,
          sessionId,
          payload: {
            backend,
            cd: repoRoot,
            prompt_bytes: parseIntMatch(line, /\bprompt_bytes=(\d+)\b/),
            attempt: sessionId ? this.retryAttempts.get(sessionId) ?? 2 : 2,
            log_offset: logOffset,
          },
        }),
      };
    }

    const retryMatch = line.match(/^retry: preserving SESSION_ID=(\S+)\b/);
    if (retryMatch) {
      const sessionId = retryMatch[1] ?? "";
      const attempt = (this.retryAttempts.get(sessionId) ?? 1) + 1;
      this.retryAttempts.set(sessionId, attempt);
      return {
        repoRoot,
        event: this.makeEvent({
          eventType: "route.dispatched",
          repoRoot,
          sessionId,
          payload: {
            session_id: sessionId,
            attempt,
            log_offset: logOffset,
          },
        }),
      };
    }

    const doneSuccess = line.match(/^run\(\) done backend=(\w+) success=True\b.*\bsession_id=(\S+)\b/);
    if (doneSuccess) {
      const sessionId = doneSuccess[2] ?? null;
      return {
        repoRoot,
        event: this.makeEvent({
          eventType: "route.completed",
          repoRoot,
          sessionId,
          payload: {
            success: true,
            duration_ms: parseIntMatch(line, /\bduration_ms=(\d+)\b/),
            output_bytes: parseIntMatch(line, /\boutput_bytes=(\d+)\b/),
            backend: normalizeBackend(doneSuccess[1]),
            log_offset: logOffset,
          },
        }),
      };
    }

    const doneFail = line.match(/^run\(\) done backend=(\w+) success=False\b.*\battempts=(\d+)\b/);
    if (doneFail) {
      const lineErrorClass = line.match(/\berror_class=(\w+)\b/)?.[1] ?? this.lastErrorClass;
      return {
        repoRoot,
        event: this.makeEvent({
          eventType: "route.failed",
          repoRoot,
          sessionId: extractSessionId(line),
          payload: {
            error_class: normalizeErrorClass(lineErrorClass),
            message: line,
            backend: normalizeBackend(doneFail[1]),
            attempts: Number(doneFail[2] ?? "0"),
            log_offset: logOffset,
          },
        }),
      };
    }

    return null;
  }

  private makeEvent(input: {
    eventType: Event["event_type"];
    repoRoot: string;
    sessionId: string | null;
    payload: Record<string, unknown>;
  }): Event {
    return {
      event_id: generateUuidV7Like(),
      event_type: input.eventType,
      event_version: 1,
      ts: new Date().toISOString(),
      source: "openmcp_tail",
      machine_id: this.machineId,
      project_id: projectIdFromRepoRoot(input.repoRoot),
      repo_root: input.repoRoot,
      session_id: input.sessionId,
      plan_slug: null,
      payload: input.payload,
    } as Event;
  }

  private async emit(event: Event, repoRoot: string): Promise<void> {
    try {
      this.db.insertEvent(event);
    } catch (error) {
      if (!isDuplicateTailEvent(error)) {
        process.stderr.write(`ccgmon openmcp tail warning: ${String(error)}\n`);
      }
      return;
    }

    try {
      await this.projector.projectEvent({ ...event, repo_root: repoRoot });
    } catch (error) {
      process.stderr.write(`ccgmon openmcp tail warning: ${String(error)}\n`);
    }
  }
}

export function resolveOpenmcpLogPath(): string {
  const configured = process.env.OPENMCP_LOG_FILE?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  if (OPENMCP_DEFAULT_LOG_PATH.startsWith("~/")) {
    return resolve(homedir(), OPENMCP_DEFAULT_LOG_PATH.slice(2));
  }
  return resolve(OPENMCP_DEFAULT_LOG_PATH);
}

function generateUuidV7Like(): string {
  const random = randomUUID().toLowerCase();
  return `${random.slice(0, 14)}7${random.slice(15)}`;
}

function parseIntMatch(line: string, regex: RegExp): number {
  const value = line.match(regex)?.[1];
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function extractSessionId(line: string): string | null {
  const value = line.match(/\bsession_id=(\S+)\b/)?.[1] ?? line.match(/\bSESSION_ID=(\S+)\b/)?.[1];
  return value ?? null;
}

function extractCd(line: string): string | null {
  const raw = line.match(/\bcd=(\S+)\b/)?.[1] ?? null;
  if (!raw) {
    return null;
  }
  return raw.replace(/^['\"]|['\"]$/g, "");
}

function normalizeBackend(value: string | undefined): "codex" | "agy" {
  return value?.toLowerCase() === "agy" ? "agy" : "codex";
}

function normalizeErrorClass(value: string): "timeout" | "network" | "fatal" | "cancelled" | "unknown" {
  const lowered = value.toLowerCase();
  if (
    lowered === "timeout" ||
    lowered === "network" ||
    lowered === "fatal" ||
    lowered === "cancelled"
  ) {
    return lowered;
  }
  return "unknown";
}

function isDuplicateTailEvent(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /UNIQUE constraint failed/i.test(error.message) && /idx_events_tail_offset|events\.source, events\.json_extract/i.test(error.message);
}
