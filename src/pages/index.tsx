import { Player } from "@remotion/player";
import type { NextPage } from "next";
import Head from "next/head";
import React, { useMemo, useState } from "react";
import { PromoMaster } from "../remotion/promo/PromoMaster";
import { PromoSocial } from "../remotion/promo/PromoSocial";
import { ReadmeLoop } from "../remotion/promo/ReadmeLoop";
import { hooks } from "../../types/hooks";
import {
  FPS,
  MASTER,
  SOCIAL,
  README_LOOP,
  MASTER_DURATION,
  SOCIAL_DURATION,
  README_DURATION,
} from "../../types/constants";

type CompId = "PromoMaster" | "PromoSocial" | "ReadmeLoop";

const COMPS = {
  PromoMaster: {
    component: PromoMaster,
    durationInFrames: MASTER_DURATION,
    ...MASTER,
  },
  PromoSocial: {
    component: PromoSocial,
    durationInFrames: SOCIAL_DURATION,
    ...SOCIAL,
  },
  ReadmeLoop: {
    component: ReadmeLoop,
    durationInFrames: README_DURATION,
    ...README_LOOP,
  },
} as const;

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0e14",
  color: "#e6e6e6",
  fontFamily: "monospace",
  padding: 32,
};

const Home: NextPage = () => {
  const [comp, setComp] = useState<CompId>("PromoSocial");
  const [hookId, setHookId] = useState<string>(hooks[0]!.id);

  const hook = useMemo(
    () => hooks.find((h) => h.id === hookId) ?? hooks[0]!,
    [hookId],
  );

  const selected = COMPS[comp];
  const inputProps = useMemo(
    () => ({
      runDir: "",
      hookId: hook.id,
      hookTitle: hook.title,
      hookSubtitle: hook.subtitle,
      caption: undefined as string | undefined,
    }),
    [hook],
  );

  return (
    <div style={page}>
      <Head>
        <title>gflow promo — preview</title>
        <meta name="description" content="gflow promo composition preview" />
      </Head>
      <h1 style={{ color: "#00e5a0" }}>gflow promo preview</h1>
      <p style={{ color: "#5c6773" }}>
        Local preview only — the master recording (file://) does not load in a
        browser. Use <code>pnpm remotion studio</code> for full playback against
        a real run dir.
      </p>

      <div style={{ display: "flex", gap: 16, margin: "24px 0" }}>
        <label>
          composition{" "}
          <select
            value={comp}
            onChange={(e) => setComp(e.target.value as CompId)}
          >
            {Object.keys(COMPS).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          hook{" "}
          <select value={hookId} onChange={(e) => setHookId(e.target.value)}>
            {hooks.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ maxWidth: 520 }}>
        <Player
          // key forces a clean remount when dimensions change between comps
          key={comp}
          component={selected.component}
          inputProps={inputProps}
          durationInFrames={selected.durationInFrames}
          fps={FPS}
          compositionWidth={selected.width}
          compositionHeight={selected.height}
          style={{ width: "100%" }}
          controls
          loop
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  );
};

export default Home;
