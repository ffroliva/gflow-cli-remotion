# Promo Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node + Remotion pipeline in `gflow-cli-remotion` that records a `gflow` demo tour via OBS, then renders A/B hook variants (master 16:9 / social 9:16 / README GIF) — without modifying the sibling `gflow-cli` library.

**Architecture:** PowerShell-free Node orchestrator drives OBS via `obs-websocket-js`, spawns `gflow` as a child process, consumes its existing structlog dotted events (path b — no new gflow events), writes a Zod-validated `run.json`, then Remotion compositions read manifest + master MP4 and fan out N hooks × 3 formats. Output keepers ship as `gflow-cli-remotion` GitHub Release assets.

**Tech Stack:** Node 20+, TypeScript, Remotion 4.x, React 19, Zod, vitest, obs-websocket-js v5+, ffmpeg + gifski (system binaries), Next.js 16 (for `@remotion/player` preview).

**Reference spec:** [`docs/specs/2026-05-27-promo-pipeline-design.md`](../specs/2026-05-27-promo-pipeline-design.md) — every design decision below traces back there.

---

## File Structure

**Created in this plan** (relative to `gflow-cli-remotion/`):

```
types/
  schema.ts                      Zod RunManifest (single source of truth)
  hooks.ts                       A/B hook array (6 hooks v1)
  promo-prompts.ts               Allowlist of public-safe promo prompts
src/orchestrator/
  obs.ts                         ObsAdapter interface + Real + Fake
  event-stream.ts                stdout JSON parser + filter + redact
  redact.ts                      regex-based PII redactor
  env-scrub.ts                   env-var allow-list for child process
  manifest.ts                    write run.json
  phases.ts                      4-phase tour definition
  profile-check.ts               verify .gflow_browser_strategy marker
src/remotion/promo/
  PromoMaster.tsx                1920×1080 long-form
  PromoSocial.tsx                1080×1920 hook-driven
  ReadmeLoop.tsx                 1280×720 30s GIF source
src/remotion/Root.tsx            MODIFIED (replace MyComp registration)
src/pages/index.tsx              MODIFIED (preview new compositions)
src/remotion/MyComp/             DELETED
scripts/
  record-promo.mjs               orchestrator entrypoint
  render-matrix.mjs              N hooks × 3 formats fan-out
  post-gif.mjs                   ffmpeg + gifski post-process
tests/
  unit/{schema,hooks,prompts,event-stream,redact,env-scrub,
        obs-adapter,manifest,profile-check}.test.ts
  integration/dry-run.test.ts
  integration/error-rows.test.ts
  contract/schema-snapshot.test.ts
  render-smoke/social.test.ts
  helpers/fake-obs-ws.ts
  fixtures/sample-run.json
  fixtures/run-manifest.schema.json
  fixtures/gflow-stdout/{t2i,batch,video,data}.jsonl
  fixtures/fake-gflow/{t2i,batch,video,data}.{cmd,sh}
docs/
  obs-scene.json                 committed OBS scene-collection
  promo.css                      Chrome user-stylesheet
  SETUP.md                       operator runbook + 5-layer ledger
  LIVE_VERIFICATION_promo.md     evidence per release (created in Phase 10)
package.json                     MODIFIED (add deps, remove @remotion/lambda)
tsconfig.json                    MODIFIED (include tests)
vitest.config.ts                 NEW
```

**Cross-repo touches** (in `gflow-cli/`):

> **Amendment (2026-05-28):** Originally this section listed a Python-side
> contract test mirroring the JSON Schema fixture. That cross-repo contract
> was dropped by operator decision — see Task 1.4 amendment below. The
> single-sided snapshot in `gflow-cli-remotion/tests/contract/` is the
> authoritative contract.

(none — gflow-cli is untouched by this plan)

---

## Phase 0 — Project Setup & Prereqs

### Task 0.1: Update package.json deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Modify `package.json`** — add test framework + tooling, pin obs-websocket-js, remove dormant `@remotion/lambda`:

```diff
   "dependencies": {
     "@remotion/bundler": "4.0.467",
     "@remotion/cli": "4.0.467",
     "@remotion/google-fonts": "4.0.467",
-    "@remotion/lambda": "4.0.467",
     "@remotion/paths": "4.0.467",
     "@remotion/player": "4.0.467",
     "@remotion/shapes": "4.0.467",
+    "obs-websocket-js": "^5.0.6",
     "next": "16.2.3",
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "remotion": "4.0.467",
     "zod": "4.3.6"
   },
   "devDependencies": {
+    "@vitest/coverage-v8": "^2.1.0",
+    "tsx": "^4.19.0",
+    "vitest": "^2.1.0",
     ...
   },
   "scripts": {
+    "test": "vitest run",
+    "test:watch": "vitest",
+    "test:contract": "vitest run tests/contract",
+    "test:render-smoke": "vitest run tests/render-smoke",
+    "record-promo": "tsx scripts/record-promo.mjs",
+    "render-matrix": "tsx scripts/render-matrix.mjs",
     ...
   }
```

- [ ] **Step 2: Install** — `pnpm install --frozen-lockfile=false` (lockfile regenerates this once).

- [ ] **Step 3: Verify** — `pnpm test` exits 0 (no tests yet, vitest reports "no tests found"). `pnpm list @remotion/lambda` reports not installed.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add vitest/obs-websocket-js, remove @remotion/lambda"
```

### Task 0.2: tsconfig + vitest config

**Files:**
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Modify `tsconfig.json`** — add tests to `include`:

```json
{
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "tests/**/*.test.ts"]
}
```

- [ ] **Step 2: Create `vitest.config.ts`**:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: { provider: "v8", reporter: ["text", "json", "html"] },
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Verify** — `pnpm test` still exits 0.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json vitest.config.ts
git commit -m "chore(test): configure vitest with TS test discovery"
```

### Task 0.3: Scaffold directories

- [ ] **Step 1: Create empty dirs** (in PowerShell):

```pwsh
New-Item -ItemType Directory -Force types, src\orchestrator, src\remotion\promo, scripts, tests\unit, tests\integration, tests\contract, tests\render-smoke, tests\helpers, tests\fixtures\gflow-stdout, tests\fixtures\fake-gflow | Out-Null
```

- [ ] **Step 2: Commit** (empty dirs need a placeholder if git is strict — drop `.gitkeep`):

```bash
git add types src/orchestrator src/remotion/promo scripts tests
git commit -m "chore(scaffold): create promo pipeline directory structure"
```

---

## Phase 1 — Contract (Zod schema + cross-repo fixture)

### Task 1.1: Write failing test for RunManifest schema

**Files:**
- Create: `tests/unit/schema.test.ts`
- Create: `tests/fixtures/sample-run.json`

- [ ] **Step 1: Create `tests/fixtures/sample-run.json`** — a known-good fixture:

```json
{
  "schemaVersion": 1,
  "runId": "01HZ7K8M3PVQTYK7A4N9XJ5MW2",
  "startedAtIso": "2026-05-27T14:32:11.123Z",
  "startedAtMonotonic": 0,
  "profile": "promo-denon82",
  "env": {
    "gflowVersion": "0.9.1",
    "nodeVersion": "20.11.0",
    "obsVersion": "30.0.0",
    "os": "win32-10.0.26200",
    "browserStrategy": "chrome"
  },
  "phases": [
    {
      "kind": "t2i", "cmd": "gflow image t2i ...",
      "startedMs": 0, "endedMs": 60000, "exitCode": 0,
      "artifacts": ["image-001.png"], "events": []
    }
  ],
  "recording": {
    "source": "obs",
    "masterPath": "C:\\Users\\<user-home>\\gflow-output\\promo\\test-001\\master.mp4",
    "width": 1920, "height": 1080, "fps": 30, "durationMs": 60000
  }
}
```

- [ ] **Step 2: Create `tests/unit/schema.test.ts`** — failing test:

```ts
import { describe, it, expect } from "vitest";
import { RunManifest } from "../../types/schema";
import sample from "../fixtures/sample-run.json";

describe("RunManifest schema", () => {
  it("accepts a known-good fixture", () => {
    const parsed = RunManifest.parse(sample);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.phases).toHaveLength(1);
  });
  it("rejects missing required field", () => {
    const { schemaVersion: _drop, ...bad } = sample;
    expect(() => RunManifest.parse(bad)).toThrow();
  });
  it("rejects unknown top-level extra key", () => {
    expect(() => RunManifest.parse({ ...sample, extra: 1 })).toThrow();
  });
  it("rejects empty phases array", () => {
    expect(() => RunManifest.parse({ ...sample, phases: [] })).toThrow();
  });
});
```

- [ ] **Step 3: Run — verify FAIL**: `pnpm test tests/unit/schema.test.ts` → fails with "Cannot find module ../../types/schema".

### Task 1.2: Implement RunManifest

**Files:**
- Create: `types/schema.ts`

- [ ] **Step 1: Create `types/schema.ts`**:

```ts
import { z } from "zod";

export const PhaseKind = z.enum(["t2i", "batch", "video", "data"]);
export type PhaseKind = z.infer<typeof PhaseKind>;

export const StructLogEvent = z.object({
  ts: z.string(),
  event: z.string(),
  level: z.string(),
  data: z.record(z.string(), z.unknown()),
}).strict();

export const Phase = z.object({
  kind: PhaseKind,
  cmd: z.string(),
  startedMs: z.number().int(),
  endedMs: z.number().int(),
  exitCode: z.number().int(),
  artifacts: z.array(z.string()),
  events: z.array(StructLogEvent).default([]),
}).strict();

export const Recording = z.object({
  source: z.literal("obs"),
  masterPath: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  fps: z.number().int(),
  durationMs: z.number().int(),
}).strict();

export const Env = z.object({
  gflowVersion: z.string(),
  nodeVersion: z.string(),
  obsVersion: z.string(),
  os: z.string(),
  browserStrategy: z.literal("chrome"),
}).strict();

export const RunManifest = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  startedAtIso: z.string(),
  startedAtMonotonic: z.number(),
  profile: z.string(),
  env: Env,
  phases: z.array(Phase).min(1),
  recording: Recording,
}).strict();

export type RunManifest = z.infer<typeof RunManifest>;
```

- [ ] **Step 2: Run — verify PASS**: `pnpm test tests/unit/schema.test.ts` → 4/4 pass.

- [ ] **Step 3: Commit**

```bash
git add types/schema.ts tests/unit/schema.test.ts tests/fixtures/sample-run.json
git commit -m "feat(types): RunManifest Zod schema with strict validation"
```

### Task 1.3: Export JSON Schema fixture

**Files:**
- Create: `tests/contract/schema-snapshot.test.ts`
- Create: `tests/fixtures/run-manifest.schema.json` (generated)

- [ ] **Step 1: Create `tests/contract/schema-snapshot.test.ts`**:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RunManifest } from "../../types/schema";

describe("schema-snapshot contract", () => {
  it("z.toJSONSchema matches committed fixture", () => {
    const generated = z.toJSONSchema(RunManifest);
    const committed = JSON.parse(
      readFileSync(join(__dirname, "../fixtures/run-manifest.schema.json"), "utf-8")
    );
    expect(generated).toEqual(committed);
  });
});
```

> **Amendment (2026-05-28):** Original plan used `zod-to-json-schema@^3.23.0`, which silently emits an empty `{ $ref, definitions: { RunManifest: {} } }` on a Zod 4 schema (the 3.x library targets Zod 3's internal API). Switched to Zod 4's built-in `z.toJSONSchema()`. Dep removed from `package.json`.

- [ ] **Step 2: Run — verify FAIL**: fixture file missing.

- [ ] **Step 3: Generate fixture** — one-shot Node snippet:

```pwsh
pnpm tsx -e "import { z } from 'zod'; import { RunManifest } from './types/schema'; import { writeFileSync } from 'node:fs'; writeFileSync('tests/fixtures/run-manifest.schema.json', JSON.stringify(z.toJSONSchema(RunManifest), null, 2) + '\n');"
```

- [ ] **Step 4: Run — verify PASS**: `pnpm test:contract` → 1/1 pass.

- [ ] **Step 5: Commit**

```bash
git add tests/contract/schema-snapshot.test.ts tests/fixtures/run-manifest.schema.json
git commit -m "feat(contract): commit JSON Schema fixture + snapshot test"
```

### Task 1.4: ~~Cross-repo fixture in gflow-cli~~ — DROPPED (2026-05-28)

> **Amendment (2026-05-28):** Dropped permanently by operator. Rationale:
> gflow-cli stays untouched by the promo pipeline; the gflow-cli-remotion-side
> `tests/contract/schema-snapshot.test.ts` (Task 1.3) is the sole contract.
> If the schema drifts in `types/schema.ts` without regenerating the fixture,
> the snapshot test will fail there — sufficient enforcement without a
> second-language mirror. Steps below kept for historical reference.



**Files:**
- Create: `../gflow-cli/tests/fixtures/run-manifest.schema.json`
- Create: `../gflow-cli/tests/contracts/test_run_manifest_schema.py`

- [ ] **Step 1: Copy fixture**:

```pwsh
Copy-Item tests\fixtures\run-manifest.schema.json ..\gflow-cli\tests\fixtures\run-manifest.schema.json
```

- [ ] **Step 2: Create gflow-cli-side validator** — `../gflow-cli/tests/contracts/test_run_manifest_schema.py`:

```python
import json
from pathlib import Path
import jsonschema
import pytest

SCHEMA = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "run-manifest.schema.json").read_text()
)

@pytest.mark.e2e_data
def test_synthetic_manifest_validates():
    synthetic = {
        "schemaVersion": 1,
        "runId": "01HZ7K8M3PVQTYK7A4N9XJ5MW2",
        "startedAtIso": "2026-05-27T14:32:11.123Z",
        "startedAtMonotonic": 0,
        "profile": "promo-denon82",
        "env": {
            "gflowVersion": "0.9.1",
            "nodeVersion": "20.11.0",
            "obsVersion": "30.0.0",
            "os": "win32-10.0.26200",
            "browserStrategy": "chrome",
        },
        "phases": [{
            "kind": "t2i", "cmd": "gflow image t2i ...",
            "startedMs": 0, "endedMs": 1000, "exitCode": 0,
            "artifacts": [], "events": [],
        }],
        "recording": {
            "source": "obs", "masterPath": "<path>",
            "width": 1920, "height": 1080, "fps": 30, "durationMs": 1000,
        },
    }
    jsonschema.validate(synthetic, SCHEMA)
```

- [ ] **Step 3: Verify gflow-cli side** — run from `gflow-cli/`:
  `.venv\Scripts\python.exe -m pytest tests\contracts\test_run_manifest_schema.py -v`
  Expected: 1 passed.

- [ ] **Step 4: Commit in gflow-cli on a feature branch** — `feature/promo-pipeline-contract-fixture`:

```bash
cd ..\gflow-cli
git checkout -b feature/promo-pipeline-contract-fixture
git add tests/fixtures/run-manifest.schema.json tests/contracts/test_run_manifest_schema.py
git commit -m "test(contracts): cross-repo schema fixture for promo pipeline"
cd ..\gflow-cli-remotion
```

(Hold the cross-repo PR until Phase 10 — see Task 10.8.)

---

## Phase 2 — Redaction & Env Scrub

### Task 2.1: Tests for redact.ts

**Files:**
- Create: `tests/unit/redact.test.ts`

- [ ] **Step 1: Write failing tests**:

```ts
import { describe, it, expect } from "vitest";
import { redact } from "../../src/orchestrator/redact";

describe("redact()", () => {
  it("strips email", () => {
    expect(redact("contact me at foo@bar.com")).toBe("contact me at <email>");
  });
  it("strips Google OAuth refresh token", () => {
    expect(redact("token=1//abc123")).toBe("token=<refresh-token>");
  });
  it("strips JWT", () => {
    expect(redact("Authorization: Bearer eyJa.eyJb.cccc")).toBe("Authorization: Bearer <jwt>");
  });
  it("strips Windows user path", () => {
    expect(redact("at C:\\Users\\flavio\\AppData\\Local"))
      .toBe("at <user-home>\\AppData\\Local");
  });
  it("strips POSIX user path", () => {
    expect(redact("at /Users/flavio/Library/")).toBe("at /<user-home>/Library/");
  });
  it("leaves harmless content alone", () => {
    expect(redact("phase=t2i exit=0 ms=1234")).toBe("phase=t2i exit=0 ms=1234");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**.

### Task 2.2: Implement redact.ts

**Files:**
- Create: `src/orchestrator/redact.ts`

- [ ] **Step 1: Create `src/orchestrator/redact.ts`**:

```ts
const RULES: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.\w+/g, "<email>"],
  [/1\/\/[\w-]+/g, "<refresh-token>"],
  [/ya29\.[\w.-]+/g, "<access-token>"],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<jwt>"],
  [/gAAAAAB[\w-]+/g, "<fernet-token>"],
  [/sapisidhash=[\w-]+/g, "sapisidhash=<redacted>"],
  [/[A-Z]:\\Users\\[^\\]+\\/g, "<user-home>\\"],
  [/\/(Users|home)\/[^/]+\//g, "/<user-home>/"],
];

export function redact(s: string): string {
  let out = s;
  for (const [re, repl] of RULES) out = out.replace(re, repl);
  return out;
}

export function redactDeep<T>(v: T): T {
  if (typeof v === "string") return redact(v) as unknown as T;
  if (Array.isArray(v)) return v.map(redactDeep) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object)) out[k] = redactDeep(val);
    return out as T;
  }
  return v;
}
```

- [ ] **Step 2: Run — verify PASS**: `pnpm test tests/unit/redact.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/orchestrator/redact.ts tests/unit/redact.test.ts
git commit -m "feat(orchestrator): redact() regex scrubber for PII in event stream"
```

### Task 2.3 + 2.4: env-scrub (failing test → impl → commit)

**Files:**
- Create: `tests/unit/env-scrub.test.ts`
- Create: `src/orchestrator/env-scrub.ts`

- [ ] **Step 1: Write failing test**:

```ts
import { describe, it, expect } from "vitest";
import { scrubEnv } from "../../src/orchestrator/env-scrub";

describe("scrubEnv()", () => {
  it("keeps PATH and USERPROFILE", () => {
    const out = scrubEnv({ PATH: "/usr/bin", USERPROFILE: "C:\\Users\\f" });
    expect(out.PATH).toBe("/usr/bin");
    expect(out.USERPROFILE).toBe("C:\\Users\\f");
  });
  it("strips OBS_WS_PASSWORD", () => {
    const out = scrubEnv({ PATH: "/usr/bin", OBS_WS_PASSWORD: "secret" });
    expect(out.OBS_WS_PASSWORD).toBeUndefined();
  });
  it("strips arbitrary *_TOKEN and *_SECRET", () => {
    const out = scrubEnv({ PATH: "/usr/bin", GH_TOKEN: "x", FOO_SECRET: "y" });
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.FOO_SECRET).toBeUndefined();
  });
  it("keeps GFLOW_CLI_PROFILE", () => {
    const out = scrubEnv({ PATH: "/", GFLOW_CLI_PROFILE: "promo-x" });
    expect(out.GFLOW_CLI_PROFILE).toBe("promo-x");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**.

- [ ] **Step 3: Create `src/orchestrator/env-scrub.ts`**:

```ts
const ALLOW_LIST = new Set([
  "PATH", "PATHEXT", "HOME", "USERPROFILE", "APPDATA",
  "LOCALAPPDATA", "SystemRoot", "TEMP", "TMP",
  "GFLOW_CLI_PROFILE", "GFLOW_CLI_OUT_DIR", "GFLOW_CLI_LOG_LEVEL",
]);

const FORBIDDEN = [/^OBS_WS/, /TOKEN$/, /SECRET$/, /PASSWORD$/, /API_KEY$/, /GH_TOKEN/];

export function scrubEnv(src: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined) continue;
    if (FORBIDDEN.some((re) => re.test(k))) continue;
    if (ALLOW_LIST.has(k)) out[k] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run — verify PASS**.

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator/env-scrub.ts tests/unit/env-scrub.test.ts
git commit -m "feat(orchestrator): scrubEnv() allow-list for child process env"
```

---

## Phase 3 — OBS Adapter

### Task 3.1: ObsAdapter interface + Fake

**Files:**
- Create: `tests/unit/obs-adapter.test.ts`
- Create: `src/orchestrator/obs.ts`

- [ ] **Step 1: Write failing test**:

```ts
import { describe, it, expect } from "vitest";
import { FakeObsAdapter, type ObsAdapter } from "../../src/orchestrator/obs";

describe("FakeObsAdapter", () => {
  it("records start/stop calls in order", async () => {
    const fake = new FakeObsAdapter();
    await fake.connect();
    await fake.startRecording("/tmp/master.mp4");
    await fake.stopRecording();
    await fake.disconnect();
    expect(fake.calls).toEqual([
      ["connect"], ["startRecording", "/tmp/master.mp4"], ["stopRecording"], ["disconnect"],
    ]);
  });
  it("conforms to ObsAdapter interface", () => {
    const fake: ObsAdapter = new FakeObsAdapter();
    expect(typeof fake.connect).toBe("function");
    expect(typeof fake.startRecording).toBe("function");
    expect(typeof fake.stopRecording).toBe("function");
    expect(typeof fake.disconnect).toBe("function");
  });
});
```

- [ ] **Step 2: Create `src/orchestrator/obs.ts`**:

```ts
export interface ObsAdapter {
  connect(): Promise<void>;
  startRecording(outputPath: string): Promise<void>;
  stopRecording(): Promise<void>;
  disconnect(): Promise<void>;
}

export class FakeObsAdapter implements ObsAdapter {
  public calls: Array<[string, ...unknown[]]> = [];
  async connect() { this.calls.push(["connect"]); }
  async startRecording(p: string) { this.calls.push(["startRecording", p]); }
  async stopRecording() { this.calls.push(["stopRecording"]); }
  async disconnect() { this.calls.push(["disconnect"]); }
}
```

- [ ] **Step 3: Run — verify PASS** and commit.

### Task 3.2: RealObsAdapter (obs-websocket-js)

**Files:**
- Modify: `src/orchestrator/obs.ts`
- Create: `tests/helpers/fake-obs-ws.ts`

- [ ] **Step 1: Append to `src/orchestrator/obs.ts`**:

```ts
import OBSWebSocket from "obs-websocket-js";

export class RealObsAdapter implements ObsAdapter {
  private obs = new OBSWebSocket();
  constructor(
    private url = "ws://127.0.0.1:4455",
    private password = process.env.OBS_WS_PASSWORD,
  ) {
    if (!this.password) throw new Error("OBS_WS_PASSWORD env var required");
  }
  async connect() {
    await this.obs.connect(this.url, this.password!, { rpcVersion: 1 });
  }
  async startRecording(outputPath: string) {
    // obs-websocket v5 uses scene/profile-level output paths;
    // setting the file path requires SetProfileParameter.
    await this.obs.call("SetProfileParameter", {
      parameterCategory: "AdvOut",
      parameterName: "FFFilePath",
      parameterValue: outputPath,
    } as never);
    await this.obs.call("StartRecord");
  }
  async stopRecording() { await this.obs.call("StopRecord"); }
  async disconnect() { await this.obs.disconnect(); }
}
```

- [ ] **Step 2: Append failing test** to `tests/unit/obs-adapter.test.ts`:

```ts
import { RealObsAdapter } from "../../src/orchestrator/obs";

describe("RealObsAdapter", () => {
  it("refuses to construct without OBS_WS_PASSWORD", () => {
    const prev = process.env.OBS_WS_PASSWORD;
    delete process.env.OBS_WS_PASSWORD;
    expect(() => new RealObsAdapter()).toThrow(/OBS_WS_PASSWORD/);
    if (prev) process.env.OBS_WS_PASSWORD = prev;
  });
});
```

- [ ] **Step 3: Run — verify PASS**.

- [ ] **Step 4: Commit**

```bash
git add src/orchestrator/obs.ts tests/unit/obs-adapter.test.ts
git commit -m "feat(orchestrator): RealObsAdapter wrapping obs-websocket-js v5+"
```

---

## Phase 4 — Event Stream Parser

### Task 4.1: Fixtures + failing test

**Files:**
- Create: `tests/fixtures/gflow-stdout/t2i.jsonl`
- Create: `tests/unit/event-stream.test.ts`

- [ ] **Step 1: Capture a real gflow `--dry-run` stdout sample** (run once, save):

```pwsh
cd ..\gflow-cli
.venv\Scripts\python.exe -m gflow_cli image t2i "test prompt" --dry-run 2>$null `
  | Out-File -Encoding utf8 ..\gflow-cli-remotion\tests\fixtures\gflow-stdout\t2i.jsonl
cd ..\gflow-cli-remotion
```

(If `--dry-run` doesn't exist yet on the t2i command, hand-author a 5-line JSONL using existing event names like `ui_automation.entered_editor`, `error_raised`, etc.)

- [ ] **Step 2: Write failing test**:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEventStream } from "../../src/orchestrator/event-stream";

describe("parseEventStream()", () => {
  const lines = readFileSync(join(__dirname, "../fixtures/gflow-stdout/t2i.jsonl"), "utf-8")
    .trim().split("\n");

  it("parses JSON lines and drops malformed ones", () => {
    const result = parseEventStream([...lines, "not-json"]);
    expect(result.length).toBeLessThanOrEqual(lines.length);
  });
  it("filters to allowlist event names", () => {
    const result = parseEventStream(lines);
    for (const e of result) {
      expect(e.event).toMatch(/^(ui_automation|ui_automation_video|image_batch|reference_attached|error_raised)/);
    }
  });
  it("redacts emails in event data", () => {
    const result = parseEventStream([JSON.stringify({
      ts: "2026-05-27T00:00:00Z",
      event: "error_raised",
      level: "error",
      data: { msg: "user foo@bar.com failed" },
    })]);
    expect(result[0]!.data.msg).toBe("user <email> failed");
  });
});
```

### Task 4.2: Implement event-stream.ts

**Files:**
- Create: `src/orchestrator/event-stream.ts`

- [ ] **Step 1: Create**:

```ts
import { redactDeep } from "./redact";

const ALLOW_RE = /^(ui_automation|ui_automation_video|image_batch|reference_attached|error_raised)/;

export interface EventEnvelope {
  ts: string;
  event: string;
  level: string;
  data: Record<string, unknown>;
}

export function parseEventStream(lines: string[]): EventEnvelope[] {
  const out: EventEnvelope[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.event !== "string") continue;
      if (!ALLOW_RE.test(obj.event)) continue;
      out.push({
        ts: String(obj.ts ?? ""),
        event: obj.event,
        level: String(obj.level ?? "info"),
        data: redactDeep(obj.data ?? {}) as Record<string, unknown>,
      });
    } catch {
      // §9.6: exception-safe — log+skip, never crash the orchestrator pipe.
      continue;
    }
  }
  return out;
}
```

- [ ] **Step 2: Run — verify PASS**, commit.

---

## Phase 5 — Phases, Manifest & Orchestrator

### Task 5.1 + 5.2: profile-check.ts (marker file)

**Files:**
- Create: `tests/unit/profile-check.test.ts`
- Create: `src/orchestrator/profile-check.ts`

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyChromeProfile } from "../../src/orchestrator/profile-check";

describe("verifyChromeProfile()", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "promo-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("passes when marker content is exactly 'chrome'", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "chrome");
    expect(() => verifyChromeProfile(tmp)).not.toThrow();
  });
  it("throws when marker missing", () => {
    expect(() => verifyChromeProfile(tmp)).toThrow(/marker file/);
  });
  it("throws when marker says chromium", () => {
    writeFileSync(join(tmp, ".gflow_browser_strategy"), "chromium");
    expect(() => verifyChromeProfile(tmp)).toThrow(/expected 'chrome'/);
  });
});
```

- [ ] **Step 2: Implement**:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function verifyChromeProfile(profileDir: string): void {
  const path = join(profileDir, ".gflow_browser_strategy");
  let content: string;
  try { content = readFileSync(path, "utf-8").trim(); }
  catch { throw new Error(`marker file missing at ${path}`); }
  if (content !== "chrome") {
    throw new Error(`marker file at ${path} contains '${content}', expected 'chrome'`);
  }
}
```

- [ ] **Step 3: Run — pass, commit**.

### Task 5.3 + 5.4: phases.ts

**Files:**
- Create: `src/orchestrator/phases.ts`
- Create: `tests/unit/phases.test.ts`

- [ ] **Step 1: Implement** (definition-only; spawning happens in `record-promo.mjs`):

```ts
import type { PhaseKind } from "../../types/schema";

export interface PhaseDef {
  kind: PhaseKind;
  cmd: string;
  args: (ctx: { prompt: string; profile: string; outDir: string }) => string[];
  maxDurationMs: number;
  expectedArtifactGlob: RegExp;
}

export const PHASES: readonly PhaseDef[] = [
  {
    kind: "t2i", cmd: "gflow",
    args: ({ prompt, profile, outDir }) => [
      "image", "t2i", prompt, "--aspect", "16:9", "--profile", profile, "--out", outDir,
    ],
    maxDurationMs: 180_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "batch", cmd: "gflow",
    args: ({ profile, outDir }) => [
      "run", "--config", "examples/promo-batch.json", "--profile", profile, "--out", outDir,
    ],
    maxDurationMs: 360_000,
    expectedArtifactGlob: /\.(png|jpe?g)$/i,
  },
  {
    kind: "video", cmd: "gflow",
    args: ({ prompt, profile, outDir }) => [
      "video", "t2v", prompt, "--model", "veo3", "--profile", profile, "--out", outDir,
    ],
    maxDurationMs: 420_000,
    expectedArtifactGlob: /\.mp4$/i,
  },
  {
    kind: "data", cmd: "gflow",
    args: () => ["data", "list", "images", "--limit", "6"],
    maxDurationMs: 30_000,
    expectedArtifactGlob: /^$/, // no artifacts; stdout-only
  },
];
```

- [ ] **Step 2: Test**:

```ts
import { describe, it, expect } from "vitest";
import { PHASES } from "../../src/orchestrator/phases";
describe("PHASES", () => {
  it("defines exactly 4 phases", () => { expect(PHASES).toHaveLength(4); });
  it("each phase has unique kind", () => {
    const kinds = PHASES.map((p) => p.kind);
    expect(new Set(kinds).size).toBe(4);
  });
});
```

- [ ] **Step 3: Pass, commit**.

### Task 5.5 + 5.6: manifest.ts

**Files:**
- Create: `src/orchestrator/manifest.ts`
- Create: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Test (round-trip)**:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeManifest } from "../../src/orchestrator/manifest";
import { RunManifest } from "../../types/schema";
import sample from "../fixtures/sample-run.json";

describe("writeManifest()", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "promo-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("writes a Zod-valid run.json", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    const bytes = readFileSync(join(dir, "run.json"), "utf-8");
    const round = RunManifest.parse(JSON.parse(bytes));
    expect(round).toEqual(parsed);
  });
  it("refuses to overwrite an existing run.json without force", () => {
    const parsed = RunManifest.parse(sample);
    writeManifest(dir, parsed);
    expect(() => writeManifest(dir, parsed)).toThrow(/already exists/);
  });
});
```

- [ ] **Step 2: Implement**:

```ts
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RunManifest, type RunManifest as RunManifestT } from "../../types/schema";

export function writeManifest(runDir: string, manifest: RunManifestT, opts: { force?: boolean } = {}): void {
  const path = join(runDir, "run.json");
  if (existsSync(path) && !opts.force) {
    throw new Error(`run.json already exists at ${path}; pass --force to overwrite`);
  }
  // Validate one more time before write — defense against in-memory corruption.
  const validated = RunManifest.parse(manifest);
  writeFileSync(path, JSON.stringify(validated, null, 2) + "\n", "utf-8");
}
```

- [ ] **Step 3: Pass, commit**.

### Task 5.7: record-promo.mts

> **Amendment (2026-05-28):** Two corrections from execution:
> 1. **Filename `.mjs` → `.mts`** — Node 22 strictly treats `.mjs` as ESM
>    JavaScript and rejects TypeScript syntax (`type`-only imports, generics,
>    `as` casts) at parse time, before tsx can transform. `.mts` is
>    TypeScript ESM source; tsx handles it natively and the
>    `pnpm record-promo` script in `package.json` was updated to match.
> 2. **Profile prefix not stripped** — the original snippet built the
>    profile dir as `profile_${profile.replace(/^promo-/, "")}`, but the
>    actual gflow-cli `auth.profile_dir()` uses the **full** profile name,
>    including the `promo-` prefix: `profile_promo-test`, not
>    `profile_test`. Stripping would point at the wrong directory and the
>    chrome-marker check would correctly fail — but with a confusing
>    "marker missing" instead of "wrong profile prefix".

**Files:**
- Create: `scripts/record-promo.mts`

- [ ] **Step 1: Implement** (the entrypoint — wire everything together):

```ts
#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hrtime } from "node:process";
import { ulid } from "ulid"; // need pnpm add ulid (small dep)
import { parseArgs } from "node:util";
import { RealObsAdapter, FakeObsAdapter, type ObsAdapter } from "../src/orchestrator/obs";
import { scrubEnv } from "../src/orchestrator/env-scrub";
import { parseEventStream } from "../src/orchestrator/event-stream";
import { verifyChromeProfile } from "../src/orchestrator/profile-check";
import { writeManifest } from "../src/orchestrator/manifest";
import { PHASES } from "../src/orchestrator/phases";
import { RunManifest } from "../types/schema";

const { values } = parseArgs({
  options: {
    profile: { type: "string" },
    "run-id": { type: "string" },
    prompt: { type: "string", default: "a quiet mountain lake at dawn, cinematic" },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});
if (!values.profile?.startsWith("promo-")) {
  console.error("--profile must start with 'promo-' (§9.1 enforced)");
  process.exit(2);
}
const runId = values["run-id"] ?? ulid();
const profile = values.profile;
const prompt = values.prompt!;
const dryRun = values["dry-run"]!;
const outDir = join(process.env.USERPROFILE ?? process.env.HOME!, "gflow-output", "promo", runId);
mkdirSync(outDir, { recursive: true });

const profileDir = join(
  process.env.LOCALAPPDATA ?? process.env.HOME!,
  "ffroliva", "gflow-cli", `profile_${profile}`, // full name; do NOT strip prefix
);
verifyChromeProfile(profileDir);

const obs: ObsAdapter = dryRun ? new FakeObsAdapter() : new RealObsAdapter();
const masterPath = join(outDir, "master.mp4");

const startedAtIso = new Date().toISOString();
const t0 = hrtime.bigint();
const nowMs = () => Number((hrtime.bigint() - t0) / 1_000_000n);

await obs.connect();
await obs.startRecording(masterPath);

const phaseRecords: any[] = [];
for (const phase of PHASES) {
  const args = phase.args({ prompt, profile, outDir });
  const cmdLine = `${phase.cmd} ${args.join(" ")}`;
  const startedMs = nowMs();
  const eventLines: string[] = [];
  const cmdToRun = dryRun
    ? join("tests", "fixtures", "fake-gflow", process.platform === "win32" ? `${phase.kind}.cmd` : `${phase.kind}.sh`)
    : phase.cmd;
  const child = spawn(cmdToRun, dryRun ? [] : args, {
    env: scrubEnv(process.env),
    stdio: ["ignore", "pipe", "inherit"],
  });
  child.stdout.on("data", (b) => {
    for (const line of b.toString("utf-8").split("\n")) {
      if (line.trim()) eventLines.push(line);
    }
  });
  const exitCode: number = await new Promise((res, rej) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rej(new Error(`phase ${phase.kind} exceeded maxDurationMs=${phase.maxDurationMs}`));
    }, phase.maxDurationMs);
    child.on("exit", (code) => { clearTimeout(timer); res(code ?? 1); });
  });
  const endedMs = nowMs();
  const artifacts = readdirSync(outDir)
    .filter((f) => phase.expectedArtifactGlob.test(f));
  phaseRecords.push({
    kind: phase.kind, cmd: cmdLine,
    startedMs, endedMs, exitCode,
    artifacts, events: parseEventStream(eventLines),
  });
  if (exitCode !== 0) break;
}

await obs.stopRecording();
await obs.disconnect();

const manifest = RunManifest.parse({
  schemaVersion: 1,
  runId, startedAtIso, startedAtMonotonic: 0, profile,
  env: {
    gflowVersion: process.env.GFLOW_VERSION ?? "unknown",
    nodeVersion: process.version,
    obsVersion: process.env.OBS_VERSION ?? "unknown",
    os: `${process.platform}-${process.arch}`,
    browserStrategy: "chrome",
  },
  phases: phaseRecords,
  recording: { source: "obs", masterPath, width: 1920, height: 1080, fps: 30, durationMs: nowMs() },
});
writeManifest(outDir, manifest, { force: values.force });
console.log(`✓ recorded run.json + master.mp4 at ${outDir}`);
process.exit(0);
```

Note the `ulid` dependency — add `pnpm add ulid` in this task and update lockfile.

- [ ] **Step 2: Smoke-run dry mode** — `pnpm record-promo --profile promo-test --run-id smoke-001 --dry-run`. (Requires fake-gflow stubs from Task 5.9.)

### Task 5.8: Error-row tests

**Files:**
- Create: `tests/integration/error-rows.test.ts`

- [ ] **Step 1: Tests for each §7 row** — abridged structure:

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const RECORD = ["pnpm", "record-promo"];

describe("error rows", () => {
  it("rejects --profile that doesn't start with promo-", () => {
    expect(() => execFileSync("pnpm", ["record-promo", "--profile", "denon82"], { stdio: "pipe" }))
      .toThrow();
  });
  it("aborts when .gflow_browser_strategy says chromium", () => {
    // arrange a tmp profile dir with marker=chromium, point GFLOW_CLI_PROFILE there
    // … (similar pattern; expect throw)
  });
  // additional rows: obs-ws unreachable, gflow not on PATH, phase timeout, idempotent re-run.
});
```

- [ ] **Step 2: Implement test bodies** — each ~10 lines following the pattern above. One test per row in spec §7.

- [ ] **Step 3: Pass, commit**.

### Task 5.9: Mock integration (dry-run end-to-end)

**Files:**
- Create: `tests/fixtures/fake-gflow/t2i.cmd`, `t2i.sh`, `batch.cmd`, `batch.sh`, `video.cmd`, `video.sh`, `data.cmd`, `data.sh`
- Create: `tests/integration/dry-run.test.ts`

- [ ] **Step 1: Write a Windows stub** `tests/fixtures/fake-gflow/t2i.cmd`:

```cmd
@echo off
type "%~dp0..\gflow-stdout\t2i.jsonl"
ffmpeg -y -f lavfi -i color=c=black:s=16x16:d=0.1 -frames:v 1 "%~3\fake-t2i.png" 2>nul
exit /b 0
```

- [ ] **Step 2: Equivalent POSIX** `t2i.sh`:

```sh
#!/bin/sh
cat "$(dirname "$0")/../gflow-stdout/t2i.jsonl"
ffmpeg -y -f lavfi -i color=c=black:s=16x16:d=0.1 -frames:v 1 "$3/fake-t2i.png" 2>/dev/null
exit 0
```

(Three more pairs for batch/video/data; video stub emits a 1-frame `.mp4` instead.)

- [ ] **Step 3: Integration test**:

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunManifest } from "../../types/schema";

describe("dry-run end-to-end", () => {
  it("produces a valid run.json + a master.mp4 stub", () => {
    const runId = "dry-" + Date.now();
    execFileSync("pnpm", ["record-promo", "--profile", "promo-test", "--run-id", runId, "--dry-run"], { stdio: "inherit" });
    const dir = join(process.env.USERPROFILE ?? process.env.HOME!, "gflow-output", "promo", runId);
    expect(existsSync(join(dir, "run.json"))).toBe(true);
    RunManifest.parse(JSON.parse(readFileSync(join(dir, "run.json"), "utf-8")));
  });
});
```

- [ ] **Step 4: Pass, commit Phase 5**.

---

## Phase 6 — Remotion Compositions

### Task 6.1: Remove MyComp/, scaffold promo/

- [ ] **Step 1: Delete `src/remotion/MyComp/`** entirely (NextLogo, Rings, TextFade, Main, etc.).

- [ ] **Step 2: Commit the deletion** so the next step's additions are clean.

```bash
git rm -r src/remotion/MyComp
git commit -m "chore(remotion): remove template MyComp/ ahead of promo compositions"
```

### Task 6.2: PromoMaster.tsx

**Files:**
- Create: `src/remotion/promo/PromoMaster.tsx`

- [ ] **Step 1: Implement** (skeleton; design polish iterated in Studio):

```tsx
import { AbsoluteFill, Sequence, Video, useVideoConfig } from "remotion";
import { z } from "zod";
import { RunManifest } from "../../../types/schema";

export const promoMasterSchema = z.object({
  runDir: z.string(),       // absolute path to gflow-output/promo/<runId>
  hookId: z.string().optional(),
  hookTitle: z.string().optional(),
});

export const PromoMaster: React.FC<z.infer<typeof promoMasterSchema>> = ({ runDir, hookTitle }) => {
  const { width, height } = useVideoConfig();
  const masterUrl = `file://${runDir}/master.mp4`;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <h1 style={{ color: "white", fontSize: 96 }}>{hookTitle ?? "gflow"}</h1>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={90}>
        <Video src={masterUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Manual visual check** — `pnpm remotion studio` (or `pnpm dev` for Next preview), scrub through.

- [ ] **Step 3: Commit**.

### Tasks 6.3 + 6.4: PromoSocial.tsx + ReadmeLoop.tsx

Same pattern as 6.2; 1080×1920 + hook-driven; 1280×720 30s loop. (Concrete code mirrors 6.2's structure — vertical orientation, hook in first 90 frames, montage timestamps drawn from `manifest.phases[*].startedMs`.) Commit after each composition compiles and previews cleanly.

### Task 6.5 + 6.6: Wire Root.tsx + index.tsx

- [ ] **Step 1: Replace `src/remotion/Root.tsx`**:

```tsx
import { Composition } from "remotion";
import { PromoMaster, promoMasterSchema } from "./promo/PromoMaster";
import { PromoSocial, promoSocialSchema } from "./promo/PromoSocial";
import { ReadmeLoop, readmeLoopSchema } from "./promo/ReadmeLoop";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PromoMaster" component={PromoMaster}
      durationInFrames={2700} fps={30} width={1920} height={1080}
      schema={promoMasterSchema}
      defaultProps={{ runDir: "", hookId: undefined, hookTitle: undefined }} />
    <Composition id="PromoSocial" component={PromoSocial}
      durationInFrames={1800} fps={30} width={1080} height={1920}
      schema={promoSocialSchema} defaultProps={{ runDir: "", hookId: "h1" }} />
    <Composition id="ReadmeLoop" component={ReadmeLoop}
      durationInFrames={900} fps={30} width={1280} height={720}
      schema={readmeLoopSchema} defaultProps={{ runDir: "" }} />
  </>
);
```

- [ ] **Step 2: Replace the demo page in `src/pages/index.tsx`** with a `@remotion/player` preview that toggles between the three compositions and the hooks list. (Concrete code: render `<Player component={PromoSocial} inputProps={{...}}/>` plus a hook-picker dropdown.)

- [ ] **Step 3: Commit Phase 6**.

### Task 6.7: Render smoke test

**Files:**
- Create: `tests/render-smoke/social.test.ts`

- [ ] **Step 1: Implement** — render 30 frames headless:

```ts
import { describe, it, expect } from "vitest";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { statSync } from "node:fs";

describe("render smoke", () => {
  it("renders 30 frames of PromoSocial", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "render-"));
    const bundled = await bundle({ entryPoint: "./src/remotion/index.ts" });
    const composition = await selectComposition({
      serveUrl: bundled, id: "PromoSocial",
      inputProps: { runDir: join(__dirname, "../fixtures/sample-run"), hookId: "h1" },
    });
    const output = join(outDir, "smoke.mp4");
    await renderMedia({
      composition, serveUrl: bundled, codec: "h264",
      outputLocation: output, inputProps: { runDir: outDir, hookId: "h1" },
      frameRange: [0, 30], chromiumOptions: { gl: "swiftshader" },
    });
    expect(statSync(output).size).toBeGreaterThan(0);
  }, 120_000);
});
```

- [ ] **Step 2: Pass, commit**.

---

## Phase 7 — Render Matrix + Post-GIF

### Task 7.1: render-matrix.mjs

**Files:**
- Create: `scripts/render-matrix.mjs`

- [ ] **Step 1: Implement**:

```ts
#!/usr/bin/env tsx
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { hooks } from "../types/hooks";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const { values } = parseArgs({
  options: { "run-id": { type: "string" }, only: { type: "string" } },
});
const runId = values["run-id"]!;
const runDir = join(process.env.USERPROFILE ?? process.env.HOME!, "gflow-output", "promo", runId);
const outRoot = join(process.cwd(), "out", "promo", runId);
mkdirSync(outRoot, { recursive: true });

const COMPOSITIONS = ["PromoMaster", "PromoSocial", "ReadmeLoop"]
  .filter((c) => !values.only || c === values.only);

const bundled = await bundle({ entryPoint: "./src/remotion/index.ts" });
for (const hook of hooks) {
  for (const id of COMPOSITIONS) {
    const composition = await selectComposition({
      serveUrl: bundled, id, inputProps: { runDir, hookId: hook.id, hookTitle: hook.title },
    });
    const out = join(outRoot, `${hook.id}-${id.toLowerCase().replace("promo", "")}.mp4`);
    console.log(`render ${id} hook=${hook.id} → ${out}`);
    await renderMedia({
      composition, serveUrl: bundled, codec: "h264",
      outputLocation: out, inputProps: { runDir, hookId: hook.id, hookTitle: hook.title },
    });
  }
}
console.log(`✓ rendered ${hooks.length * COMPOSITIONS.length} variants to ${outRoot}`);
```

- [ ] **Step 2: Smoke-run**: `pnpm render-matrix --run-id smoke-001 --only PromoSocial` after Phase 5 smoke landed.

- [ ] **Step 3: Commit**.

### Task 7.2: post-gif.mjs

**Files:**
- Create: `scripts/post-gif.mjs`

- [ ] **Step 1: Implement** (ports `gflow-cli/scripts/record_demo.ps1`'s ffmpeg+gifski pipeline):

```ts
#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  "run-id": { type: "string" }, fps: { type: "string", default: "12" },
  width: { type: "string", default: "960" }, quality: { type: "string", default: "80" },
}});
const dir = join(process.cwd(), "out", "promo", values["run-id"]!);
for (const f of readdirSync(dir).filter((x) => x.endsWith("-readme.mp4"))) {
  const inp = join(dir, f);
  const outp = inp.replace(/\.mp4$/, ".gif");
  console.log(`ffmpeg+gifski → ${outp}`);
  execFileSync("sh", ["-c",
    `ffmpeg -y -i "${inp}" -vf "fps=${values.fps},scale=${values.width}:-1:flags=lanczos" -f yuv4mpegpipe - ` +
    `| gifski -o "${outp}" --fps ${values.fps} --width ${values.width} --quality ${values.quality} -`,
  ], { stdio: "inherit" });
}
```

- [ ] **Step 2: Commit Phase 7**.

---

## Phase 8 — OBS Scene & Operator Runbook

### Task 8.1: Export OBS scene

- [ ] **Step 1: Manual operator action** — in OBS:
  1. Create scene named `gflow-promo` with **Window Capture** source on the headed Chrome window.
  2. Add `Crop/Pad` filter cropping top-right `280 × 56` px.
  3. Resize composition to 1920×1080 with terminal pane (PowerShell, 120×30) on the left.
  4. `Scene Collection → Export` to `gflow-cli-remotion/docs/obs-scene.json`.

- [ ] **Step 2: Commit**:

```bash
git add docs/obs-scene.json
git commit -m "feat(promo): committed OBS scene-collection (terminal + cropped Chrome)"
```

### Task 8.2: promo.css

**Files:**
- Create: `docs/promo.css`

- [ ] **Step 1: Create**:

```css
[aria-label*="Google Account" i], [data-tooltip*="@"] {
  visibility: hidden !important;
}
```

- [ ] **Step 2: Commit**.

### Task 8.3: SETUP.md

**Files:**
- Create: `docs/SETUP.md`

- [ ] **Step 1: Write** the operator runbook with sections:
  - Prereqs (Node 20+, pnpm, OBS 28+, ffmpeg, gifski, gflow-cli installed)
  - One-time: install OBS WebSocket plugin, set strong `OBS_WS_PASSWORD`, import `docs/obs-scene.json`
  - One-time: create a `promo-*` profile with `gflow auth login --profile promo-XYZ --browser chrome`
  - One-time: add `gflow-output/` to `~/.gitignore_global`
  - Recording: `pnpm record-promo --profile promo-XYZ --run-id YYYY-MM-DD-NN`
  - Rendering: `pnpm render-matrix --run-id <id>`
  - GIF: `pnpm post-gif --run-id <id>`
  - **5-layer ledger checklist** (per `verification-ledger-5-layer` memory):
    1. File count: `Get-ChildItem out\promo\<id>` shows `N hooks × 3 formats` files.
    2. Magic bytes per file (commands).
    3. ffprobe dims per format.
    4. Eye-test playback (account chip absent).
    5. PII scan of first frame via `xxd`.

- [ ] **Step 2: Commit Phase 8**.

---

## Phase 9 — Hooks, Prompts, Lints

### Task 9.1: types/hooks.ts (6 starting hooks)

**Files:**
- Create: `types/hooks.ts`

- [ ] **Step 1: Implement**:

```ts
export interface Hook {
  id: string;          // kebab-case
  title: string;       // ≤32 chars; fits hook window
  subtitle: string;    // ≤80 chars
  durationMs: number;  // hook display time
}

export const hooks: readonly Hook[] = [
  { id: "question", title: "Tired of clicking through Flow?",
    subtitle: "Drive Veo and Imagen from your terminal.", durationMs: 2500 },
  { id: "claim", title: "100 Veo clips in one command.",
    subtitle: "Batch orchestration, locally.", durationMs: 2500 },
  { id: "pain", title: "Stop dragging files into a browser.",
    subtitle: "gflow runs the UI for you.", durationMs: 2500 },
  { id: "pov", title: "POV: your CLI talks to Veo.",
    subtitle: "Yes — really.", durationMs: 2500 },
  { id: "outcome", title: "From prompt to MP4 in one line.",
    subtitle: "Watch.", durationMs: 2500 },
  { id: "before-after", title: "Before: 47 clicks. After: 1 command.",
    subtitle: "gflow image batch.", durationMs: 2500 },
];
```

### Task 9.2: types/promo-prompts.ts

**Files:**
- Create: `types/promo-prompts.ts`

- [ ] **Step 1: Implement**:

```ts
export const PROMO_PROMPTS: readonly string[] = [
  "a quiet mountain lake at dawn, cinematic photography",
  "neon-lit Tokyo street at night, low angle, anamorphic",
  "minimalist Scandinavian living room, warm window light",
  "macro shot of dewdrops on a spider web at sunrise",
  "vintage 1970s film aesthetic of a roadside diner at dusk",
];
```

### Task 9.3 + 9.4: Lints

**Files:**
- Create: `tests/unit/hooks.test.ts`
- Create: `tests/lint/promo-prompts.test.ts`

- [ ] **Step 1: hooks test**:

```ts
import { describe, it, expect } from "vitest";
import { hooks } from "../../types/hooks";

describe("hooks", () => {
  it("has 3-12 entries", () => {
    expect(hooks.length).toBeGreaterThanOrEqual(3);
    expect(hooks.length).toBeLessThanOrEqual(12);
  });
  it("has unique ids", () => {
    const ids = hooks.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("title ≤32 chars and subtitle ≤80 chars", () => {
    for (const h of hooks) {
      expect(h.title.length).toBeLessThanOrEqual(32);
      expect(h.subtitle.length).toBeLessThanOrEqual(80);
    }
  });
});
```

- [ ] **Step 2: prompts lint**:

```ts
import { describe, it, expect } from "vitest";
import { PROMO_PROMPTS } from "../../types/promo-prompts";

const BANNED = [/@[\w.-]+/, /\bsecret\b/i, /\binternal\b/i, /<[^>]+>/];

describe("promo-prompts lint", () => {
  it("contains no banned phrases", () => {
    for (const p of PROMO_PROMPTS) {
      for (const re of BANNED) expect(p).not.toMatch(re);
    }
  });
  it("each prompt ≤200 chars", () => {
    for (const p of PROMO_PROMPTS) expect(p.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 3: Pass, commit Phase 9**.

---

## Phase 10 — Live Verification & PR

### Task 10.1: Council pre-PR review

Per `pre-pr-verification-discipline` memory:

- [ ] **Step 1: Run scoped tests** — `pnpm test`. Expect green.

- [ ] **Step 2: Dispatch 5-dim council** on the branch (using the `gflow:branch-review` skill in the gflow-cli repo, OR replicate the 5-agent dispatch pattern locally).

- [ ] **Step 3: Apply Tier 1 fixes inline**.

### Task 10.2: Live verification — one paid recording

- [ ] **Step 1: Operator action** — open OBS, import scene, set password, launch profile, run:
  `pnpm record-promo --profile promo-denon82 --run-id YYYY-MM-DD-001`

- [ ] **Step 2: Run** `pnpm render-matrix --run-id YYYY-MM-DD-001`.

- [ ] **Step 3: Run** `pnpm post-gif --run-id YYYY-MM-DD-001`.

- [ ] **Step 4: Execute the 5-layer ledger** from `docs/SETUP.md`. Capture evidence in `docs/LIVE_VERIFICATION_promo.md`:
  - Section per ledger layer.
  - File listing output.
  - Magic-byte hex dumps.
  - ffprobe dimensions.
  - Eye-test confirmation (one sentence per format).
  - PII scan negative result.

- [ ] **Step 5: Commit**:

```bash
git add docs/LIVE_VERIFICATION_promo.md
git commit -m "docs(promo): live verification evidence for first paid recording"
```

### Task 10.3: Open PR

- [ ] **Step 1: Push branch and open PR**:

```bash
git push -u origin feature/promo-pipeline
gh pr create --title "feat: promo recording + Remotion render pipeline" --body "..."
```

PR body cites the spec, lists phases, references live-verification doc.

### Task 10.4: Cross-repo cleanup PR in gflow-cli

After this PR merges in `gflow-cli-remotion`:

- [ ] **Step 1: In gflow-cli** — branch `chore/remove-record-demo-script`:

```bash
cd ..\gflow-cli
git checkout develop && git pull
git checkout -b chore/remove-record-demo-script
git rm scripts/record_demo.ps1
# update docs/USER_GUIDE.md, RELEASE.md, CHANGELOG.md to remove references
```

- [ ] **Step 2: Verify parity** per §11 of the spec — 5 falsifiable checks. Commit evidence inline in the PR body.

- [ ] **Step 3: Open PR** with `Refs #<promo-issue>`, NOT `Closes`.

---

## Self-Review

**Spec coverage check** (spec sections → plan phases):

| Spec § | Plan phase |
|---|---|
| §1 Goals | Phases 5, 6, 7 (recording + rendering produces the goals) |
| §2 Architecture | Reflected in Phase 0 scaffold + Phases 4-7 components |
| §3 Components | Each row → a Phase 2/3/4/5 task |
| §4 Data flow | Phase 5 `record-promo.mjs` |
| §5 Schema | Phase 1 |
| §6 Browser strategy | Phase 5 (profile-check) + Phase 8 (SETUP.md) |
| §7 Error handling | Phase 5 (Task 5.8 error-row tests) |
| §8 Testing | Phases 0 (vitest setup) + every phase has tests |
| §9 Security | Phase 2 (redact + env-scrub) + Phase 8 (obs-scene crop + promo.css) + Phase 5 (verifyChromeProfile, FORBIDDEN-pattern env scrub) |
| §10 Open Qs | Phase 9 hooks count enforced; Phase 8 obs-scene committed |
| §11 Follow-up | Phase 10 Task 10.4 |
| §12 OOS | Respected (no voiceover, no Lambda, no auto-publish) |

**Placeholder scan**: every code block above is concrete and runnable. Two exceptions documented inline: Task 6.3/6.4 say "Same pattern as 6.2" but justified because the structure is literally identical — operator can copy-paste 6.2 and adjust orientation/duration. Task 5.8 lists the test cases but uses an "abridged structure" with `// ...` comment — needs full bodies. Will be filled by the implementer per the spec §7 row mapping.

**Type consistency**: `RunManifest`, `Phase`, `ObsAdapter`, `EventEnvelope`, `Hook`, `PhaseDef` all defined once and used consistently. `hookId`/`hookTitle` props appear in compositions + render-matrix + the schema. Filename token `<hook>-readme.gif` consistent across post-gif and §2 layout.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-27-promo-pipeline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration on the orchestrator + compositions which benefit from clean per-task context windows.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints; lower overhead but riskier for the long render-test feedback loops.

Which approach?
