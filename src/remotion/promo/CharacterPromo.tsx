/**
 * `gflow character` social promo — a 9:16 (1080×1920) vertical clip showcasing
 * the v0.12.0 one-command creation of a reusable, consistent Character
 * (face reference + front/side/back triptych body + voice + personality).
 *
 * Zero credits: it reuses the real artifacts generated during the 2026-06-02
 * character live-verify (entity 04ec1e8a), copied into
 * `public/captures/character-marina/`.
 *
 * One composition is registered per A/B hook angle (see Root.tsx). The whole
 * timeline is animated with interpolate()/spring() on useCurrentFrame() — no
 * CSS transitions/animations, assets via staticFile() + <Img>.
 *
 * Shot timeline (~18s @ 30fps ≈ 540 frames):
 *   0–3s   hook caption (per-variant text)
 *   3–7s   terminal types `gflow character create …`
 *   7–11s  animated editor panel: face slot fills → face.jpg reveal
 *   11–16s triptych body slides in + "front · side · back …" caption
 *   16–18s CTA card (install + repo)
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
} from "remotion";
import { z } from "zod";
import { theme, cursorOpacity } from "./theme";
import { FPS } from "../../../types/constants";

export const characterPromoSchema = z.object({
  runDir: z.string(),
  faceFile: z.string(),
  bodyFile: z.string(),
  hookId: z.string(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
});

type Props = z.infer<typeof characterPromoSchema>;

// Shot boundaries (frames @ FPS). Tunable in Studio.
const HOOK_END = 3 * FPS; // 0–3s
const TERMINAL_END = 7 * FPS; // 3–7s
const FACE_END = 11 * FPS; // 7–11s
const BODY_END = 16 * FPS; // 11–16s
// 16–18s → CTA (runs to the end of the composition).

// ---------------------------------------------------------------------------
// Shot 1 — hook caption
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
// Shot 2 — terminal types the create command
// ---------------------------------------------------------------------------

// One physical line per array entry; the typing reveal walks character by
// character across the whole flattened command.
const COMMAND_LINES: readonly string[] = [
  "gflow character create \\",
  "  --name Marina \\",
  '  --face-prompt "a woman with short dark hair, round',
  '    glasses, navy sweater, soft studio portrait" \\',
  "  --voice Kore \\",
  '  --personality "warm, precise, quietly confident"',
];

const FULL_COMMAND = COMMAND_LINES.join("\n");

const TerminalShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);

  // Type ~1.6 chars/frame; finish typing with time to spare before the cut.
  const typed = Math.min(FULL_COMMAND.length, Math.floor(frame * 1.6));
  const shown = FULL_COMMAND.slice(0, typed);
  const doneTyping = typed >= FULL_COMMAND.length;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
        padding: 64,
      }}
    >
      <div
        style={{
          width: 920,
          backgroundColor: "#05080c",
          borderRadius: 20,
          border: `1px solid #1b2330`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          overflow: "hidden",
          opacity: enter,
          transform: `translateY(${y}px)`,
        }}
      >
        {/* title bar */}
        <div
          style={{
            height: 60,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 26px",
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
              fontSize: 26,
            }}
          >
            gflow — create a character
          </div>
        </div>
        {/* body */}
        <div
          style={{
            padding: 40,
            fontSize: 34,
            lineHeight: 1.45,
            color: theme.fg,
            whiteSpace: "pre-wrap",
            minHeight: 360,
          }}
        >
          <span style={{ color: theme.accent }}>$ </span>
          {shown}
          <span
            style={{ opacity: doneTyping ? cursorOpacity(frame, fps) : 1 }}
          >
            ▋
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

function dot(color: string): React.CSSProperties {
  return { width: 22, height: 22, borderRadius: "50%", backgroundColor: color };
}

// ---------------------------------------------------------------------------
// Shot 3 — editor panel: face slot fills, then face.jpg revealed
// ---------------------------------------------------------------------------

const FaceShot: React.FC<{ faceSrc: string }> = ({ faceSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });

  // The slot "fills" (a sweeping progress bar) over the first ~1.6s, then the
  // real image fades up over the placeholder.
  const fill = interpolate(frame, [0, 1.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reveal = interpolate(frame, [1.4 * fps, 2.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
        padding: 72,
      }}
    >
      <div
        style={{
          width: 900,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 34,
            color: theme.dim,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <span style={{ color: theme.accent }}>Character editor</span> · face
          reference
        </div>
        {/* Framed card — face is landscape (~16:9), so a 16:9 framed slot, not
            full-bleed. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 18,
            overflow: "hidden",
            border: `2px solid ${theme.accentDim}`,
            backgroundColor: "#0e141d",
          }}
        >
          {/* placeholder grid + fill sweep, visible until the reveal */}
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              opacity: 1 - reveal,
            }}
          >
            <div style={{ fontSize: 30, color: theme.dim }}>
              generating face…
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: 8,
                width: `${Math.round(fill * 100)}%`,
                backgroundColor: theme.accent,
              }}
            />
          </AbsoluteFill>
          <Img
            src={faceSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: reveal,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            color: theme.dim,
            textAlign: "center",
            opacity: reveal,
          }}
        >
          slot 0 · face reference attached
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Shot 4 — triptych body slides in
// ---------------------------------------------------------------------------

const BodyShot: React.FC<{ bodySrc: string }> = ({ bodySrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const x = interpolate(enter, [0, 1], [120, 0]);

  const captionIn = interpolate(frame, [0.8 * fps, 1.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
        padding: 64,
      }}
    >
      <div style={{ width: 960, opacity: enter, transform: `translateX(${x}px)` }}>
        <div
          style={{
            fontSize: 34,
            color: theme.dim,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <span style={{ color: theme.accent }}>Character editor</span> · body
        </div>
        {/* triptych: front · side · back — landscape, framed card */}
        <div
          style={{
            width: "100%",
            borderRadius: 18,
            overflow: "hidden",
            border: `2px solid ${theme.accentDim}`,
            backgroundColor: "#0e141d",
          }}
        >
          <Img
            src={bodySrc}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
        <p
          style={{
            marginTop: 30,
            fontSize: 38,
            color: theme.fg,
            textAlign: "center",
            opacity: captionIn,
            transform: `translateY(${interpolate(captionIn, [0, 1], [16, 0])}px)`,
          }}
        >
          front · side · back — one generation, consistent
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Shot 5 — CTA card
// ---------------------------------------------------------------------------

const CtaShot: React.FC = () => {
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
      <div style={{ fontSize: 36, color: theme.fg, marginTop: 52 }}>
        ★ github.com/ffroliva/gflow-cli
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

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

export const CharacterPromo: React.FC<Props> = ({
  faceFile,
  bodyFile,
  hookId,
  hookTitle,
  hookSubtitle,
}) => {
  const fallback = HOOK_TITLES[hookId] ?? HOOK_TITLES.question;
  const title = hookTitle ?? fallback.title;
  const subtitle = hookSubtitle ?? fallback.subtitle;
  const faceSrc = staticFile(faceFile);
  const bodySrc = staticFile(bodyFile);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={HOOK_END}>
        <HookCard title={title} subtitle={subtitle} />
      </Sequence>

      <Sequence from={HOOK_END} durationInFrames={TERMINAL_END - HOOK_END}>
        <TerminalShot />
      </Sequence>

      <Sequence from={TERMINAL_END} durationInFrames={FACE_END - TERMINAL_END}>
        <FaceShot faceSrc={faceSrc} />
      </Sequence>

      <Sequence from={FACE_END} durationInFrames={BODY_END - FACE_END}>
        <BodyShot bodySrc={bodySrc} />
      </Sequence>

      <Sequence from={BODY_END}>
        <CtaShot />
      </Sequence>
    </AbsoluteFill>
  );
};
