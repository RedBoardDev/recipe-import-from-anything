# Pipeline Developer Guide

## What a pipeline does (and does not do)

A pipeline has **one job**: extract raw text from a source and return it.

It does **not** parse the recipe, call the LLM formatter, or produce structured output.
That is handled by `RecipeFormatterService` in the worker, which runs automatically after every pipeline.

```
POST /import
    ↓
Worker picks up job
    ↓
pipeline.execute()  →  TextExtractionResult  (rawText + metadata)
    ↓
RecipeFormatterService  →  CanonicalRecipe  (LLM call, always runs)
    ↓
ImportResult  (confidence + warnings)
```

## Contracts

### What a pipeline must export

Every pipeline package must export three things (from `src/index.ts`):

```ts
export { meta } from "./meta.js";
export { runtime } from "./runtime.js";
```

---

### `meta.ts` — static descriptor

```ts
import type { PipelineMeta } from "@recipe/pipeline-contracts";
import { z } from "zod";

export const myInputSchema = z.object({ /* ... */ });

export const meta: PipelineMeta<typeof myInputSchema> = {
  pipelineId: "my-pipeline",      // must match key in pipelines.config.ts
  title: "Human-readable title",
  description: "One sentence.",
  steps: [
    { id: "collecting", label: "Loading data", category: "collecting" },
    { id: "extracting", label: "Extracting text", category: "extracting" },
  ],
  inputSchema: myInputSchema,     // Zod schema — validated before execute() is called
};
```

**Step categories** (type `StepCategory`): `"collecting"` | `"extracting"` | `"finalizing"`

---

### `runtime.ts` — execution logic

```ts
import type { PipelineInput, PipelineRuntime } from "@recipe/pipeline-contracts";
import type { meta } from "./meta.js";

type MyInput = PipelineInput<typeof meta.inputSchema>;

export const runtime: PipelineRuntime<MyInput> = {
  execute: async (input, deps, reporter): Promise<TextExtractionResult> => {
    // ... extract text from the source
    return {
      rawText: "...",
      metadata: {
        sourceType: "my-pipeline",        // must be added to the union — see below
        sourceValue: "...",               // URL, ref, truncated text, etc.
        extractionConfidence: 0.9,        // 0–1
      },
      warnings: [],                       // optional — omit or use Warning instances
    };
  },
};
```

---

### `TextExtractionResult` — the return type

Defined in `packages/domain/src/extraction-result.ts`:

```ts
type TextExtractionResult = Readonly<{
  rawText: string;                    // all extracted text, passed verbatim to the LLM formatter
  metadata: Readonly<{
    sourceType: "image" | "text";     // ← extend this union when adding a new pipeline
    sourceValue: string;              // human-readable pointer to the source
    extractionConfidence: number;     // 0 (nothing extracted) to 1 (full confidence)
  }>;
  warnings?: readonly Warning[];      // non-fatal issues (use Warning class from @recipe/domain)
}>;
```

**When adding a new pipeline**, add its `sourceType` to this union before using it.

---

## What `deps` provides

```ts
type PipelineDeps = {
  fetch: FetchClient;          // HTTP — fetch(url, { signal?, headers? }) → { html, status, headers }
  inputs: TempInputStore;      // file store — get(ref) → Buffer | null  /  save(buf) → ref  /  delete(ref)
  llm: LlmClient;              // Mistral — complete({ model, messages, responseFormat, ... }) → { content }
  ocr?: OcrClient;             // Mistral Vision — extract(request) → OcrResponse  (optional)
  logger: Logger;              // info / warn / error / debug — always pass { jobId } as context
  signal: AbortSignal;         // check before expensive operations — abort means cancel immediately
  context: {
    jobId: string;
    pipelineId: string;
    debug: boolean;
    inputRef?: string;         // set when the job carries a pre-uploaded file ref
  };
};
```

Check `signal.aborted` before and after every async step. Throw with `"Pipeline aborted"` if true.

---

## Reporter

```ts
type PipelineProgressReporter = {
  checkpoint(c: ProgressCheckpoint): void;   // emits a named milestone with fixed % progress
  setStatus(s: JobStatus): void;             // updates the job status shown to the client
  log(message: string): void;               // free-form log line written to the BullMQ job log
};
```

**Available checkpoints** (`ProgressCheckpoint` in `packages/domain/src/progress-checkpoint.ts`):

| Checkpoint | Progress |
|---|---|
| `job_pickup` | 5% |
| `images_loaded` | 15% |
| `ocr_started` | 20% |
| `ocr_progress_1/2/3` | 40/60/80% |
| `formatting_started` | 90% |
| `completed` | 100% |

If your pipeline needs intermediate milestones that don't map to these, add new entries to `ProgressCheckpoint` and `CHECKPOINT_PROGRESS` in `packages/domain/src/progress-checkpoint.ts`.

**Relevant `JobStatus` values** for pipelines (set via `setStatus`): `"collecting"` | `"extracting"`.
(`"formatting"` and beyond are set by the worker after the pipeline returns.)

**Minimal reporter usage** (simplest pipelines):
```ts
reporter.checkpoint("job_pickup");
reporter.setStatus("extracting");
// ... do the work
```

---

## File structure checklist

```
packages/pipelines/<id>/
  package.json        ← name: "@recipe/pipeline-<id>", copy from images, update name
  tsconfig.json       ← copy from images as-is (references domain + pipeline-contracts)
  src/
    meta.ts           ← inputSchema + PipelineMeta
    runtime.ts        ← PipelineRuntime implementation
    index.ts          ← re-exports meta and runtime
```

---

## Registration

Add an entry to `src/config/pipelines.config.ts`:

```ts
{
  pipelineId: "<id>",
  metaEntry: "@recipe/pipeline-<id>/meta",
  runtimeEntry: "@recipe/pipeline-<id>/runtime",
}
```

---

## Tests

Create `tests/pipelines/<id>/runtime.test.ts`.

**Use the pattern from `tests/pipelines/images/runtime.test.ts`** — it defines its own local
`createMockDeps` and `createMockReporter` inline. This is the current working pattern.

> ⚠️ **`tests/pipelines/_support/` is stale.** `contract-suite.ts` and `reporter-factory.ts` use
> an older `PipelineReporter` API (`stepStarted` / `stepCompleted`) that is no longer the
> interface passed to `execute()`. Do not use them for new pipelines.

Minimal test structure:

```ts
import { runtime } from "@recipe/pipeline-<id>/runtime";
import { describe, expect, it, vi } from "vitest";
import type { PipelineDeps, PipelineProgressReporter } from "@recipe/pipeline-contracts";

const createMockReporter = (): PipelineProgressReporter => ({
  checkpoint: vi.fn(),
  setStatus: vi.fn(),
  log: vi.fn(),
});

const createMockDeps = (): PipelineDeps => ({
  fetch: { fetch: vi.fn() },
  inputs: { save: vi.fn(), get: vi.fn().mockResolvedValue(null), delete: vi.fn() },
  llm: { complete: vi.fn() },
  ocr: { extract: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  signal: new AbortController().signal,
  context: { jobId: "test-job", pipelineId: "<id>", debug: false },
});

describe("Pipeline <Id> Runtime", () => {
  it("returns rawText with correct metadata", async () => {
    const result = await runtime.execute(/* valid input */, createMockDeps(), createMockReporter());
    expect(result.rawText).toBeTruthy();
    expect(result.metadata.sourceType).toBe("<id>");
    expect(result.metadata.extractionConfidence).toBeGreaterThan(0);
  });

  it("throws when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = { ...createMockDeps(), signal: controller.signal };
    await expect(runtime.execute(/* valid input */, deps, createMockReporter())).rejects.toThrow(/abort/i);
  });
});
```

---

## Reference implementations

| Pipeline | Complexity | Deps used | Notes |
|---|---|---|---|
| `text` | minimal | none | Pure pass-through — start here |
| `images` | medium | `inputs` + `ocr` | Multi-image with partial failure handling |

---

## Verify after implementation

```bash
yarn typecheck
yarn lint
yarn test
```
