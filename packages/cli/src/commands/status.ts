import { parseArgs } from "node:util";

import { readDaemonPort, resolveDaemonBaseUrl } from "../lib/daemon-endpoint.js";

type HealthzPayload = {
  ok?: boolean;
  uptime_s?: number;
  event_count?: number;
};

type ProjectRow = {
  project_id: string;
};

const HELP_TEXT = `Usage: ccgmon status\n\nPrint daemon status summary.`;

export async function runStatusCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const port = await readDaemonPort();
  const baseUrl = await resolveDaemonBaseUrl();

  const [healthzResponse, projectsResponse] = await Promise.all([
    fetch(`${baseUrl}/healthz`),
    fetch(`${baseUrl}/api/projects`),
  ]);

  if (!healthzResponse.ok) {
    throw new Error(`healthz failed with status ${healthzResponse.status}`);
  }
  if (!projectsResponse.ok) {
    throw new Error(`projects failed with status ${projectsResponse.status}`);
  }

  const health = (await healthzResponse.json()) as HealthzPayload;
  const projects = (await projectsResponse.json()) as ProjectRow[];

  process.stdout.write("ccgmon status\n");
  process.stdout.write(`Daemon: ${health.ok ? "up" : "down"}\n`);
  process.stdout.write(`Port: ${port}\n`);
  process.stdout.write(`Uptime: ${health.uptime_s ?? 0}s\n`);
  process.stdout.write(`Projects: ${projects.length}\n`);
  process.stdout.write(`Events: ${health.event_count ?? 0}\n`);
}
