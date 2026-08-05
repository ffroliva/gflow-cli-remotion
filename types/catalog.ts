/**
 * Catalog of PUBLISHED promo assets.
 *
 * The pipeline already records how an asset was *made*: `RunManifest`
 * (`types/schema.ts`) captures a recording session, and `Hook` (`types/hooks.ts`)
 * captures the A/B variants a render fans out to. Neither records what happened
 * afterwards — which renders were kept, where the file ended up, and which
 * channel it is live on. That knowledge lived only in the operator's head, so
 * every launch re-derived it: at the 2026-08-05 v0.51.0 promo push, three assets
 * existed, only two were listed in `gflow-cli/docs/DEMOS.md`, and nothing
 * recorded that a 1080×1920 vertical composition was already built but had never
 * been rendered.
 *
 * This file closes that loop. It is the answer to "what promo material do we
 * have, what produced it, and can I reuse it?"
 *
 * Reuse is the point. Before commissioning a new recording session, check here:
 * an existing `master` can be re-cut into a new format without re-capturing
 * Flow, and a `sourceComposition` + `sourceRunId` pair is enough to re-render
 * with a different hook.
 *
 * Invariants are enforced by `tests/unit/catalog.test.ts`.
 */

/** Where an asset is published. An asset may serve several channels. */
export type Channel =
  | "readme" // inline in gflow-cli/README.md
  | "demos" // gflow-cli/docs/DEMOS.md gallery
  | "linkedin"
  | "reddit"
  | "facebook"
  | "x"
  | "youtube-shorts"
  | "tiktok";

export type AssetKind = "video" | "gif" | "image";

export interface PromoAsset {
  /** Stable kebab-case identifier. Never reuse or renumber. */
  id: string;
  kind: AssetKind;
  /** Repo-relative path, or an absolute URL for release-hosted assets. */
  location: string;
  width: number;
  height: number;
  /** Seconds. `null` for stills. */
  durationSec: number | null;
  bytes: number;
  /**
   * Composition in `src/remotion/Root.tsx` this came from, or `null` when the
   * asset predates the pipeline / was produced another way. `null` is a real
   * answer, not a gap to paper over — it means "cannot be re-rendered from a
   * composition, would need re-capture".
   */
  sourceComposition: "PromoMaster" | "PromoSocial" | "ReadmeLoop" | null;
  /** `RunManifest.runId` that produced it. `null` when unrecorded. */
  sourceRunId: string | null;
  /** `Hook.id` used for the opening, when the composition takes one. */
  hookId: string | null;
  channels: Channel[];
  /** ISO date the asset was produced or first published. */
  addedIso: string;
  /** One line: what a viewer actually sees. */
  description: string;
}

/**
 * BACKFILLED 2026-08-05 from the assets committed in `gflow-cli/docs/assets/`.
 * Dimensions, duration and byte sizes were measured from the files themselves.
 *
 * `sourceRunId` is `null` on all three: these predate the catalog and their
 * originating runs were never recorded. That is deliberately visible rather
 * than guessed — an invented run id would be worse than an honest gap, because
 * it would look re-renderable when it is not.
 */
export const catalog: PromoAsset[] = [
  {
    id: "demo-split-pf",
    kind: "gif",
    location: "https://github.com/ffroliva/gflow-cli/blob/main/docs/assets/demo-split-pf.gif",
    width: 600,
    height: 338,
    durationSec: 15.0,
    bytes: 757_102,
    sourceComposition: null,
    sourceRunId: null,
    hookId: null,
    channels: ["demos", "linkedin", "reddit"],
    addedIso: "2026-08-05",
    description:
      "Split-screen 16:9: the command is typed on a full terminal, then the Flow browser slides in and the image resolves. Strongest single asset — shows the CLI and the UI doing the work in one frame.",
  },
  {
    id: "example-run",
    kind: "gif",
    location: "https://github.com/ffroliva/gflow-cli/blob/main/docs/assets/example-run.gif",
    width: 800,
    height: 450,
    durationSec: 16.7,
    bytes: 1_187_030,
    sourceComposition: null,
    sourceRunId: null,
    hookId: null,
    channels: ["demos"],
    addedIso: "2026-08-05",
    description:
      "Terminal only, 16:9: a single `gflow image t2i` run with streaming output and the PNG landing on disk.",
  },
  {
    id: "examples-grid",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli/blob/main/docs/assets/examples.webp",
    width: 1499,
    height: 460,
    durationSec: null,
    bytes: 59_994,
    sourceComposition: null,
    sourceRunId: null,
    hookId: null,
    channels: ["readme"],
    addedIso: "2026-08-05",
    description:
      "Static output grid: text-to-image results plus a before/after frame transform. Embedded in the gflow-cli README hero.",
  },
  {
    id: "hook-question",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/question.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 85079,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "question",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Tired of clicking through Flow?\". hook variant, not in the first cut.",
  },
  {
    id: "hook-claim",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/claim.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 79953,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "claim",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"100 Veo clips in one command.\". hook variant, not in the first cut.",
  },
  {
    id: "hook-pain",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/pain.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 81334,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "pain",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Done dragging files by hand.\". hook variant, not in the first cut.",
  },
  {
    id: "hook-pov",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/pov.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 73685,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "pov",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"POV: your CLI talks to Veo.\". hook variant, not in the first cut.",
  },
  {
    id: "hook-outcome",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/outcome.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 64240,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "outcome",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Prompt to MP4 in one line.\". hook variant, not in the first cut.",
  },
  {
    id: "hook-before-after",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/before-after.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 76843,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "before-after",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Before: 47 clicks. After: 1.\". hook variant, not in the first cut.",
  },
  {
    id: "hook-scene-seven",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/scene-seven.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 81621,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "scene-seven",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Scene 7. Different face.\". lead hook for the first cut.",
  },
  {
    id: "hook-same-face",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/same-face.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 85801,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "same-face",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Same character. Every scene.\". A/B partner — survives as a still.",
  },
  {
    id: "hook-who-is-this",
    kind: "image",
    location: "https://github.com/ffroliva/gflow-cli-remotion/releases/download/promo-hooks-2026-08-05/who-is-this.png",
    width: 1080,
    height: 1920,
    durationSec: null,
    bytes: 86570,
    sourceComposition: "PromoSocial",
    sourceRunId: "promo-hooks-2026-08-05",
    hookId: "who-is-this",
    channels: ["linkedin", "reddit", "facebook"],
    addedIso: "2026-08-05",
    description:
      "Hook card 1080x1920 — \"Who is this? Not your hero.\". hook variant, not in the first cut.",
  },
];

/** Assets serving a given channel. */
export function byChannel(channel: Channel): PromoAsset[] {
  return catalog.filter((a) => a.channels.includes(channel));
}

/**
 * Production capability, as distinct from published output.
 *
 * The catalog above answers "what do we have?". This answers the other half of
 * the question: "what could we make, and what does it need?" — so a new promo
 * starts from what is already buildable instead of from a blank commission.
 *
 * The distinction earned itself immediately: `PromoSocial` was proposed as new
 * work during the v0.51.0 push when it had existed all along and needed only a
 * capture. Recording that a composition exists but has never shipped is the
 * whole point.
 */
export interface CompositionStatus {
  id: "PromoMaster" | "PromoSocial" | "ReadmeLoop";
  width: number;
  height: number;
  /** Composition length as registered in `src/remotion/Root.tsx`. */
  durationSec: number;
  /** Has any catalogued asset been produced from it? */
  shipped: boolean;
  /** What is required before it can produce an asset. `null` when nothing is. */
  blockedOn: string | null;
  notes: string;
}

/**
 * VERIFIED 2026-08-05. `PromoSocial` was rendered to a still
 * (`npx remotion still PromoSocial --frame=45 --props='{"runDir":""}'`) and
 * produced a clean 1080×1920 hook card, so the composition is sound. What none
 * of the three can do is produce a *usable* asset, because every one of them
 * mounts `OffthreadVideo src={staticFile("master.mp4")}` and there is no
 * `master.mp4` in `public/`.
 *
 * That is a one-capture blocker, not a build blocker — an important difference
 * when scoping a promo push.
 */
export const compositions: CompositionStatus[] = [
  {
    id: "PromoMaster",
    width: 1920,
    height: 1080,
    durationSec: 90,
    shipped: false,
    blockedOn: "public/master.mp4 — an OBS window-capture of a live Flow run (docs/RECORDING.md)",
    notes:
      "Long-form landscape. Intended for YouTube and as the source the other formats are cut from.",
  },
  {
    id: "PromoSocial",
    width: 1080,
    height: 1920,
    durationSec: 60,
    // `true` because it HAS produced catalogued assets — the nine hook cards
    // released 2026-08-05. That is stills only: the composition renders its
    // hook and then black without a master, so `blockedOn` still applies to
    // the video cut. "Shipped" here means "has produced something", not
    // "finished" — the blocker below is what separates the two.
    shipped: true,
    blockedOn:
      "public/master.mp4 for the VIDEO cut — an OBS window-capture of a live Flow run (docs/RECORDING.md). Stills render without it.",
    notes:
      "Vertical. Hook card verified rendering 2026-08-05 — type scales and holds at 9:16. NOTE: the montage LETTERBOXES the 16:9 master rather than reframing it (a CSS scale-to-cover crashes the render tab; see the comment in PromoSocial.tsx). Acceptable in a Facebook feed, weak for vertical-native TikTok/Shorts where letterboxed landscape reads as a repost.",
  },
  {
    id: "ReadmeLoop",
    width: 1280,
    height: 720,
    durationSec: 30,
    shipped: false,
    blockedOn: "public/master.mp4 — an OBS window-capture of a live Flow run (docs/RECORDING.md)",
    notes:
      "Seamless loop, GIF source. The two committed GIFs did NOT come from it — they are 600×338/15.0s and 800×450/16.7s against this composition's 1280×720/30s, so they were produced another way and cannot be re-rendered from here.",
  },
];

/** Compositions that could ship an asset today, with no new capture. */
export function readyToRender(): CompositionStatus[] {
  return compositions.filter((c) => c.blockedOn === null);
}

/**
 * Formats NOT yet represented in the catalog, per aspect ratio.
 *
 * The gap this surfaces today: every catalogued asset is landscape, so any
 * vertical-first channel (TikTok, Shorts, Facebook mobile feed) has nothing to
 * post. `PromoSocial` is built and verified rendering — see `compositions`
 * below for exactly what it is waiting on.
 */
export function missingVertical(): boolean {
  return !catalog.some((a) => a.height > a.width);
}
