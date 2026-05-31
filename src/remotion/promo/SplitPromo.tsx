import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  type CalculateMetadataFunction,
} from "remotion";
import { z } from "zod";
import { theme, cursorOpacity } from "./theme";
import {
  SPLIT_HOOK_DURATION,
  TRIM_VIDEO_FRAMES,
  PROMPT_FIRST_LEAD,
  TERM_TYPE_END,
  TERM_SPIN_START,
  TERM_SHARP_VF,
} from "../../../types/constants";

/**
 * Split-screen campaign composition: the gflow command (a faux terminal) and
 * the Flow browser generating + revealing the result. One component drives
 * every format (16:9 / 9:16 / 1:1 / loop) and three layouts (terminal-top /
 * -bottom / pip), in two sequence modes:
 *
 *   - "simultaneous": terminal + browser on screen together from the start.
 *   - "prompt-first": the command is typed on a full terminal FIRST, THEN the
 *     browser slides in as the terminal demotes to its layout band — mirroring
 *     what actually happens (you run the command, then Flow does its thing).
 *
 * The browser half is the trimmed master (obs-real-005-trim15, 372f / ~12.4s)
 * with a slower, *felt* generation and a ~3s held "breath" on the result. Its
 * top browser chrome (tabs + address bar + the "unsupported command line flag …
 * AutomationControlled" banner + search bar) is cropped (see CROP) so only the
 * authentic Flow UI shows. Crop verified against out/dev/frames/sharp_full.png.
 *
 * Duration is computed by calculateMetadata from the props (mode/showHook) so
 * render-split can override them per invocation without a duration mismatch.
 */

export const splitPromoSchema = z.object({
  runDir: z.string(),
  mode: z.enum(["simultaneous", "prompt-first"]).default("simultaneous"),
  layout: z.enum(["terminal-top", "terminal-bottom", "pip"]).default("terminal-top"),
  command: z.string().optional(),
  showHook: z.boolean().default(true),
  hookId: z.string().optional(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
});

type Props = z.infer<typeof splitPromoSchema>;

const DEFAULT_COMMAND = 'gflow image t2i "a serene mountain lake at dawn"';

const leadFor = (mode: Props["mode"]) =>
  mode === "prompt-first" ? PROMPT_FIRST_LEAD : 0;

/** Composition duration from the final props — see file header. */
export const calculateSplitMetadata: CalculateMetadataFunction<Props> = ({
  props,
}) => {
  const hook = props.showHook === false ? 0 : SPLIT_HOOK_DURATION;
  return {
    durationInFrames: hook + leadFor(props.mode ?? "simultaneous") + TRIM_VIDEO_FRAMES,
  };
};

/** Same value as calculateSplitMetadata — used as the <Composition> fallback. */
export function splitDuration(
  showHook = true,
  mode: Props["mode"] = "simultaneous",
): number {
  return (showHook ? SPLIT_HOOK_DURATION : 0) + leadFor(mode) + TRIM_VIDEO_FRAMES;
}

// ── Browser framing ────────────────────────────────────────────────────────
// Source crop in the 1920x1080 master pixel space: drop the top ~210px of
// browser chrome so panels open on the authentic Flow app header.
const SRC = { w: 1920, h: 1080 } as const;
const CROP = { x: 0, y: 210, w: 1920, h: 870 } as const;

function coverFrame(panelW: number, panelH: number, anchorY = 0.5) {
  const scale = Math.max(panelW / CROP.w, panelH / CROP.h);
  const vidW = SRC.w * scale;
  const vidH = SRC.h * scale;
  const left = -CROP.x * scale + (panelW - CROP.w * scale) / 2;
  const top = -CROP.y * scale + (panelH - CROP.h * scale) * anchorY;
  return { vidW, vidH, left, top };
}

const BrowserPanel: React.FC<{ w: number; h: number; anchorY?: number }> = ({
  w,
  h,
  anchorY = 0.5,
}) => {
  const { vidW, vidH, left, top } = coverFrame(w, h, anchorY);
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <OffthreadVideo
        src={staticFile("master.mp4")}
        style={{ position: "absolute", width: vidW, height: vidH, left, top }}
      />
    </div>
  );
};

// ── Layout geometry ──────────────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number };

function finalRects(
  layout: Props["layout"],
  width: number,
  height: number,
): { term: Rect; browser: Rect } {
  const isLandscape = width > height;
  const gap = Math.round(Math.min(width, height) * 0.022);

  if (layout === "pip") {
    const pipW = Math.round(width * 0.46);
    const pipH = Math.round(pipW * 0.46);
    const margin = Math.round(Math.min(width, height) * 0.035);
    return {
      browser: { x: 0, y: 0, w: width, h: height },
      term: { x: margin, y: height - pipH - margin, w: pipW, h: pipH },
    };
  }

  const termH = Math.round(height * (isLandscape ? 0.3 : 0.34));
  const browserH = height - termH;
  if (layout === "terminal-bottom") {
    return {
      browser: { x: 0, y: 0, w: width, h: browserH },
      term: { x: gap, y: browserH + gap, w: width - gap * 2, h: termH - gap * 2 },
    };
  }
  // terminal-top
  return {
    term: { x: gap, y: gap, w: width - gap * 2, h: termH - gap * 2 },
    browser: { x: 0, y: termH, w: width, h: browserH },
  };
}

function heroTermRect(width: number, height: number): Rect {
  const isLandscape = width > height;
  const w = Math.round(width * (isLandscape ? 0.8 : 0.88));
  const h = Math.round(height * (isLandscape ? 0.5 : 0.32));
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

// ── Terminal window ──────────────────────────────────────────────────────────
const Dot: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color }} />
);

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TerminalWindow: React.FC<{
  w: number;
  h: number;
  command: string;
  localFrame: number;
  typeEnd: number;
  spinStart: number;
  successFrame: number;
}> = ({ w, h, command, localFrame, typeEnd, spinStart, successFrame }) => {
  const { fps } = useVideoConfig();
  const radius = Math.round(Math.min(w, h) * 0.022);
  const titleH = Math.max(34, Math.round(h * 0.16));
  const padX = Math.round(w * 0.035);
  const padY = Math.round(h * 0.06);
  const font = Math.max(
    13,
    Math.floor(Math.min((w - padX * 2) / (command.length * 0.62), (h - titleH) / 7.5)),
  );

  const typed = Math.min(
    command.length,
    Math.round(
      interpolate(localFrame, [0, typeEnd], [0, command.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const typing = localFrame < typeEnd;
  const showSubmit = localFrame >= typeEnd && localFrame < spinStart;
  const showSpinner = localFrame >= spinStart && localFrame < successFrame;
  const showSuccess = localFrame >= successFrame;
  const spin = SPINNER[Math.floor(localFrame / 3) % SPINNER.length];

  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundColor: theme.bg,
        borderRadius: radius,
        border: "1px solid #1b2330",
        boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
        overflow: "hidden",
        fontFamily: theme.font,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: titleH,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: titleH * 0.22,
          padding: `0 ${titleH * 0.4}px`,
          backgroundColor: "#0e141d",
          borderBottom: "1px solid #1b2330",
        }}
      >
        <Dot color="#ff5f57" size={titleH * 0.3} />
        <Dot color="#febc2e" size={titleH * 0.3} />
        <Dot color="#28c840" size={titleH * 0.3} />
        <div style={{ flex: 1, textAlign: "center", color: theme.dim, fontSize: titleH * 0.34 }}>
          gflow — Google Flow from your terminal
        </div>
      </div>

      <div style={{ flex: 1, padding: `${padY}px ${padX}px`, fontSize: font, lineHeight: 1.5 }}>
        <div style={{ color: theme.fg, whiteSpace: "pre" }}>
          <span style={{ color: theme.accent }}>$ </span>
          {command.slice(0, typed)}
          {typing ? <span style={{ opacity: cursorOpacity(localFrame, fps) }}>▋</span> : null}
        </div>
        {showSubmit ? (
          <div style={{ color: theme.dim, marginTop: font * 0.7 }}>↵ submitting to Imagen…</div>
        ) : null}
        {showSpinner ? (
          <div style={{ color: theme.accent, marginTop: font * 0.7 }}>
            {spin} Imagen · generating 1 image…
          </div>
        ) : null}
        {showSuccess ? (
          <div style={{ marginTop: font * 0.7 }}>
            <div style={{ color: theme.accent }}>✓ done in 38s</div>
            <div style={{ color: theme.dim }}>{"  → serene-mountain-lake-at-dawn.jpg"}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Browser layer (fades in when the video begins) ───────────────────────────
const BrowserLayer: React.FC<{ rect: Rect }> = ({ rect }) => {
  const vf = useCurrentFrame();
  const opacity = interpolate(vf, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Landscape (wide) panels can't show the bottom input bar AND the upper-center
  // result image at once, so pan vertically: bias to the bottom (input field
  // being populated) during establish/generation, then ease up to the image for
  // the reveal. Tall/square/pip panels are height-driven and already show the
  // full crop (input + image), so anchorY is a no-op there.
  const anchorY =
    rect.w > rect.h
      ? interpolate(vf, [TERM_SPIN_START, TERM_SHARP_VF - 47], [0.82, 0.3], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0.5;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity,
      }}
    >
      <BrowserPanel w={rect.w} h={rect.h} anchorY={anchorY} />
    </div>
  );
};

// ── Hook card ────────────────────────────────────────────────────────────────
const HookCard: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(enter, [0, 1], [0.94, 1]);
  const base = Math.min(width, height);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        padding: base * 0.09,
        opacity: enter,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: base * 0.045, color: theme.accent, marginBottom: base * 0.04 }}>
        <span style={{ color: theme.dim }}>$ </span>gflow
        <span style={{ opacity: cursorOpacity(frame, fps) }}>▋</span>
      </div>
      <h1
        style={{
          fontSize: base * 0.085,
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.12,
          maxWidth: width * 0.86,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: base * 0.04, color: theme.dim, marginTop: base * 0.035, textAlign: "center" }}>
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};

// ── Split stage (terminal + browser, frame-local to the split sequence) ───────
const SplitStage: React.FC<{
  mode: Props["mode"];
  layout: Props["layout"];
  command: string;
  showVideo: boolean;
}> = ({ mode, layout, command, showVideo }) => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lead = leadFor(mode);

  // demote: 0 = hero terminal alone (prompt-first lead), 1 = final split layout.
  const demote =
    mode === "prompt-first"
      ? interpolate(localFrame, [lead - 8, lead + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      : 1;

  const { term: termFinal, browser } = finalRects(layout, width, height);
  const termRect = lerpRect(heroTermRect(width, height), termFinal, demote);

  // Terminal content timing (frames are split-local; video begins at `lead`).
  const typeEnd = lead > 0 ? Math.max(40, lead - 16) : TERM_TYPE_END;
  const spinStart = lead > 0 ? lead + 6 : TERM_SPIN_START;
  const successFrame = lead + TERM_SHARP_VF;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {showVideo ? (
        <Sequence from={lead} durationInFrames={TRIM_VIDEO_FRAMES} layout="none">
          <BrowserLayer rect={browser} />
        </Sequence>
      ) : null}
      <div style={{ position: "absolute", left: termRect.x, top: termRect.y, width: termRect.w, height: termRect.h }}>
        <TerminalWindow
          w={termRect.w}
          h={termRect.h}
          command={command}
          localFrame={localFrame}
          typeEnd={typeEnd}
          spinStart={spinStart}
          successFrame={successFrame}
        />
      </div>
    </AbsoluteFill>
  );
};

export const SplitPromo: React.FC<Props> = ({
  runDir,
  mode = "simultaneous",
  layout = "terminal-top",
  command,
  showHook = true,
  hookTitle,
  hookSubtitle,
}) => {
  const cmd = command ?? DEFAULT_COMMAND;
  const hookFrames = showHook ? SPLIT_HOOK_DURATION : 0;
  const showVideo = Boolean(runDir);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {showHook ? (
        <Sequence durationInFrames={hookFrames}>
          <HookCard
            title={hookTitle ?? "Drive Google Flow from your terminal."}
            subtitle={hookSubtitle ?? "Veo + Imagen, one command."}
          />
        </Sequence>
      ) : null}
      <Sequence from={hookFrames} layout="none">
        <SplitStage mode={mode} layout={layout} command={cmd} showVideo={showVideo} />
      </Sequence>
    </AbsoluteFill>
  );
};
