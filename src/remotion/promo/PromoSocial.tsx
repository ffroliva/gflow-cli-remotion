import {
  AbsoluteFill,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { theme } from "./theme";
import { HOOK_DURATION } from "../../../types/constants";

export const promoSocialSchema = z.object({
  runDir: z.string(),
  hookId: z.string().optional(),
  hookTitle: z.string().optional(),
  hookSubtitle: z.string().optional(),
});

type Props = z.infer<typeof promoSocialSchema>;

const Hook: React.FC<{ title: string; subtitle: string }> = ({
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
        padding: 80,
        opacity: enter,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 44, color: theme.accent, marginBottom: 40 }}>
        gflow
      </div>
      <h1
        style={{
          fontSize: 92,
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.12,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 44,
          color: theme.dim,
          marginTop: 36,
          textAlign: "center",
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};

export const PromoSocial: React.FC<Props> = ({
  runDir,
  hookTitle,
  hookSubtitle,
}) => {
  // Served from the per-render publicDir via staticFile (see PromoMaster note).
  const showVideo = Boolean(runDir);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Sequence durationInFrames={HOOK_DURATION}>
        <Hook
          title={hookTitle ?? "Your CLI talks to Veo."}
          subtitle={hookSubtitle ?? "Watch."}
        />
      </Sequence>
      {showVideo ? (
        <Sequence from={HOOK_DURATION}>
          <AbsoluteFill style={{ backgroundColor: "black" }}>
            {/* 16:9 master centred + scaled to fill the 9:16 safe area. */}
            <AbsoluteFill
              style={{ alignItems: "center", justifyContent: "center" }}
            >
              <div style={{ width: "100%", transform: "scale(2.1)" }}>
                <Video src={staticFile("master.mp4")} />
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
