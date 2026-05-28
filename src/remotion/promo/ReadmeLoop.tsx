import {
  AbsoluteFill,
  Sequence,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { theme, cursorOpacity } from "./theme";

export const readmeLoopSchema = z.object({
  runDir: z.string(),
  caption: z.string().optional(),
});

type Props = z.infer<typeof readmeLoopSchema>;

const INTRO_FRAMES = 45; // ~1.5s typed-command intro before the recording

const Intro: React.FC<{ caption: string }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = Math.min(caption.length, Math.floor(frame / 1.2));
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font,
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <div style={{ fontSize: 40 }}>
        <span style={{ color: theme.dim }}>$ </span>
        <span style={{ color: theme.accent }}>{caption.slice(0, chars)}</span>
        <span style={{ opacity: cursorOpacity(frame, fps) }}>▋</span>
      </div>
    </AbsoluteFill>
  );
};

export const ReadmeLoop: React.FC<Props> = ({ runDir, caption }) => {
  // Served from the per-render publicDir via staticFile (see PromoMaster note).
  const showVideo = Boolean(runDir);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <Intro caption={caption ?? "gflow image t2i \"a quiet mountain lake\""} />
      </Sequence>
      {showVideo ? (
        <Sequence from={INTRO_FRAMES}>
          <AbsoluteFill style={{ backgroundColor: "black" }}>
            <Video src={staticFile("master.mp4")} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
