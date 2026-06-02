/**
 * /showcase — Video export helper page
 * White background, isolated animated elements for motion graphic recording.
 * DELETE THIS PAGE after video production is done.
 */
import { useState, useEffect, useRef } from 'react'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const ORANGE = '#F97316'
const ORANGE_DARK = '#e05500'

// ── Animated counter (counts from 0 → target with ease-out) ──
function useCounter(target: number, duration = 1400, trigger = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger) { setVal(0); return }
    let start: number | null = null
    let raf: number
    const tick = (now: number) => {
      if (!start) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setVal(parseFloat((target * eased).toFixed(1)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setVal(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [trigger, target, duration])
  return val
}

// ── Global CSS (injected once) ──
const CSS = `
  @keyframes sc-float    { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-12px)} }
  @keyframes sc-pulse    { 0%,100%{opacity:.45;box-shadow:0 0 22px rgba(249,115,22,.35)} 50%{opacity:.85;box-shadow:0 0 60px rgba(249,115,22,.7)} }
  @keyframes sc-blink    { 0%,88%,100%{transform:scaleY(1)} 94%{transform:scaleY(0.05)} }
  @keyframes sc-glance   { 0%,20%{transform:translateX(0)} 28%,40%{transform:translateX(-38%)} 48%,58%{transform:translateX(0)} 66%,78%{transform:translateX(38%)} 86%,100%{transform:translateX(0)} }
  @keyframes sc-ring     { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.6);opacity:0} }
  @keyframes sc-pop      { from{opacity:0;transform:translateY(12px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes sc-typing   { from{width:0} to{width:100%} }
  @keyframes sc-cursor   { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes sc-spin     { to{transform:rotate(360deg)} }
  @keyframes sc-count-bg { 0%{stroke-dashoffset:283} 100%{stroke-dashoffset:var(--target-offset)} }
  @keyframes sc-shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes sc-slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sc-fade-in  { from{opacity:0} to{opacity:1} }
`

// ─────────────────────────────────────────────────────────────
// SCENE 1: Mascot
// ─────────────────────────────────────────────────────────────
function MascotScene() {
  const S = 240
  const s = S / 100
  const eyeW = Math.round(10 * s)
  const eyeH = Math.round(17 * s)
  const eyeGap = Math.round(14 * s)

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 40 }}>
      {/* Ripple rings */}
      <div style={{ position:'relative', width: S + 100, height: S + 100, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position:'absolute', borderRadius:'50%',
            width: S + 20 + i * 38, height: S + 20 + i * 38,
            border: '1.5px solid rgba(249,115,22,0.22)',
            animation: `sc-ring 2.8s ease-out ${i * 0.7}s infinite`,
          }} />
        ))}

        {/* Orb glow halo */}
        <div style={{
          position:'absolute', width: S, height: S, borderRadius:'50%',
          background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
          filter:'blur(18px)', opacity:.5,
          animation:'sc-pulse 3s ease-in-out infinite alternate',
        }} />

        {/* Main orb */}
        <div style={{
          width: S, height: S, borderRadius:'50%', position:'relative', zIndex:1,
          background: 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
          animation:'sc-float 4s ease-in-out infinite',
          boxShadow: '0 24px 60px rgba(249,115,22,.35)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {/* Specular highlight */}
          <div style={{
            position:'absolute', top:'18%', left:'18%',
            width:'32%', height:'22%',
            background:'rgba(255,255,255,0.22)',
            borderRadius:'50%', transform:'rotate(-30deg)',
            pointerEvents:'none',
          }} />

          {/* Eyes */}
          <div style={{ display:'flex', gap: eyeGap, animation:'sc-glance 6s ease-in-out infinite', position:'relative', zIndex:2 }}>
            {[0,1].map(i => (
              <div key={i} style={{
                width: eyeW, height: eyeH, borderRadius: 999,
                background:'#fff',
                boxShadow:'0 0 10px rgba(255,255,255,.95)',
                animation:'sc-blink 5s ease-in-out infinite',
                transformOrigin:'center',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Name + tagline */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing:'-0.04em', color:'#0f172a', lineHeight:1, fontFamily: FONT }}>
          Crit<span style={{ color: ORANGE }}></span>
        </div>
        <div style={{ fontSize: 18, color:'#64748b', marginTop: 12, fontWeight: 500, letterSpacing:'-0.01em' }}>
          Your AI architecture jury — always ready
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 2: Score Cards
// ─────────────────────────────────────────────────────────────
function ScoreCircle({ score, label, color, trigger, delay = 0 }: { score: number, label: string, color: string, trigger: boolean, delay?: number }) {
  const val = useCounter(score, 1400, trigger)
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ - (val / 10) * circ

  return (
    <div style={{
      background:'#fff', borderRadius: 24, padding:'32px 28px',
      boxShadow:'0 4px 32px rgba(0,0,0,0.08)', textAlign:'center',
      border:`1px solid #f1f5f9`, width: 190,
      animation: trigger ? `sc-pop .5s ease ${delay}s both` : 'none',
    }}>
      <svg width={100} height={100} viewBox="0 0 100 100" style={{ display:'block', margin:'0 auto 16px' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition:'stroke-dashoffset 0.05s linear' }}
        />
        <text x="50" y="44" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily={FONT} fill="#0f172a">{val.toFixed(1)}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={FONT} fill="#94a3b8">/10</text>
      </svg>
      <div style={{ fontSize: 14, fontWeight: 700, color:'#0f172a', letterSpacing:'-0.01em' }}>{label}</div>
    </div>
  )
}

function ScoresScene() {
  const [trigger, setTrigger] = useState(false)
  const overall = useCounter(8.5, 1600, trigger)

  useEffect(() => {
    const t = setTimeout(() => setTrigger(true), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 48 }}>
      {/* Header */}
      <div style={{ textAlign:'center', animation: trigger ? 'sc-slide-up .5s ease both' : 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE, letterSpacing:'.1em', textTransform:'uppercase', marginBottom: 8 }}>AI Critique Report</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing:'-0.03em', color:'#0f172a', fontFamily: FONT }}>Riverside Cultural Pavilion</div>
        <div style={{ fontSize: 15, color:'#64748b', marginTop: 6 }}>Finalized Design · Full Analysis</div>
      </div>

      {/* Three score cards */}
      <div style={{ display:'flex', gap: 20 }}>
        <ScoreCircle score={8.5} label="Concept"      color={ORANGE}               trigger={trigger} delay={0} />
        <ScoreCircle score={7.2} label="Spatial"      color="oklch(0.65 0.18 25)"  trigger={trigger} delay={0.12} />
        <ScoreCircle score={9.1} label="Presentation" color="oklch(0.72 0.17 145)" trigger={trigger} delay={0.24} />
      </div>

      {/* Overall grade badge */}
      <div style={{
        display:'flex', alignItems:'center', gap: 20,
        background:'#fff', borderRadius: 20, padding:'20px 36px',
        boxShadow:'0 4px 32px rgba(0,0,0,0.08)', border:`1.5px solid ${ORANGE}22`,
        animation: trigger ? 'sc-pop .5s ease .4s both' : 'none',
      }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: ORANGE, letterSpacing:'-0.04em', lineHeight:1, fontFamily: FONT }}>
          {overall.toFixed(1)}<span style={{ fontSize: 24, color:'#94a3b8', fontWeight: 600 }}>/10</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color:'#94a3b8', letterSpacing:'.08em', textTransform:'uppercase', marginBottom: 4 }}>Overall Score</div>
          <div style={{ fontSize: 15, fontWeight: 700, color:'#0f172a' }}>Strong submission 🎯</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 3: Analysis Window (macOS-style)
// ─────────────────────────────────────────────────────────────
function AnalysisScene() {
  const sections = [
    {
      title: 'Concept & Narrative',
      score: 8.5,
      color: ORANGE,
      text: 'Your cultural pavilion demonstrates a compelling conceptual framework rooted in the tension between industrial heritage and civic openness. The parti diagram effectively communicates the "fold" strategy, where the roof plane becomes both shelter and public datum. The conceptual consistency from diagram to plan is commendable — the jury will appreciate this clarity of intent.',
    },
    {
      title: 'Spatial Logic',
      score: 7.2,
      color: 'oklch(0.65 0.18 25)',
      text: 'The sectional relationship between the gallery void and the workshop mezzanine is your strongest spatial move. However, the transition from the public plaza into the entry sequence feels unresolved — the threshold lacks the ceremonial quality your program demands. Revisit the compression-expansion rhythm at this junction.',
    },
    {
      title: 'Presentation Quality',
      score: 9.1,
      color: 'oklch(0.72 0.17 145)',
      text: 'Exceptional graphic consistency across all sheets. Line weights are disciplined and the axonometric reads at a glance. The material palette diagram is a standout — it communicates tectonic intent without being literal. Consider adding one more atmospheric render to emotionally anchor the project.',
    },
  ]

  return (
    <div style={{
      width: 780, background:'#fff', borderRadius: 18,
      boxShadow:'0 20px 80px rgba(0,0,0,0.14)',
      overflow:'hidden', border:'1px solid #e2e8f0',
      animation:'sc-pop .5s ease both',
    }}>
      {/* Window chrome */}
      <div style={{
        background:'#f8fafc', borderBottom:'1px solid #e2e8f0',
        padding:'14px 18px', display:'flex', alignItems:'center', gap: 12,
      }}>
        <div style={{ display:'flex', gap: 7 }}>
          {['#ff5f57','#ffbd2e','#28c840'].map(c => (
            <div key={c} style={{ width: 13, height: 13, borderRadius:'50%', background: c }} />
          ))}
        </div>
        <div style={{ flex:1, background:'#eff2f7', borderRadius: 8, padding:'5px 14px', fontSize: 12, color:'#94a3b8', textAlign:'center' }}>
          critup.ai/analysis/riverside-pavilion
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'28px 32px', maxHeight: 500, overflowY:'auto' }}>
        {/* Project header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing:'.1em', textTransform:'uppercase', marginBottom: 6 }}>Analysis Complete</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing:'-0.03em', color:'#0f172a', fontFamily: FONT }}>Riverside Cultural Pavilion</div>
            <div style={{ fontSize: 13, color:'#64748b', marginTop: 4 }}>Finalized Design · Jury Prep focus</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: ORANGE, lineHeight:1, fontFamily: FONT }}>8.5</div>
            <div style={{ fontSize: 12, color:'#94a3b8', fontWeight: 600 }}>/10 overall</div>
          </div>
        </div>

        {/* Sections */}
        {sections.map((s, i) => (
          <div key={s.title} style={{
            marginBottom: 24, padding:'20px 22px', borderRadius: 14,
            background:'#f8fafc', border:`1px solid #e2e8f0`,
            animation: `sc-slide-up .4s ease ${i * 0.15}s both`,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color:'#0f172a' }}>{s.title}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: FONT }}>{s.score}<span style={{ fontSize: 12, color:'#94a3b8' }}>/10</span></div>
            </div>
            {/* Score bar */}
            <div style={{ height: 4, background:'#e2e8f0', borderRadius: 99, marginBottom: 12, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${s.score * 10}%`, background: s.color, borderRadius: 99, transition:'width 1s ease' }} />
            </div>
            <div style={{ fontSize: 13, color:'#475569', lineHeight: 1.65 }}>{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 4: Chat Bubbles
// ─────────────────────────────────────────────────────────────
function ChatScene() {
  const [visible, setVisible] = useState(0)
  const messages = [
    { role:'ai',   text:"Hi! I've finished analysing **Riverside Cultural Pavilion**. Your strongest move is the sectional relationship — the jury will love it. Want me to walk you through the weakest points first?" },
    { role:'user', text:"Yes, what should I fix before jury?" },
    { role:'ai',   text:"Focus on two things: 1️⃣ The entry threshold — compress the space before the gallery void to create drama. 2️⃣ Add a detail drawing of the roof fold connection. Juries always push on tectonic honesty for pavilion typologies." },
    { role:'user', text:"What question will they ask about my concept?" },
    { role:'ai',   text:'Expect: *"How does the industrial vocabulary serve the civic program rather than just reference it?"* — prepare a 30-second answer that connects your material palette to community memory. That framing will land.' },
  ]

  useEffect(() => {
    if (visible >= messages.length) return
    const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 400 : 1100)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <div style={{ width: 520, display:'flex', flexDirection:'column', gap: 14 }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', gap: 12,
        background:'#fff', borderRadius: 16, padding:'14px 18px',
        boxShadow:'0 2px 16px rgba(0,0,0,0.07)', border:'1px solid #e2e8f0',
        marginBottom: 6,
      }}>
        {/* Orb mini */}
        <div style={{ width: 36, height: 36, borderRadius:'50%', background:'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0, boxShadow:'0 0 16px rgba(255,107,0,.35)', animation:'sc-pulse 3s ease-in-out infinite alternate' }}>
          <div style={{ display:'flex', gap: 3 }}>
            {[0,1].map(i => <div key={i} style={{ width: 4, height: 7, borderRadius: 99, background:'#fff', animation:'sc-blink 5s ease-in-out infinite' }} />)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color:'#0f172a' }}>Crit</div>
          <div style={{ display:'flex', alignItems:'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius:'50%', background:'#4ade80' }} />
            <span style={{ fontSize: 11, color:'#94a3b8' }}>Online · Ask me anything</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {messages.slice(0, visible).map((m, i) => (
        <div key={i} style={{
          display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          animation:'sc-pop .3s ease both',
        }}>
          {m.role === 'ai' && (
            <div style={{ width: 26, height: 26, borderRadius:'50%', background:'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)', marginRight: 8, flexShrink: 0, alignSelf:'flex-end' }} />
          )}
          <div style={{
            maxWidth:'78%', padding:'11px 15px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
            background: m.role === 'user' ? `linear-gradient(135deg, ${ORANGE} 0%, #e05500 100%)` : '#f8fafc',
            border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
            boxShadow: m.role === 'user' ? '0 4px 16px rgba(249,115,22,.3)' : '0 1px 4px rgba(0,0,0,0.06)',
            fontSize: 13, lineHeight: 1.55,
            color: m.role === 'user' ? '#fff' : '#1e293b',
            fontFamily: FONT,
          }}>
            {m.text}
          </div>
        </div>
      ))}

      {/* Typing dots */}
      {visible < messages.length && visible % 2 === 1 && (
        <div style={{ display:'flex', gap: 8, alignItems:'flex-end' }}>
          <div style={{ width: 26, height: 26, borderRadius:'50%', background:'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)', marginRight: 8, flexShrink:0 }} />
          <div style={{ padding:'13px 16px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'4px 18px 18px 18px', display:'flex', gap: 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius:'50%', background: ORANGE, animation:`sc-float 1.2s ease-in-out ${i*.18}s infinite` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 5: Upload Zone
// ─────────────────────────────────────────────────────────────
function UploadScene() {
  const [phase, setPhase] = useState<'idle'|'hover'|'ready'|'processing'|'done'>('idle')

  useEffect(() => {
    const seq: ['hover'|'ready'|'processing'|'done', number][] = [
      ['hover', 1200], ['ready', 2200], ['processing', 3600], ['done', 5800],
    ]
    const timers = seq.map(([s, t]) => setTimeout(() => setPhase(s), t))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 32 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing:'-0.03em', color:'#0f172a', fontFamily: FONT }}>Upload your drawings</div>
        <div style={{ fontSize: 15, color:'#64748b', marginTop: 6 }}>PDF only · up to 10 pages · max 50 MB</div>
      </div>

      {phase !== 'done' ? (
        <div style={{
          width: 480, borderRadius: 22, padding:'56px 32px 48px',
          textAlign:'center', cursor:'pointer',
          background: phase === 'hover' ? '#fff7ed' : '#fff',
          border: `2px dashed ${phase === 'hover' ? ORANGE : '#d1d5db'}`,
          boxShadow: phase === 'hover' ? `0 0 0 4px rgba(249,115,22,.1)` : '0 4px 24px rgba(0,0,0,0.06)',
          transition:'all .3s ease',
          animation:'sc-pop .5s ease both',
          position:'relative', overflow:'hidden',
        }}>
          {/* Ambient glow */}
          {phase === 'hover' && (
            <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width: 200, height: 200, background:'radial-gradient(circle, rgba(249,115,22,.12) 0%, transparent 70%)', pointerEvents:'none' }} />
          )}

          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius:'50%', margin:'0 auto 22px',
            background: phase === 'hover' ? 'rgba(249,115,22,.15)' : '#f3f4f6',
            border: `2px solid ${phase === 'hover' ? ORANGE : '#e5e7eb'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: phase === 'hover' ? '0 0 32px rgba(249,115,22,.3)' : 'none',
            transition:'all .3s ease',
            animation: phase === 'processing' ? 'sc-spin 1s linear infinite' : (phase === 'hover' ? 'sc-float 3s ease-in-out infinite' : 'none'),
          }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={phase === 'hover' ? ORANGE : '#9ca3af'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {phase === 'processing'
                ? <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>
                : <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>
              }
            </svg>
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: phase === 'hover' ? ORANGE : '#0f172a', transition:'color .3s', marginBottom: 6 }}>
            {phase === 'hover' ? 'Drop it!' : phase === 'processing' ? 'Uploading…' : 'Drop your PDF here'}
          </div>
          <div style={{ fontSize: 14, color:'#64748b', marginBottom: 24 }}>
            {phase === 'hover' ? 'Release to upload' : 'or click to browse'}
          </div>

          {/* Badges */}
          <div style={{ display:'flex', gap: 8, justifyContent:'center' }}>
            {[['📄','PDF only'],['📑','Up to 10 pages'],['💾','Max 50 MB']].map(([ic, lbl]) => (
              <div key={lbl} style={{ display:'flex', alignItems:'center', gap: 5, padding:'5px 12px', borderRadius: 100, background:'#f9fafb', border:'1px solid #e5e7eb', fontSize: 11, color:'#6b7280', fontWeight: 500 }}>
                <span>{ic}</span>{lbl}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          width: 480, background:'#f0fdf4', border:'1.5px solid rgba(74,222,128,.5)',
          borderRadius: 20, padding:'24px 28px', display:'flex', alignItems:'center', gap: 18,
          boxShadow:'0 0 32px rgba(74,222,128,.15)',
          animation:'sc-pop .4s ease both',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background:'rgba(74,222,128,.15)', border:'1px solid rgba(74,222,128,.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="oklch(0.65 0.17 145)" strokeWidth={2} strokeLinecap="round"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color:'oklch(0.65 0.17 145)', letterSpacing:'.07em', textTransform:'uppercase', marginBottom: 4 }}>PDF ready</div>
            <div style={{ fontSize: 15, fontWeight: 700, color:'#0f172a' }}>Riverside_Pavilion_Final.pdf</div>
            <div style={{ fontSize: 13, color:'#64748b' }}>8.4 MB · Ready to analyse</div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 6: Jury Card
// ─────────────────────────────────────────────────────────────
function JuryScene() {
  const questions = [
    "How does the industrial vocabulary serve the civic program rather than just reference it?",
    "Walk us through the section — what's the spatial experience from entry to gallery?",
    "Your material palette is minimal. How does it create warmth in such a large public space?",
  ]
  const [qIndex, setQIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (seconds > 0 && seconds % 7 === 0) {
      setFade(false)
      setTimeout(() => { setQIndex(i => (i + 1) % questions.length); setFade(true) }, 350)
    }
  }, [seconds])

  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 36 }}>
      {/* Mode badge */}
      <div style={{ display:'flex', alignItems:'center', gap: 8, background:`${ORANGE}15`, border:`1px solid ${ORANGE}33`, borderRadius: 100, padding:'8px 20px' }}>
        <div style={{ width: 8, height: 8, borderRadius:'50%', background: ORANGE, animation:'sc-pulse 1.5s ease infinite alternate' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: ORANGE, letterSpacing:'.05em' }}>JURY SIMULATION — LIVE</span>
      </div>

      {/* Question card */}
      <div style={{
        width: 620, background:'#fff', borderRadius: 24, padding:'44px 48px',
        boxShadow:'0 12px 60px rgba(0,0,0,0.1)', border:'1px solid #e2e8f0',
        textAlign:'center',
        opacity: fade ? 1 : 0, transition:'opacity .35s ease',
      }}>
        <div style={{ fontSize: 36, marginBottom: 20 }}>⚖️</div>
        <div style={{ fontSize: 11, fontWeight: 700, color:'#94a3b8', letterSpacing:'.1em', textTransform:'uppercase', marginBottom: 16 }}>Jury Question {qIndex + 1}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color:'#0f172a', lineHeight: 1.5, letterSpacing:'-0.01em', fontFamily: FONT }}>
          "{questions[qIndex]}"
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display:'flex', gap: 16, alignItems:'center' }}>
        {/* Timer */}
        <div style={{ background:'#fff', borderRadius: 14, padding:'12px 22px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', border:'1px solid #e2e8f0', display:'flex', gap: 8, alignItems:'center' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style={{ fontSize: 20, fontWeight: 800, color:'#0f172a', fontVariantNumeric:'tabular-nums', fontFamily: FONT }}>{mins}:{secs}</span>
        </div>

        {/* Mic button */}
        <div style={{
          width: 64, height: 64, borderRadius:'50%', background: ORANGE,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:`0 0 28px rgba(249,115,22,.45)`,
          cursor:'pointer',
          animation:'sc-pulse 2s ease infinite alternate',
        }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>

        {/* Next question */}
        <div style={{ background:'#fff', borderRadius: 14, padding:'12px 22px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', border:'1px solid #e2e8f0', cursor:'pointer', fontSize: 14, fontWeight: 600, color:'#64748b' }}
          onClick={() => { setFade(false); setTimeout(() => { setQIndex(i => (i+1) % questions.length); setFade(true) }, 350) }}>
          Next →
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCENE 7: Full App Window mockup
// ─────────────────────────────────────────────────────────────
function AppWindowScene() {
  return (
    <div style={{
      width: 860, background:'#fff', borderRadius: 16,
      boxShadow:'0 24px 80px rgba(0,0,0,0.14)', overflow:'hidden',
      border:'1px solid #e2e8f0', animation:'sc-pop .5s ease both',
    }}>
      {/* Browser chrome */}
      <div style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'12px 18px', display:'flex', alignItems:'center', gap: 12 }}>
        <div style={{ display:'flex', gap: 7 }}>
          {['#ff5f57','#ffbd2e','#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius:'50%', background: c }} />)}
        </div>
        <div style={{ flex:1, background:'#fff', borderRadius: 8, padding:'4px 14px', fontSize: 12, color:'#94a3b8', border:'1px solid #e2e8f0', textAlign:'center' }}>
          critup.ai
        </div>
      </div>

      {/* App layout */}
      <div style={{ display:'flex', height: 520 }}>
        {/* Sidebar */}
        <div style={{ width: 200, background:'oklch(0.155 0.006 270)', padding:'20px 14px', display:'flex', flexDirection:'column', gap: 4 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap: 8, padding:'8px 10px', marginBottom: 16 }}>
            <div style={{ width: 22, height: 22, borderRadius:'50%', background: ORANGE, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 900, color:'#fff' }}>C</div>
            <span style={{ fontSize: 14, fontWeight: 700, color:'#fff', letterSpacing:'-0.02em' }}>Critup<span style={{ color: ORANGE }}>.ai</span></span>
          </div>
          {[['🏠','Dashboard',false],['📁','Projects',true],['📊','Analysis',false],['⚖️','Jury',false]].map(([ic,lbl,active]) => (
            <div key={String(lbl)} style={{ display:'flex', alignItems:'center', gap: 10, padding:'9px 12px', borderRadius: 10, background: active ? 'rgba(249,115,22,.15)' : 'transparent', cursor:'pointer' }}>
              <span style={{ fontSize: 14 }}>{ic}</span>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? ORANGE : 'rgba(255,255,255,.6)' }}>{lbl}</span>
            </div>
          ))}
          {/* Free plan badge */}
          <div style={{ marginTop:'auto', background:'rgba(255,255,255,.06)', borderRadius: 12, padding:'12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing:'.08em', marginBottom: 6 }}>FREE PLAN</div>
            <div style={{ height: 3, background:'rgba(255,255,255,.1)', borderRadius: 99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:'0%', background: ORANGE, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: 10, color:'rgba(255,255,255,.4)', marginTop: 4 }}>0/1 analyses used</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, padding:'28px 28px', background:'#0f1117', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color:'#fff', letterSpacing:'-0.03em' }}>My Projects</div>
              <div style={{ fontSize: 13, color:'rgba(255,255,255,.4)', marginTop: 2 }}>3 projects · sorted by recent</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 10, padding:'8px 18px', borderRadius: 100, background: ORANGE, fontSize: 13, fontWeight: 600, color:'#fff', boxShadow:'0 0 16px rgba(249,115,22,.4)' }}>
              + New project
            </div>
          </div>

          {/* Project cards grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
            {[
              { name:'Riverside Cultural Pavilion', stage:'Finalized Design', stageColor:ORANGE, c:8.5, s:7.2, p:9.1 },
              { name:'Urban Metabolist Tower', stage:'Initial Concept', stageColor:'#6366f1', c:7.8, s:8.3, p:6.9 },
              { name:'Memorial Threshold', stage:'Jury Prep', stageColor:'oklch(0.65 0.18 25)', c:9.2, s:8.7, p:9.5 },
            ].map((proj, i) => (
              <div key={proj.name} style={{
                background:'oklch(0.19 0.006 270)', borderRadius: 14, padding:'16px 18px',
                border:'1px solid oklch(0.28 0.004 270)',
                animation:`sc-slide-up .4s ease ${i*.1}s both`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: proj.stageColor, background:`${proj.stageColor}22`, padding:'3px 8px', borderRadius: 100 }}>{proj.stage}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color:'#fff', marginBottom: 10, letterSpacing:'-0.01em' }}>{proj.name}</div>
                <div style={{ display:'flex', gap: 8 }}>
                  {[['C', proj.c, ORANGE], ['S', proj.s, 'oklch(0.65 0.18 25)'], ['P', proj.p, 'oklch(0.72 0.17 145)']].map(([label, score, color]) => (
                    <div key={String(label)} style={{ flex:1, background:'oklch(0.155 0.006 270)', borderRadius: 8, padding:'7px 6px', textAlign:'center', border:'1px solid oklch(0.28 0.004 270)' }}>
                      <div style={{ fontSize: 10, color:'rgba(255,255,255,.4)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: color as string }}>{String(score)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* New project card */}
            <div style={{ borderRadius: 14, padding:'16px 18px', border:'1.5px dashed oklch(0.28 0.004 270)', display:'flex', alignItems:'center', justifyContent:'center', gap: 10, cursor:'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius:'50%', background:'rgba(249,115,22,.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize: 18, color: ORANGE }}>+</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color:'rgba(255,255,255,.35)' }}>New project</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN SHOWCASE PAGE
// ─────────────────────────────────────────────────────────────
const SCENES = [
  { id:'mascot',   label:'🟠 Mascot',       component: MascotScene },
  { id:'scores',   label:'📊 Scores',        component: ScoresScene },
  { id:'analysis', label:'📄 Analysis',      component: AnalysisScene },
  { id:'chat',     label:'💬 Chat',          component: ChatScene },
  { id:'upload',   label:'📤 Upload',        component: UploadScene },
  { id:'jury',     label:'⚖️ Jury',          component: JuryScene },
  { id:'appwin',   label:'🖥 App Window',    component: AppWindowScene },
]

export function ShowcasePage() {
  const [active, setActive] = useState(0)
  const Scene = SCENES[active].component

  return (
    <div style={{ minHeight:'100vh', background:'#ffffff', fontFamily: FONT }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{
        position:'sticky', top:0, zIndex:100,
        background:'rgba(255,255,255,.9)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid #e2e8f0', padding:'0 24px',
        display:'flex', gap: 4, alignItems:'center', overflowX:'auto',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing:'.08em', textTransform:'uppercase', marginRight: 12, whiteSpace:'nowrap', padding:'16px 0' }}>
          VIDEO EXPORT
        </div>
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            style={{
              padding:'12px 16px', border:'none', background:'transparent',
              cursor:'pointer', fontSize: 13, fontWeight: i === active ? 700 : 500,
              color: i === active ? ORANGE : '#64748b',
              borderBottom: i === active ? `2px solid ${ORANGE}` : '2px solid transparent',
              transition:'all .15s', whiteSpace:'nowrap', fontFamily: FONT,
            }}
          >{s.label}</button>
        ))}
        <div style={{ marginLeft:'auto', fontSize: 11, color:'#94a3b8', whiteSpace:'nowrap', padding:'16px 0 16px 16px', borderLeft:'1px solid #e2e8f0' }}>
          🎬 Screen record each scene on white
        </div>
      </div>

      {/* Scene container */}
      <div style={{
        minHeight:'calc(100vh - 49px)', display:'flex', alignItems:'center', justifyContent:'center',
        padding:'64px 32px',
      }}>
        <Scene key={active} />
      </div>
    </div>
  )
}
