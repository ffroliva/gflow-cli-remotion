import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { theme, cursorOpacity } from "./theme";
import { TERMINAL_SESSION } from "../../../types/terminal-session";

export const terminalSchema = z.object({
  rowFrames: z.number().int().positive().optional(),
});

type Row = { kind: "cmd" | "out" | "gap"; text: string };

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const step of TERMINAL_SESSION) {
    rows.push({ kind: "cmd", text: step.command });
    for (const o of step.output) rows.push({ kind: "out", text: o });
    rows.push({ kind: "gap", text: "" });
  }
  return rows;
}

const ROWS = buildRows();

/** Frames the terminal needs to reveal every row + a tail. */
export function terminalDuration(rowFrames = 13): number {
  return ROWS.length * rowFrames + 40;
}

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: "50%",
      backgroundColor: color,
    }}
  />
);

export const Terminal: React.FC<z.infer<typeof terminalSchema>> = ({
  rowFrames = 13,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visible = Math.min(ROWS.length, Math.floor(frame / rowFrames) + 1);
  const shown = ROWS.slice(0, visible);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#05080c",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          width: 1500,
          height: 860,
          backgroundColor: theme.bg,
          borderRadius: 16,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          border: `1px solid #1b2330`,
          overflow: "hidden",
        }}
      >
        {/* title bar */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 24px",
            backgroundColor: "#0e141d",
            borderBottom: `1px solid #1b2330`,
          }}
        >
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
          <div
            style={{
              flex: 1,
              textAlign: "center",
              color: theme.dim,
              fontSize: 24,
            }}
          >
            gflow — Google Flow from your terminal
          </div>
        </div>

        {/* body */}
        <div style={{ padding: 36, fontSize: 30, lineHeight: 1.5 }}>
          {shown.map((row, i) => {
            const isLast = i === shown.length - 1;
            if (row.kind === "gap") return <div key={i} style={{ height: 18 }} />;
            const color = row.kind === "cmd" ? theme.fg : theme.dim;
            return (
              <div key={i} style={{ color, whiteSpace: "pre" }}>
                {row.kind === "cmd" ? (
                  <span style={{ color: theme.accent }}>$ </span>
                ) : null}
                {row.text}
                {isLast ? (
                  <span style={{ opacity: cursorOpacity(frame, fps) }}>▋</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
