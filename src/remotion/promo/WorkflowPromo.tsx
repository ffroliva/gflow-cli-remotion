/**
 * 60s 9:16 social promo built from the wf-004 live paid capture.
 *
 * Four beats, time-compressed from a 178s real run into 60s:
 *   Beat 1 (0-15s)  — t2i:  "gflow image t2i ..." typed -> 01-t2i.jpg reveal
 *   Beat 2 (15-30s) — i2i:  "gflow image i2i ... --ref 01-t2i.jpg" -> 02-i2i.jpg
 *   Beat 3 (30-50s) — i2v:  "gflow video i2v ... --end-image 02-i2i.jpg" -> 03-video.mp4 plays
 *   Beat 4 (50-60s) — closer: 3 variants via the `closer` prop (data | minio | pip)
 *
 * Source artifacts live in public/promo/stickman-001/ — copied there from the
 * paid capture's outRoot so Remotion can staticFile() them.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

// Closer-variant schema — picked per render via the input prop. The launch
// playbook (promo/v0.10.0-launch.md) maps these to platform audiences.
export const workflowPromoSchema = z.object({
  closer: z.enum(["data", "minio", "pip"]).default("pip"),
});

export type WorkflowPromoProps = z.infer<typeof workflowPromoSchema>;

// Beat boundaries (seconds → frames at 30fps). Re-derived in Sequence calls
// below; centralised here so adjustments stay coherent.
const FPS = 30;
const BEAT_T2I_FRAMES = 15 * FPS; // 0-450
const BEAT_I2I_FRAMES = 15 * FPS; // 450-900
const BEAT_I2V_FRAMES = 20 * FPS; // 900-1500
const BEAT_CLOSER_FRAMES = 10 * FPS; // 1500-1800

export const WORKFLOW_PROMO_DURATION_FRAMES =
  BEAT_T2I_FRAMES + BEAT_I2I_FRAMES + BEAT_I2V_FRAMES + BEAT_CLOSER_FRAMES;
export const WORKFLOW_PROMO_FPS = FPS;
export const WORKFLOW_PROMO_WIDTH = 1080;
export const WORKFLOW_PROMO_HEIGHT = 1920;

// ── Visual primitives ───────────────────────────────────────────────────────

const TERMINAL_FONT =
  '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Menlo, monospace';

const COLORS = {
  bgDark: "#0a0a0a",
  bgWarm: "#161210",
  terminalText: "#e6c690", // warm amber, matches Compiled Growth dawn aesthetic
  prompt: "#d4a657",
  cursor: "#e6c690",
  subtle: "#888",
  accent: "#ffd29a",
  pip: "#f5e6c8",
};

/** Terminal panel — typed command revealed character-by-character based on the
 *  current frame WITHIN the parent <Sequence> (useCurrentFrame is already
 *  Sequence-local). The cursor blinks at ~2Hz. */
const Terminal: React.FC<{
  command: string;
  typeDurationFrames: number;
  height: number;
  output?: React.ReactNode;
}> = ({ command, typeDurationFrames, height, output }) => {
  const beatFrame = useCurrentFrame();
  const ratio = Math.max(0, Math.min(1, beatFrame / typeDurationFrames));
  const charsShown = Math.floor(command.length * ratio);
  const visible = command.slice(0, charsShown);
  const blink = Math.floor((beatFrame / FPS) * 2) % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        top: 0,
        height,
        background: COLORS.bgDark,
        borderBottom: "1px solid #2a2a2a",
        padding: "60px 50px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          color: COLORS.subtle,
          fontFamily: TERMINAL_FONT,
          fontSize: 24,
          marginBottom: 24,
          opacity: 0.8,
        }}
      >
        ~/promo · gflow 0.10.0
      </div>
      <div
        style={{
          color: COLORS.terminalText,
          fontFamily: TERMINAL_FONT,
          fontSize: 30,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        <span style={{ color: COLORS.prompt }}>$ </span>
        {visible}
        {blink && charsShown < command.length && (
          <span style={{ color: COLORS.cursor }}>▌</span>
        )}
        {charsShown >= command.length && (
          <span style={{ color: COLORS.cursor }}>{blink ? "▌" : " "}</span>
        )}
      </div>
      {output && (
        <div
          style={{
            marginTop: 28,
            color: COLORS.subtle,
            fontFamily: TERMINAL_FONT,
            fontSize: 22,
            opacity: ratio < 1 ? 0 : 1,
          }}
        >
          {output}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Lower panel — fades in the produced artifact after the command finishes typing.
 *  Used for t2i + i2i + i2v beats with their respective media. */
const ArtifactPanel: React.FC<{
  revealDelayFrames: number;
  topOffset: number;
  height: number;
  children: React.ReactNode;
}> = ({ revealDelayFrames, topOffset, height, children }) => {
  const beatFrame = useCurrentFrame();
  const opacity = interpolate(
    beatFrame,
    [revealDelayFrames, revealDelayFrames + 18, revealDelayFrames + 36],
    [0, 0.4, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(
    beatFrame,
    [revealDelayFrames, revealDelayFrames + 36],
    [0.92, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        top: topOffset,
        height,
        background: COLORS.bgWarm,
        padding: 40,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          opacity,
          transform: `scale(${scale})`,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 30px 80px rgba(230, 198, 144, 0.18), 0 0 0 1px rgba(230, 198, 144, 0.25)",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

// ── Beat sub-components ─────────────────────────────────────────────────────

const TOP_HEIGHT = Math.round(WORKFLOW_PROMO_HEIGHT * 0.4); // 768
const BOTTOM_HEIGHT = WORKFLOW_PROMO_HEIGHT - TOP_HEIGHT; // 1152

const T2I_CMD = 'gflow image t2i "stickman at 5am ..." \\\n  --aspect 9:16 --model nano-pro';
const I2I_CMD =
  'gflow image i2i "now triumphant at sunrise" \\\n  --ref 01-t2i.jpg --aspect 9:16';
const I2V_CMD =
  'gflow video i2v 01-t2i.jpg "rise and stretch" \\\n  --end-image 02-i2i.jpg --aspect 9:16';

const BeatT2I: React.FC = () => (
  <>
    <Terminal
      command={T2I_CMD}
      typeDurationFrames={5 * FPS}
      height={TOP_HEIGHT}
      output={"→ initial frame"}
    />
    <ArtifactPanel
      revealDelayFrames={6 * FPS}
      topOffset={TOP_HEIGHT}
      height={BOTTOM_HEIGHT}
    >
      <Img
        src={staticFile("promo/stickman-001/01-t2i.jpg")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </ArtifactPanel>
  </>
);

const BeatI2I: React.FC = () => (
  <>
    <Terminal
      command={I2I_CMD}
      typeDurationFrames={5 * FPS}
      height={TOP_HEIGHT}
      output={"→ end frame · same character, sunrise"}
    />
    <ArtifactPanel
      revealDelayFrames={6 * FPS}
      topOffset={TOP_HEIGHT}
      height={BOTTOM_HEIGHT}
    >
      <Img
        src={staticFile("promo/stickman-001/02-i2i.jpg")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </ArtifactPanel>
  </>
);

const BeatI2V: React.FC = () => (
  // The actual Veo video is 8s; play it inside the lower panel after the
  // command is typed. We hold the last frame briefly via the panel's natural
  // duration spilling past the video.
  <>
    <Terminal
      command={I2V_CMD}
      typeDurationFrames={6 * FPS}
      height={TOP_HEIGHT}
      output={"→ Veo interpolates start → end · 8s · omni-flash"}
    />
    <ArtifactPanel
      revealDelayFrames={7 * FPS}
      topOffset={TOP_HEIGHT}
      height={BOTTOM_HEIGHT}
    >
      <OffthreadVideo
        src={staticFile("promo/stickman-001/03-video.mp4")}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
        playbackRate={1}
      />
    </ArtifactPanel>
  </>
);

// ── Closer variants ─────────────────────────────────────────────────────────

const CloserPip: React.FC = () => {
  const beatFrame = useCurrentFrame();
  const cardOpacity = interpolate(beatFrame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const installScale = interpolate(beatFrame, [20, 60], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDark,
        opacity: cardOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          color: COLORS.subtle,
          fontFamily: TERMINAL_FONT,
          fontSize: 28,
          marginBottom: 28,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        gflow · v0.10.0
      </div>
      <div
        style={{
          color: COLORS.pip,
          fontFamily: TERMINAL_FONT,
          fontSize: 64,
          fontWeight: 600,
          textAlign: "center",
          transform: `scale(${installScale})`,
          marginBottom: 24,
        }}
      >
        pip install gflow-cli
      </div>
      <div
        style={{
          color: COLORS.accent,
          fontFamily: TERMINAL_FONT,
          fontSize: 30,
          marginTop: 20,
          letterSpacing: 1,
        }}
      >
        github.com/ffroliva/gflow-cli
      </div>
    </AbsoluteFill>
  );
};

const CloserData: React.FC = () => {
  const beatFrame = useCurrentFrame();
  const fade = interpolate(beatFrame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDark,
        opacity: fade,
        padding: 60,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: COLORS.subtle,
          fontFamily: TERMINAL_FONT,
          fontSize: 24,
          marginBottom: 24,
        }}
      >
        ~/promo · gflow data list videos
      </div>
      <div
        style={{
          color: COLORS.terminalText,
          fontFamily: TERMINAL_FONT,
          fontSize: 26,
          lineHeight: 1.7,
          marginBottom: 32,
        }}
      >
        <div>
          <span style={{ color: COLORS.subtle }}>media_id</span>{" "}
          <span style={{ color: COLORS.accent }}>03-video.mp4</span>
        </div>
        <div style={{ color: COLORS.subtle }}>
          prompt &nbsp;&nbsp;rise and stretch …
        </div>
        <div style={{ color: COLORS.subtle }}>
          duration &nbsp;8s &nbsp;model omni-flash
        </div>
        <div style={{ color: COLORS.subtle }}>
          refs &nbsp;&nbsp;&nbsp;&nbsp;01-t2i.jpg, 02-i2i.jpg
        </div>
      </div>
      <div
        style={{
          color: COLORS.pip,
          fontFamily: TERMINAL_FONT,
          fontSize: 38,
          marginTop: 40,
          textAlign: "center",
        }}
      >
        every prompt · indexed locally
      </div>
      <div
        style={{
          color: COLORS.accent,
          fontFamily: TERMINAL_FONT,
          fontSize: 28,
          marginTop: 18,
          textAlign: "center",
        }}
      >
        github.com/ffroliva/gflow-cli
      </div>
    </AbsoluteFill>
  );
};

const CloserMinio: React.FC = () => {
  const beatFrame = useCurrentFrame();
  const fade = interpolate(beatFrame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDark,
        opacity: fade,
        padding: 60,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: COLORS.subtle,
          fontFamily: TERMINAL_FONT,
          fontSize: 22,
          marginBottom: 20,
        }}
      >
        GFLOW_CLI_STORAGE_URI=s3://gflow-test
      </div>
      <div
        style={{
          background: "#1c1815",
          border: `1px solid ${COLORS.terminalText}33`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            color: COLORS.accent,
            fontFamily: TERMINAL_FONT,
            fontSize: 24,
            marginBottom: 12,
            letterSpacing: 2,
          }}
        >
          ▌ minio · gflow-test
        </div>
        <div
          style={{
            color: COLORS.terminalText,
            fontFamily: TERMINAL_FONT,
            fontSize: 22,
            lineHeight: 1.7,
          }}
        >
          <div>📁 01-t2i.jpg &nbsp; 447KB</div>
          <div>📁 02-i2i.jpg &nbsp; 569KB</div>
          <div>🎬 03-video.mp4 &nbsp; 1.85MB</div>
        </div>
      </div>
      <div
        style={{
          color: COLORS.pip,
          fontFamily: TERMINAL_FONT,
          fontSize: 38,
          marginTop: 20,
          textAlign: "center",
        }}
      >
        your bucket · not someone else's
      </div>
      <div
        style={{
          color: COLORS.accent,
          fontFamily: TERMINAL_FONT,
          fontSize: 28,
          marginTop: 18,
          textAlign: "center",
        }}
      >
        github.com/ffroliva/gflow-cli
      </div>
    </AbsoluteFill>
  );
};

// ── Composition root ───────────────────────────────────────────────────────

export const WorkflowPromo: React.FC<WorkflowPromoProps> = ({ closer }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        width,
        height,
        background: COLORS.bgDark,
      }}
    >
      <Sequence durationInFrames={BEAT_T2I_FRAMES} from={0}>
        <BeatT2I />
      </Sequence>
      <Sequence
        durationInFrames={BEAT_I2I_FRAMES}
        from={BEAT_T2I_FRAMES}
      >
        <BeatI2I />
      </Sequence>
      <Sequence
        durationInFrames={BEAT_I2V_FRAMES}
        from={BEAT_T2I_FRAMES + BEAT_I2I_FRAMES}
      >
        <BeatI2V />
      </Sequence>
      <Sequence
        durationInFrames={BEAT_CLOSER_FRAMES}
        from={BEAT_T2I_FRAMES + BEAT_I2I_FRAMES + BEAT_I2V_FRAMES}
      >
        {closer === "pip" && <CloserPip />}
        {closer === "data" && <CloserData />}
        {closer === "minio" && <CloserMinio />}
      </Sequence>
    </AbsoluteFill>
  );
};
