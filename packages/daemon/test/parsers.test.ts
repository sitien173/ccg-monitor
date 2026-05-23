import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseHandoverFile } from "../src/parsers/handover.js";
import { parsePhaseFile } from "../src/parsers/phase.js";
import { parsePlanFile } from "../src/parsers/plan.js";
import { parseSessionsFile } from "../src/parsers/sessions.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/plan-sample/docs/plans/sample-plan", import.meta.url),
);

describe("plan parsers", () => {
  it("parses handover fields from frontmatter and sections", async () => {
    const parsed = await parseHandoverFile(join(fixtureRoot, ".handover.md"));
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe("ACTIVE");
    expect(parsed?.current_phase).toBe("2");
    expect(parsed?.next_action).toContain("projector wiring");
    expect(parsed?.read_first).toEqual([
      "docs/plans/sample-plan/PLAN.md",
      "docs/plans/sample-plan/PHASE-2.md",
    ]);
    expect(parsed?.blocked_on).toEqual([]);
  });

  it("parses sessions backend to session map", async () => {
    const parsed = await parseSessionsFile(join(fixtureRoot, ".sessions.json"));
    expect(parsed).toEqual({
      codex: "sess-123",
      gemini: null,
    });
  });

  it("parses phase status owner tasks and files list", async () => {
    const parsed = await parsePhaseFile(join(fixtureRoot, "PHASE-2.md"));
    expect(parsed).not.toBeNull();
    expect(parsed?.phase_id).toBe("2");
    expect(parsed?.title).toBe("Daemon Core");
    expect(parsed?.owner).toBe("codex");
    expect(parsed?.status).toBe("ACTIVE");
    expect(parsed?.tasks).toHaveLength(2);
    expect(parsed?.tasks.filter((task) => task.done)).toHaveLength(1);
    expect(parsed?.files_modified).toEqual([
      "packages/daemon/src/index.ts",
      "packages/daemon/src/db.ts",
    ]);
  });

  it("parses plan phase headings and owners", async () => {
    const parsed = await parsePlanFile(join(fixtureRoot, "PLAN.md"));
    expect(parsed).not.toBeNull();
    expect(parsed?.phases).toEqual([
      { phase_id: "1", title: "Repository Scaffold", owner: "codex" },
      { phase_id: "2", title: "Daemon Core", owner: "codex" },
      { phase_id: "3", title: "Watcher + Projector", owner: "codex" },
      { phase_id: "4", title: "Dashboard UI", owner: "gemini" },
    ]);
  });
});
