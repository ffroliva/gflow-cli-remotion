import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { theme, cursorOpacity } from "./theme";
import { HOOK_DURATION } from "../../../types/constants";

export const promoMasterSchema = z.object({
  runDir: z.string(),
  hookId: z.string().optional(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
});

type Props = z.infer<typeof promoMasterSchema>;

const TitleCard: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [24, 0]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ fontSize: 40, color: theme.accent, marginBottom: 28 }}>
        <span style={{ color: theme.dim }}>$ </span>gflow
        <span style={{ opacity: cursorOpacity(frame, fps) }}>▋</span>
      </div>
      <h1
        style={{
          fontSize: 84,
          fontWeight: 700,
          margin: 0,
          maxWidth: 1400,
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 36, color: theme.dim, marginTop: 24 }}>{subtitle}</p>
    </AbsoluteFill>
  );
};

const CommandBadge: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      position: "absolute",
      left: 48,
      bottom: 48,
      padding: "12px 20px",
      backgroundColor: "rgba(0,0,0,0.55)",
      border: `1px solid ${theme.accentDim}`,
      borderRadius: 8,
      fontFamily: theme.font,
      fontSize: 28,
      color: theme.accent,
    }}
  >
    <span style={{ color: theme.dim }}>$ </span>
    {label}
  </div>
);

export const PromoMaster: React.FC<Props> = ({
  runDir,
  hookTitle,
  hookSubtitle,
}) => {
  // The master recording is served from the per-render publicDir (set by
  // render-matrix to the run dir) via staticFile. file:// URLs are rejected
  // by Chromium's URL safety check on the localhost-served render page.
  const showVideo = Boolean(runDir);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={HOOK_DURATION}>
        <TitleCard
          title={hookTitle ?? "Drive Google Flow from your terminal."}
          subtitle={hookSubtitle ?? "Veo + Imagen, one command at a time."}
        />
      </Sequence>
      {showVideo ? (
        <Sequence from={HOOK_DURATION}>
          <AbsoluteFill style={{ backgroundColor: "black" }}>
            <OffthreadVideo src={staticFile("master.mp4")} />
            <CommandBadge label="gflow image t2i …" />
          </AbsoluteFill>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
