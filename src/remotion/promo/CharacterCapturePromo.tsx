/**
 * `gflow character create` — character-creation promo (9:16, 1080×1920).
 *
 * Shows the REAL Flow character editor as a controlled sequence of clean STILL
 * frames (pulled from a free live `gflow character create` run) animated in
 * Remotion: empty editor → "generating" → the generated face revealed → a
 * full-bleed hero — wrapped in a branded hook intro and an install CTA.
 *
 * Why stills, not a screen-recording: a live screen-capture of the automation
 * bounces — Playwright auto-scrolls elements into view and the layout jumps
 * when the image loads. A single frame is static, so we drive every motion
 * ourselves with useCurrentFrame()/interpolate() — zero jitter, full control of
 * pacing. The English captions carry the narrative over the (Portuguese) Flow
 * chrome, and a vignette keeps the eye on the canvas.
 *
 * Timeline (frames @ FPS):
 *   0 .. INTRO_FRAMES                  hook/title intro card        (~2.5s)
 *   INTRO_FRAMES .. +CREATION_FRAMES   creation still sequence      (~8.5s)
 *   then .. +OUTRO_FRAMES              CTA outro card               (~3s)
 *
 * Remotion invariants: every motion comes from useCurrentFrame() +
 * interpolate()/spring(); no CSS transitions/animations; all assets via
 * staticFile().
 */

import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import { z } from "zod";
import { theme } from "./theme";
import { FPS } from "../../../types/constants";

export const characterCapturePromoSchema = z.object({
  hookId: z.string(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
  ctaText: z.string().optional(),
});

type Props = z.infer<typeof characterCapturePromoSchema>;

// Shot lengths (frames @ FPS). The creation sequence is a FIXED-length series
// of stills, so the total duration is static (no video probing needed).
export const INTRO_FRAMES = Math.round(2.5 * FPS); // ~2.5s hook
export const CREATION_FRAMES = Math.round(8.5 * FPS); // ~8.5s still sequence
export const OUTRO_FRAMES = 3 * FPS; // ~3s CTA

// Real editor stills (clean single frames from a free live capture) + the
// high-quality generated face. All under public/captures.
const EDITOR_EMPTY = "captures/character-creation/editor-empty.jpg";
const EDITOR_MARINA = "captures/character-creation/editor-marina.jpg";
const HERO_FACE = "captures/character-marina/face.jpg";

const sec = (s: number): number => Math.round(s * FPS);

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
// calculateMetadata — total duration = intro + creation + outro (fixed)
// ---------------------------------------------------------------------------

export const calculateCharacterCaptureMetadata: CalculateMetadataFunction<
  Props
> = () => ({
  durationInFrames: INTRO_FRAMES + CREATION_FRAMES + OUTRO_FRAMES,
});

// ---------------------------------------------------------------------------
// Shot 1 — hook / title intro card
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
// Shot 2 — creation still sequence (no video; frame-driven motion only)
// ---------------------------------------------------------------------------

function dot(color: string): React.CSSProperties {
  return { width: 20, height: 20, borderRadius: "50%", backgroundColor: color };
}

/**
 * A cross-fading layer: fully visible across [start, end), ramping opacity over
 * `fade` frames at each edge so adjacent beats dissolve into each other.
 */
const Beat: React.FC<{
  start: number;
  end: number;
  fade: number;
  children: React.ReactNode;
}> = ({ start, end, fade, children }) => {
  const frame = useCurrentFrame();
  if (frame < start || frame >= end) return null;
  const opacity = interpolate(
    frame,
    [start, start + fade, end - fade, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** Diagonal light sweep + a "generating" pill over the editor canvas. */
const GeneratingOverlay: React.FC<{ beatStart: number }> = ({ beatStart }) => {
  const frame = useCurrentFrame();
  const t = (frame - beatStart) / FPS; // seconds into the beat
  const x = interpolate(t, [0.7, 3.0], [-35, 135], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const on = t > 0.5 && t < 3.4 ? 1 : 0;
  const pulse = 0.6 + 0.4 * Math.sin(t * 6);
  return (
    <AbsoluteFill style={{ opacity: on }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${x}%`,
          width: "28%",
          background:
            "linear-gradient(105deg, transparent, rgba(0,229,160,0.22), transparent)",
          filter: "blur(10px)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 24px",
            borderRadius: 999,
            backgroundColor: "rgba(5,8,12,0.72)",
            border: `1px solid ${theme.accentDim}`,
            fontSize: 26,
            color: theme.fg,
          }}
        >
          <div
            style={{
              ...dot(theme.accent),
              width: 14,
              height: 14,
              opacity: pulse,
            }}
          />
          Generating · free
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A real editor still inside the faux-browser card with a Ken-Burns push-in. */
const EditorBeat: React.FC<{
  src: string;
  beatStart: number;
  beatDur: number;
  caption: string;
  generating?: boolean;
  focusFace?: boolean;
}> = ({ src, beatStart, beatDur, caption, generating, focusFace }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [beatStart, beatStart + beatDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(p, [0, 1], [1.0, focusFace ? 1.14 : 1.05]);
  // The generated face sits in the right ~2/3 of the landscape still, so a
  // face-focused beat pushes the zoom origin toward it.
  const originX = focusFace ? "66%" : "50%";
  const originY = focusFace ? "44%" : "50%";
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
      <div style={{ width: 984 }}>
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
          {/* 16:9 image band — the still, zoomed via transform (Ken Burns) */}
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              backgroundColor: "#000",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale})`,
                transformOrigin: `${originX} ${originY}`,
              }}
            />
            {/* gentle vignette to keep the eye on the canvas */}
            <AbsoluteFill
              style={{
                boxShadow: "inset 0 0 160px 40px rgba(5,8,12,0.55)",
                pointerEvents: "none",
              }}
            />
            {generating ? <GeneratingOverlay beatStart={beatStart} /> : null}
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            color: theme.dim,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Full-bleed hero of the generated face with a name lower-third. */
const HeroBeat: React.FC<{ beatStart: number; beatDur: number }> = ({
  beatStart,
  beatDur,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [beatStart, beatStart + beatDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(p, [0, 1], [1.06, 1.14]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={staticFile(HERO_FACE)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "50% 40%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,8,12,0.35) 0%, transparent 30%, transparent 52%, rgba(5,8,12,0.9) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: 72,
          fontFamily: theme.font,
        }}
      >
        <div style={{ fontSize: 30, color: theme.accent, marginBottom: 12 }}>
          gflow character
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: theme.fg }}>
          Marina
        </div>
        <div style={{ fontSize: 32, color: theme.dim, marginTop: 10 }}>
          one face — reusable across every scene & video
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CreationSequence: React.FC = () => {
  const fade = sec(0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {/* Beat 1 — open the editor + generating */}
      <Beat start={sec(0)} end={sec(4.0)} fade={fade}>
        <EditorBeat
          src={EDITOR_EMPTY}
          beatStart={sec(0)}
          beatDur={sec(4.0)}
          caption="Create a reusable character — free, no credits"
          generating
        />
      </Beat>
      {/* Beat 2 — the generated face revealed in the editor */}
      <Beat start={sec(3.5)} end={sec(7.0)} fade={fade}>
        <EditorBeat
          src={EDITOR_MARINA}
          beatStart={sec(3.5)}
          beatDur={sec(3.5)}
          caption="One face — consistent across every scene"
          focusFace
        />
      </Beat>
      {/* Beat 3 — full-bleed hero */}
      <Beat start={sec(6.5)} end={sec(8.5)} fade={fade}>
        <HeroBeat beatStart={sec(6.5)} beatDur={sec(2.0)} />
      </Beat>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Shot 3 — CTA outro card
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
  hookId,
  hookTitle,
  hookSubtitle,
  ctaText,
}) => {
  const fallback = HOOK_TITLES[hookId] ?? HOOK_TITLES.question;
  const title = hookTitle ?? fallback.title;
  const subtitle = hookSubtitle ?? fallback.subtitle;
  const cta = ctaText ?? DEFAULT_CTA;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <HookCard title={title} subtitle={subtitle} />
      </Sequence>

      <Sequence from={INTRO_FRAMES} durationInFrames={CREATION_FRAMES}>
        <CreationSequence />
      </Sequence>

      <Sequence
        from={INTRO_FRAMES + CREATION_FRAMES}
        durationInFrames={OUTRO_FRAMES}
      >
        <CtaShot ctaText={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
