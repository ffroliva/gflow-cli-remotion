import { Composition } from "remotion";
import { PromoMaster, promoMasterSchema } from "./promo/PromoMaster";
import { PromoSocial, promoSocialSchema } from "./promo/PromoSocial";
import { ReadmeLoop, readmeLoopSchema } from "./promo/ReadmeLoop";
import {
  Terminal,
  terminalSchema,
  terminalDuration,
} from "./promo/Terminal";
import {
  CharacterPromo,
  characterPromoSchema,
} from "./promo/CharacterPromo";
import {
  CharacterCapturePromo,
  characterCapturePromoSchema,
  calculateCharacterCaptureMetadata,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  FALLBACK_CAPTURE_SECONDS,
} from "./promo/CharacterCapturePromo";
import {
  FPS,
  MASTER,
  SOCIAL,
  README_LOOP,
  MASTER_DURATION,
  SOCIAL_DURATION,
  README_DURATION,
  CHARACTER_PROMO_DURATION,
} from "../../types/constants";

// `gflow character` social promo: one 9:16 composition per A/B hook angle.
// All four share the marina assets + timeline; only the hook caption differs.
const CHARACTER_PROMO_HOOKS: ReadonlyArray<{ id: string; title: string }> = [
  {
    id: "question",
    title: "What if your AI character looked the same in every shot?",
  },
  {
    id: "pain",
    title: "Your AI subject keeps changing face. Fix it in one command.",
  },
  {
    id: "flex",
    title: "One command → a reusable character: face, body, voice.",
  },
  {
    id: "dev",
    title: "Consistent characters, straight from your terminal.",
  },
];

const MARINA_ASSETS = {
  runDir: "captures/character-marina",
  faceFile: "captures/character-marina/face.jpg",
  bodyFile: "captures/character-marina/body-triptych.jpg",
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoMaster"
        component={PromoMaster}
        durationInFrames={MASTER_DURATION}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={promoMasterSchema}
        defaultProps={{
          runDir: "",
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="PromoSocial"
        component={PromoSocial}
        durationInFrames={SOCIAL_DURATION}
        fps={FPS}
        width={SOCIAL.width}
        height={SOCIAL.height}
        schema={promoSocialSchema}
        defaultProps={{
          runDir: "",
          hookId: "pov",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="ReadmeLoop"
        component={ReadmeLoop}
        durationInFrames={README_DURATION}
        fps={FPS}
        width={README_LOOP.width}
        height={README_LOOP.height}
        schema={readmeLoopSchema}
        defaultProps={{ runDir: "", caption: undefined }}
      />
      <Composition
        id="Terminal"
        component={Terminal}
        durationInFrames={terminalDuration()}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={terminalSchema}
        defaultProps={{ rowFrames: 13 }}
      />
      {CHARACTER_PROMO_HOOKS.map((hook) => (
        <Composition
          key={hook.id}
          id={`CharacterPromo-${hook.id}`}
          component={CharacterPromo}
          durationInFrames={CHARACTER_PROMO_DURATION}
          fps={FPS}
          width={SOCIAL.width}
          height={SOCIAL.height}
          schema={characterPromoSchema}
          defaultProps={{
            ...MARINA_ASSETS,
            hookId: hook.id,
            hookTitle: hook.title,
            hookSubtitle: undefined,
          }}
        />
      ))}
      <Composition
        id="CharacterCapturePromo"
        component={CharacterCapturePromo}
        // Placeholder duration; calculateMetadata overrides it with
        // intro + real capture length + outro. The fallback here matches the
        // probe-failure path so Studio shows a sane length before probing.
        durationInFrames={
          INTRO_FRAMES +
          Math.ceil(FALLBACK_CAPTURE_SECONDS * FPS) +
          OUTRO_FRAMES
        }
        fps={FPS}
        width={SOCIAL.width}
        height={SOCIAL.height}
        schema={characterCapturePromoSchema}
        calculateMetadata={calculateCharacterCaptureMetadata}
        defaultProps={{
          // Real browser-only capture of the Flow character editor showing the
          // generated "Marina" character (consistent face references). Recorded
          // via gflow-cli's dev-scoped Playwright harness
          // (scripts/dev/record_flow_capture.py) using Playwright's native
          // record_video_dir — captures only the page (no desktop), language/OS
          // agnostic. ~28s, 1280x720, letterboxed into 9:16 by the shell.
          captureFile: "captures/character-master.mp4",
          hookId: "flex",
          hookTitle: undefined,
          hookSubtitle: undefined,
          ctaText: undefined,
        }}
      />
    </>
  );
};
