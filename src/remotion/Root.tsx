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
  SplitPromo,
  splitPromoSchema,
  splitDuration,
  calculateSplitMetadata,
} from "./promo/SplitPromo";
import {
  WorkflowPromo,
  workflowPromoSchema,
  WORKFLOW_PROMO_DURATION_FRAMES,
  WORKFLOW_PROMO_FPS,
  WORKFLOW_PROMO_WIDTH,
  WORKFLOW_PROMO_HEIGHT,
} from "./promo/WorkflowPromo";
import {
  FPS,
  MASTER,
  SOCIAL,
  SQUARE,
  README_LOOP,
  MASTER_DURATION,
  SOCIAL_DURATION,
  README_DURATION,
} from "../../types/constants";

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
      {/* ── 60s 9:16 stickman workflow promo from the wf-004 paid capture.
          Three closer variants share the same first 50s; only the final 10s
          differ — render each via its dedicated comp id. ── */}
      <Composition
        id="WorkflowPromo-Pip"
        component={WorkflowPromo}
        durationInFrames={WORKFLOW_PROMO_DURATION_FRAMES}
        fps={WORKFLOW_PROMO_FPS}
        width={WORKFLOW_PROMO_WIDTH}
        height={WORKFLOW_PROMO_HEIGHT}
        schema={workflowPromoSchema}
        defaultProps={{ closer: "pip" as const }}
      />
      <Composition
        id="WorkflowPromo-Data"
        component={WorkflowPromo}
        durationInFrames={WORKFLOW_PROMO_DURATION_FRAMES}
        fps={WORKFLOW_PROMO_FPS}
        width={WORKFLOW_PROMO_WIDTH}
        height={WORKFLOW_PROMO_HEIGHT}
        schema={workflowPromoSchema}
        defaultProps={{ closer: "data" as const }}
      />
      <Composition
        id="WorkflowPromo-Minio"
        component={WorkflowPromo}
        durationInFrames={WORKFLOW_PROMO_DURATION_FRAMES}
        fps={WORKFLOW_PROMO_FPS}
        width={WORKFLOW_PROMO_WIDTH}
        height={WORKFLOW_PROMO_HEIGHT}
        schema={workflowPromoSchema}
        defaultProps={{ closer: "minio" as const }}
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

      {/* Split-screen campaign comps: terminal + browser in one frame.
          Duration is computed by calculateSplitMetadata from mode/showHook. */}

      {/* ── Simultaneous (terminal + browser together) ── */}
      <Composition
        id="SplitMaster16x9"
        component={SplitPromo}
        durationInFrames={splitDuration(true, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: true,
          hookId: "question",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitMasterBottom"
        component={SplitPromo}
        durationInFrames={splitDuration(true, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "terminal-bottom" as const,
          command: undefined,
          showHook: true,
          hookId: "pain",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitMasterPip"
        component={SplitPromo}
        durationInFrames={splitDuration(true, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "pip" as const,
          command: undefined,
          showHook: true,
          hookId: "question",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitSocial9x16"
        component={SplitPromo}
        durationInFrames={splitDuration(true, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={SOCIAL.width}
        height={SOCIAL.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: true,
          hookId: "question",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitSquare1x1"
        component={SplitPromo}
        durationInFrames={splitDuration(true, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={SQUARE.width}
        height={SQUARE.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: true,
          hookId: "pain",
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />

      {/* ── Prompt-first (type the command, then the browser slides in) ── */}
      <Composition
        id="SplitMasterPF"
        component={SplitPromo}
        durationInFrames={splitDuration(false, "prompt-first")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "prompt-first" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: false,
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitMasterBottomPF"
        component={SplitPromo}
        durationInFrames={splitDuration(false, "prompt-first")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={MASTER.width}
        height={MASTER.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "prompt-first" as const,
          layout: "terminal-bottom" as const,
          command: undefined,
          showHook: false,
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitSocialPF"
        component={SplitPromo}
        durationInFrames={splitDuration(false, "prompt-first")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={SOCIAL.width}
        height={SOCIAL.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "prompt-first" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: false,
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
      <Composition
        id="SplitSquarePF"
        component={SplitPromo}
        durationInFrames={splitDuration(false, "prompt-first")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={SQUARE.width}
        height={SQUARE.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "prompt-first" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: false,
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />

      {/* README GIF source (action-first loop, kept snappy on the v1 master). */}
      <Composition
        id="SplitReadme"
        component={SplitPromo}
        durationInFrames={splitDuration(false, "simultaneous")}
        calculateMetadata={calculateSplitMetadata}
        fps={FPS}
        width={README_LOOP.width}
        height={README_LOOP.height}
        schema={splitPromoSchema}
        defaultProps={{
          runDir: "",
          mode: "simultaneous" as const,
          layout: "terminal-top" as const,
          command: undefined,
          showHook: false,
          hookId: undefined,
          hookTitle: undefined,
          hookSubtitle: undefined,
        }}
      />
    </>
  );
};
