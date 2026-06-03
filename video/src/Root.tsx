import { Composition } from 'remotion'
import { FPS, W, H } from './constants'
import { MascotComp }   from './MascotComp'
import { ScoresComp }   from './ScoresComp'
import { ChatComp }     from './ChatComp'
import { JuryComp }     from './JuryComp'

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Mascot"
        component={MascotComp}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Scores"
        component={ScoresComp}
        durationInFrames={FPS * 7}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Chat"
        component={ChatComp}
        durationInFrames={FPS * 12}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Jury"
        component={JuryComp}
        durationInFrames={FPS * 14}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  )
}
