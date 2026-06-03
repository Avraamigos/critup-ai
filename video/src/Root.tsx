import { Composition } from 'remotion'
import { FPS, W, H } from './constants'
import { MascotComp }      from './MascotComp'
import { ScoresComp }      from './ScoresComp'
import { ChatComp }        from './ChatComp'
import { JuryComp }        from './JuryComp'
import { ScoreRevealComp } from './ScoreRevealComp'
import { BeforeAfterComp } from './BeforeAfterComp'
import { FeaturesComp }    from './FeaturesComp'
import { CTAComp }         from './CTAComp'

export function RemotionRoot() {
  return (
    <>
      {/* Original scenes */}
      <Composition id="Mascot"         component={MascotComp}      durationInFrames={FPS * 8}  fps={FPS} width={W} height={H} />
      <Composition id="MascotOnly"     component={MascotComp}      durationInFrames={FPS * 8}  fps={FPS} width={W} height={H} defaultProps={{ showText: false }} />
      <Composition id="Scores"      component={ScoresComp}      durationInFrames={FPS * 7}  fps={FPS} width={W} height={H} />
      <Composition id="Chat"        component={ChatComp}        durationInFrames={FPS * 12} fps={FPS} width={W} height={H} />
      <Composition id="Jury"        component={JuryComp}        durationInFrames={FPS * 14} fps={FPS} width={W} height={H} />

      {/* New scenes */}
      <Composition id="ScoreReveal" component={ScoreRevealComp} durationInFrames={FPS * 8}  fps={FPS} width={W} height={H} />
      <Composition id="BeforeAfter" component={BeforeAfterComp} durationInFrames={FPS * 9}  fps={FPS} width={W} height={H} />
      <Composition id="Features"    component={FeaturesComp}    durationInFrames={FPS * 12} fps={FPS} width={W} height={H} />
      <Composition id="CTA"         component={CTAComp}         durationInFrames={FPS * 8}  fps={FPS} width={W} height={H} />
    </>
  )
}
