/**
 * `gflow character create` — real-footage capture promo (9:16, 1080×1920).
 *
 * This is the SHELL that wraps a real browser screen-capture of a live
 * `gflow character create` run (the future OBS `master.mp4`) with a branded
 * title/hook intro and an install CTA outro. Until that recording exists it
 * renders against a committed placeholder clip (see `captureFile` default in
 * Root.tsx) so the composition stays green.
 *
 * Layout: the screen capture is a LANDSCAPE browser recording, so it is shown
 * in a centered, framed "browser" card over a dark backdrop — letterboxed via
 * `objectFit: "contain"`, never stretched. A caption strip under the card and
 * a faux title-bar (theme tokens) give it a device-frame feel. This also
 * renders correctly if the dropped-in file happens to be vertical: contain
 * just pillarboxes instead.
 *
 * Timeline (frames @ FPS):
 *   0 .. INTRO_FRAMES                 hook/title intro card  (~2.5s)
 *   INTRO_FRAMES .. +captureFrames    the screen-capture video plays
 *   then .. +OUTRO_FRAMES             CTA outro card         (~3s)
 *
 * Duration is computed in `calculateMetadata` (see Root.tsx): we probe the
 * capture's real duration with mediabunny and set
 *   durationInFrames = INTRO_FRAMES + ceil(captureSeconds * FPS) + OUTRO_FRAMES.
 * If the probe fails (missing/unreadable file) we fall back to a sensible
 * default capture length so a render never hard-fails on the shell.
 *
 * Remotion invariants: every motion comes from useCurrentFrame() +
 * interpolate()/spring(); no CSS transitions/animations; the video and any
 * assets are referenced via staticFile().
 */

import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import { Input, ALL_FORMATS, UrlSource } from "mediabunny";
import { z } from "zod";
import { theme } from "./theme";
import { FPS } from "../../../types/constants";

export const characterCapturePromoSchema = z.object({
  // Path (relative to public/) of the screen-capture mp4 to embed.
  captureFile: z.string(),
  hookId: z.string(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
  ctaText: z.string().optional(),
});

type Props = z.infer<typeof characterCapturePromoSchema>;

// Intro/outro shot lengths (frames @ FPS). The capture length is dynamic and
// lives between them — see calculateMetadata.
export const INTRO_FRAMES = Math.round(2.5 * FPS); // ~2.5s hook
export const OUTRO_FRAMES = 3 * FPS; // ~3s CTA

// If we cannot read the capture's duration we still want a watchable clip, so
// fall back to this many seconds of capture time.
export const FALLBACK_CAPTURE_SECONDS = 20;

const DEFAULT_CTA =
  "gflow character · v0.12.0 · pip install -U gflow-cli · github.com/ffroliva/gflow-cli";

const HOOK_TITLES: Record<string, { title: string; subtitle?: string }> = {
  question: {
    title: "What if your AI character looked the same in every shot?",
  },
  pain: {
    title: "Your AI subject keeps changing face.",
    subtitle: "Fix it in one command.",
  },
  flex: {
    title: "One command → a reusable character: face, body, voice.",
  },
  dev: {
    title: "Consistent characters, straight from your terminal.",
  },
};

// ---------------------------------------------------------------------------
// calculateMetadata — total duration = intro + capture + outro
// ---------------------------------------------------------------------------

/**
 * Probe the capture's real duration (mediabunny works in both the Studio
 * browser and the CLI renderer). On any failure fall back to a fixed default
 * so the shell renders even before the real OBS master exists.
 */
const getCaptureSeconds = async (src: string): Promise<number> => {
  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(src, { getRetryDelay: () => null }),
    });
    const seconds = await input.computeDuration();
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return FALLBACK_CAPTURE_SECONDS;
    }
    return seconds;
  } catch {
    return FALLBACK_CAPTURE_SECONDS;
  }
};

export const calculateCharacterCaptureMetadata: CalculateMetadataFunction<
  Props
> = async ({ props }) => {
  const captureSeconds = await getCaptureSeconds(staticFile(props.captureFile));
  const captureFrames = Math.ceil(captureSeconds * FPS);
  return {
    durationInFrames: INTRO_FRAMES + captureFrames + OUTRO_FRAMES,
  };
};

// ---------------------------------------------------------------------------
// Shot 1 — hook / title intro card (reuses CharacterPromo's hook styling)
// ---------------------------------------------------------------------------

const HookCard: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(enter, [0, 1], [0.92, 1]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        padding: 96,
        opacity: enter,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 44, color: theme.accent, marginBottom: 40 }}>
        gflow character
      </div>
      <h1
        style={{
          fontSize: 84,
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.14,
        }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          style={{
            fontSize: 42,
            color: theme.dim,
            marginTop: 36,
            textAlign: "center",
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Shot 2 — the screen capture, framed into 9:16
// ---------------------------------------------------------------------------

const CaptureShot: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
        padding: 48,
      }}
    >
      <div
        style={{
          width: 984,
          opacity: enter,
          transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            fontSize: 32,
            color: theme.dim,
            marginBottom: 22,
            textAlign: "center",
          }}
        >
          <span style={{ color: theme.accent }}>$ </span>gflow character create
        </div>
        {/* Browser-frame card: the landscape capture sits inside, contained
            (letterboxed) so it is never stretched. */}
        <div
          style={{
            borderRadius: 18,
            overflow: "hidden",
            border: `2px solid ${theme.accentDim}`,
            backgroundColor: "#05080c",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          }}
        >
          {/* faux browser title bar */}
          <div
            style={{
              height: 54,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 22px",
              backgroundColor: "#0e141d",
              borderBottom: `1px solid #1b2330`,
            }}
          >
            <div style={dot("#ff5f57")} />
            <div style={dot("#febc2e")} />
            <div style={dot("#28c840")} />
            <div
              style={{
                flex: 1,
                textAlign: "center",
                color: theme.dim,
                fontSize: 24,
              }}
            >
              labs.google/fx/tools/flow
            </div>
          </div>
          {/* video band — 16:9 viewport, contain keeps any aspect honest */}
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: "#000",
            }}
          >
            <OffthreadVideo
              src={src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
        {/* caption strip */}
        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            color: theme.dim,
            textAlign: "center",
          }}
        >
          live run · face reference + triptych body, bound in one command
        </div>
      </div>
    </AbsoluteFill>
  );
};

function dot(color: string): React.CSSProperties {
  return { width: 20, height: 20, borderRadius: "50%", backgroundColor: color };
}

// ---------------------------------------------------------------------------
// Shot 3 — CTA outro card (reuses CharacterPromo's CTA)
// ---------------------------------------------------------------------------

const CtaShot: React.FC<{ ctaText: string }> = ({ ctaText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(enter, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        padding: 96,
        opacity: enter,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 54, color: theme.accent, marginBottom: 28 }}>
        gflow character
      </div>
      <div style={{ fontSize: 40, color: theme.dim, marginBottom: 48 }}>
        new in v0.12.0
      </div>
      <div
        style={{
          fontSize: 42,
          padding: "20px 32px",
          border: `1px solid ${theme.accentDim}`,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ color: theme.dim }}>$ </span>
        <span style={{ color: theme.accent }}>pip install -U gflow-cli</span>
      </div>
      <div
        style={{
          fontSize: 30,
          color: theme.dim,
          marginTop: 52,
          textAlign: "center",
          maxWidth: 900,
          lineHeight: 1.4,
        }}
      >
        {ctaText}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export const CharacterCapturePromo: React.FC<Props> = ({
  captureFile,
  hookId,
  hookTitle,
  hookSubtitle,
  ctaText,
}) => {
  const fallback = HOOK_TITLES[hookId] ?? HOOK_TITLES.question;
  const title = hookTitle ?? fallback.title;
  const subtitle = hookSubtitle ?? fallback.subtitle;
  const cta = ctaText ?? DEFAULT_CTA;
  const captureSrc = staticFile(captureFile);

  // The capture sequence runs until the outro starts; its real length is set
  // by calculateMetadata (which inflates the composition duration to fit).
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <HookCard title={title} subtitle={subtitle} />
      </Sequence>

      <Sequence from={INTRO_FRAMES}>
        <CaptureShot src={captureSrc} />
      </Sequence>

      {/* CTA is mounted via a from-the-end offset computed by the renderer:
          we cannot know the capture length here, so the outro is the last
          OUTRO_FRAMES of the composition. Remotion clamps a Sequence with no
          duration to the composition end, so we instead overlay the CTA on top
          for its window using a frame-driven gate inside CtaOutro. */}
      <CtaOutro ctaText={cta} />
    </AbsoluteFill>
  );
};

/**
 * The outro must occupy the final OUTRO_FRAMES of a dynamically-sized
 * composition. We read the composition's total duration at render time and
 * mount the CTA only for that trailing window — frame math only, no CSS.
 */
const CtaOutro: React.FC<{ ctaText: string }> = ({ ctaText }) => {
  const { durationInFrames } = useVideoConfig();
  const start = Math.max(0, durationInFrames - OUTRO_FRAMES);
  return (
    <Sequence from={start} durationInFrames={OUTRO_FRAMES}>
      <CtaShot ctaText={ctaText} />
    </Sequence>
  );
};
