import { Composition } from "remotion";
import { PromoMaster, promoMasterSchema } from "./promo/PromoMaster";
import { PromoSocial, promoSocialSchema } from "./promo/PromoSocial";
import { ReadmeLoop, readmeLoopSchema } from "./promo/ReadmeLoop";
import {
  FPS,
  MASTER,
  SOCIAL,
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
    </>
  );
};
