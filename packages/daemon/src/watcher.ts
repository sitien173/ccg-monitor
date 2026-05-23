import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import chokidar, { type FSWatcher } from "chokidar";

import { normalizeRepoRoot, type CcgmonDatabase } from "./db.js";

const WATCH_DEBOUNCE_MS = 250;

export type WatchedFileChange = {
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
  filePath: string;
  repoRoot: string;
};

export type EnsureProjectResult =
  | {
      ignored: true;
      repoRoot: string;
    }
  | {
      created: boolean;
      ignored: false;
      projectId: string;
      repoRoot: string;
    };

export class PlanWatcher {
  private readonly db: CcgmonDatabase;
  private readonly onFileChange: (change: WatchedFileChange) => void;
  private readonly pendingByPath = new Map<string, NodeJS.Timeout>();
  private readonly latestByPath = new Map<string, WatchedFileChange>();
  private readonly watchedRoots = new Set<string>();
  private watcher: FSWatcher | null = null;

  public constructor(options: {
    db: CcgmonDatabase;
    onFileChange: (change: WatchedFileChange) => void;
  }) {
    this.db = options.db;
    this.onFileChange = options.onFileChange;
  }

  public async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch([], {
      ignoreInitial: true,
      persistent: true,
      ignored: [/(^|[\\/])node_modules([\\/]|$)/, /(^|[\\/])\.git([\\/]|$)/],
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 25,
      },
    });

    this.watcher.on("all", (event, filePath) => {
      this.handleRawEvent(event, filePath);
    });

    const repoRoots = this.db.listWatchableRepoRoots();
    for (const repoRoot of repoRoots) {
      await this.addRoot(repoRoot);
    }
  }

  public async stop(): Promise<void> {
    for (const timeout of this.pendingByPath.values()) {
      clearTimeout(timeout);
    }
    this.pendingByPath.clear();
    this.latestByPath.clear();
    this.watchedRoots.clear();

    if (!this.watcher) {
      return;
    }

    await this.watcher.close();
    this.watcher = null;
  }

  public async addRoot(repoRoot: string): Promise<void> {
    if (!this.watcher) {
      return;
    }
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    if (this.watchedRoots.has(normalizedRepoRoot)) {
      return;
    }

    this.watchedRoots.add(normalizedRepoRoot);
    await this.watcher.add(normalizedRepoRoot);
  }

  public async removeRoot(repoRoot: string): Promise<void> {
    if (!this.watcher) {
      return;
    }
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    if (!this.watchedRoots.has(normalizedRepoRoot)) {
      return;
    }

    this.watchedRoots.delete(normalizedRepoRoot);
    await this.watcher.unwatch(normalizedRepoRoot);
  }

  public async ensureProjectForRepoRoot(repoRoot: string): Promise<EnsureProjectResult> {
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    const ignorePath = resolve(normalizedRepoRoot, ".ccgmon-ignore");

    if (existsSync(ignorePath)) {
      return {
        ignored: true,
        repoRoot: normalizedRepoRoot,
      };
    }

    const nowIso = new Date().toISOString();
    const { created, project } = this.db.upsertProjectByRepoRoot(normalizedRepoRoot, nowIso);

    if (project.status === "ACTIVE") {
      await this.addRoot(normalizedRepoRoot);
    }

    return {
      created,
      ignored: false,
      projectId: project.project_id,
      repoRoot: project.repo_root,
    };
  }

  private handleRawEvent(event: string, filePath: string): void {
    if (!isWatchEvent(event)) {
      return;
    }

    const normalizedPath = normalizeRepoRoot(resolve(filePath));
    const repoRoot = this.resolveRepoRootForPath(normalizedPath);
    if (!repoRoot) {
      return;
    }

    const change: WatchedFileChange = {
      event,
      filePath: normalizedPath,
      repoRoot,
    };

    const existingTimeout = this.pendingByPath.get(normalizedPath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.latestByPath.set(normalizedPath, change);
    const timeout = setTimeout(() => {
      this.pendingByPath.delete(normalizedPath);
      const latest = this.latestByPath.get(normalizedPath);
      if (!latest) {
        return;
      }
      this.latestByPath.delete(normalizedPath);
      this.onFileChange(latest);
    }, WATCH_DEBOUNCE_MS);

    this.pendingByPath.set(normalizedPath, timeout);
  }

  private resolveRepoRootForPath(filePath: string): string | null {
    for (const repoRoot of this.watchedRoots) {
      const relativePath = relative(repoRoot, filePath).replaceAll("\\", "/");
      if (!relativePath || (!relativePath.startsWith("..") && !relativePath.startsWith("/"))) {
        return repoRoot;
      }
    }
    return null;
  }
}

function isWatchEvent(value: string): value is WatchedFileChange["event"] {
  return (
    value === "add" ||
    value === "addDir" ||
    value === "change" ||
    value === "unlink" ||
    value === "unlinkDir"
  );
}
