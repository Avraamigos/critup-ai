import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Sun, Moon, Check, Plus, X, ArrowRight, Upload, Zap, MessageSquare, Menu } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { AIOrb } from '@/components/AIOrb'
import { useTheme, useColors } from '@/lib/theme'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const FONT_DISPLAY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function LandingPage() {
  const { theme, toggle, isDark } = useTheme()
  const c = useColors(theme)
  const [activeStage, setActiveStage] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const stages = [
    { name: 'Pre-Design', feedback: "Your brief shows a strong civic program. Focus your concept around the tension between public/private threshold — this is what juries probe first at this stage. Precedents worth studying: Sou Fujimoto's spatial gradients, Aires Mateus's spatial economy." },
    { name: 'Initial Concept', feedback: "Your parti communicates the core idea but form generation feels arbitrary. Ground your massing in topographic data or program adjacency logic. The jury will immediately ask 'why this shape?' — have three answers ready." },
    { name: 'Finalized Design', feedback: "Circulation on Level 2 creates a dead-end near Grid B-3. The section reveals a 4.2m gallery ceiling that contradicts your stated 'compressed/released' spatial narrative. Address this before submission." },
    { name: 'Jury Prep', feedback: "Open with your concept in one sentence, then show the site diagram. Practice: 'My project proposes X as a response to Y constraint.' Your faculty typically asks about structure after slide 4 — prepare a 30-second structural logic answer." },
  ]

  const faqs = [
    { q: 'How does Crit understand my project?', a: 'You upload your design boards as a PDF — plans, sections, renders, diagrams, all in one file. Crit reads every page and gives you targeted, specific critique rather than generic feedback.' },
    { q: 'What file formats do you accept?', a: 'PDFs. Combine all your sheets into one PDF — each page gets its own analysis and highlighted annotations.' },
    { q: 'How is this different from ChatGPT?', a: "ChatGPT gives generic writing feedback. Crit is calibrated on architecture jury culture, design theory, and academic presentation standards. It understands spatial logic, circulation, and what juries actually probe." },
    { q: 'Does it work for interior design and urban planning?', a: 'Yes. Crit adapts to your discipline. Interior architecture critique focuses on spatial sequence and material narrative; urban planning on connectivity, density, and program relationships.' },
    { q: 'Can I use it in Russian or Turkish?', a: 'Yes. Set your preferred language in settings. All feedback, jury questions, and assistant conversations respond in your chosen language.' },
    { q: 'Is my work private?', a: 'Your files are encrypted and only used to generate your critique. We do not use your project files to train AI models. Delete your projects at any time.' },
  ]

  const testimonials = [
    { quote: "I went into my final jury with confidence for the first time. Crit caught things my tutors hadn't mentioned.", name: 'Lara M.', meta: 'Architecture · TU Berlin' },
    { quote: "The jury simulation is scary accurate. Three practice questions came up word-for-word in my actual crit.", name: 'Kerem A.', meta: 'Interior Architecture · METU' },
    { quote: "It caught that my section was missing the ground datum. I never would have noticed myself.", name: 'Sofia R.', meta: 'Urban Design · Strelka' },
  ]

  return (
    <div style={{ background: c.bg, color: c.textPrimary, fontFamily: "'Inter', sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: isDark ? 'oklch(0.16 0.004 270 / 0.92)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 20px' : '0 48px', height: 62 }}>
          <CritupLogo size={22} showText theme={theme} />

          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 32, fontSize: 14, color: c.textMuted, fontWeight: 500 }}>
              {[['Features', 'features'], ['How it works', 'how'], ['Pricing', 'pricing']].map(([label, id]) => (
                <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.color = c.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
                >{label}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={toggle} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex' }}>
              {isDark ? <Sun size={14} color={c.textMuted} /> : <Moon size={14} color={c.textMuted} />}
            </button>
            {isMobile ? (
              <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex' }}>
                <Menu size={16} color={c.textMuted} />
              </button>
            ) : (
              <>
                <Link to="/login" style={{ padding: '7px 18px', borderRadius: 100, background: 'transparent', border: `1.5px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
                <Link to="/signup" style={{ padding: '8px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 18px oklch(0.72 0.18 45 / 0.3)' }}>Get started free</Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobile && mobileMenuOpen && (
          <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 8, background: isDark ? 'oklch(0.16 0.004 270)' : '#fff' }}>
            {[['Features', 'features'], ['How it works', 'how'], ['Pricing', 'pricing']].map(([label, id]) => (
              <button key={id} onClick={() => { scrollTo(id); setMobileMenuOpen(false) }} style={{ background: 'none', border: 'none', color: c.textMuted, fontSize: 15, fontWeight: 500, cursor: 'pointer', padding: '6px 0', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>{label}</button>
            ))}
            <div style={{ height: 1, background: c.border, margin: '4px 0' }} />
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: c.textPrimary, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
            <Link to="/signup" onClick={() => setMobileMenuOpen(false)} style={{ padding: '11px 0', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>Get started free</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{ paddingTop: isMobile ? 100 : 130, paddingBottom: isMobile ? 48 : 70, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <DotGrid theme={theme} />
        <div style={{ position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '70%', background: 'radial-gradient(ellipse 60% 50% at 50% 10%, oklch(0.72 0.18 45 / 0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 10px', borderRadius: 100, background: 'oklch(0.72 0.18 45 / 0.1)', border: '1px solid oklch(0.72 0.18 45 / 0.22)', fontSize: 13, color: '#F97316', fontWeight: 500, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', display: 'inline-block', animation: 'hero-pulse 2s ease-in-out infinite' }} />
            AI jury feedback for design students
          </div>

          <h1 style={{ fontSize: isMobile ? '38px' : 'clamp(42px, 6.5vw, 74px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 18, color: c.textPrimary, fontFamily: FONT_DISPLAY }}>
            Stop guessing what<br />your jury will say
          </h1>
          <p style={{ fontSize: isMobile ? 16 : 18, color: c.textMuted, lineHeight: 1.65, maxWidth: 500, margin: '0 auto 32px' }}>
            Upload your project boards. Get honest, specific critique — the same feedback a 20-year jury veteran would give — before you step into the room.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            <Link to="/signup" style={{ padding: isMobile ? '13px 28px' : '14px 34px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: isMobile ? 15 : 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 24px oklch(0.72 0.18 45 / 0.35)', textDecoration: 'none', fontFamily: FONT_DISPLAY, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Analyse my project free <ArrowRight size={16} />
            </Link>
            {!isMobile && (
              <button onClick={() => scrollTo('how')} style={{ padding: '14px 26px', borderRadius: 100, background: 'transparent', border: `1.5px solid ${c.border}`, color: c.textPrimary, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>See how it works ↓</button>
            )}
          </div>

          <div style={{ display: 'flex', gap: isMobile ? 14 : 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['No credit card required', 'Architecture, Interior, Urban', 'English · Russian · Turkish'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: c.textMuted }}>
                <Check size={12} color="#F97316" strokeWidth={2.5} />{t}
              </div>
            ))}
          </div>
        </div>

        {/* App mock — desktop only */}
        {!isMobile && (
          <div style={{ maxWidth: 960, margin: '60px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
            <div style={{ background: isDark ? 'oklch(0.20 0.004 270)' : '#fff', border: `1px solid ${c.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: isDark ? '0 0 0 1px oklch(0.30 0.004 270), 0 40px 100px oklch(0.72 0.18 45 / 0.10)' : '0 40px 100px rgba(0,0,0,0.10)', transform: 'perspective(1400px) rotateX(2.5deg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: `1px solid ${c.border}`, background: isDark ? 'oklch(0.22 0.004 270)' : '#f9fafb' }}>
                <div style={{ display: 'flex', gap: 5 }}>{['#ef4444','#f59e0b','#22c55e'].map((col,i) => <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:col, opacity:0.8 }} />)}</div>
                <div style={{ flex:1, background: isDark ? 'oklch(0.18 0.004 270)' : '#e5e7eb', borderRadius:6, height:22, display:'flex', alignItems:'center', paddingLeft:10, fontSize:11, color:c.textMuted }}>critup.ai/analysis/river-pavilion</div>
              </div>
              <div style={{ display:'flex', height:340 }}>
                <div style={{ width:'54%', background: isDark ? 'oklch(0.18 0.004 270)' : '#f4f5f7', borderRight:`1px solid ${c.border}`, position:'relative', padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                    {[1,2,3].map(p => (
                      <div key={p} style={{ flex:1, height:36, borderRadius:6, background: p===1 ? '#F97316' : (isDark ? 'oklch(0.26 0.004 270)' : '#e5e7eb'), border: p===1 ? '1.5px solid #F97316' : `1px solid ${c.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: p===1 ? '#fff' : c.textMuted }}>PG {p}</div>
                    ))}
                  </div>
                  <div style={{ flex:1, borderRadius:10, background: isDark ? 'oklch(0.22 0.004 270)' : '#eaeaea', border:`1px solid ${c.border}`, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="100%" height="100%" style={{ position:'absolute', inset:0, opacity:0.35 }}>
                      <line x1="20%" y1="10%" x2="80%" y2="10%" stroke={isDark?'#555':'#aaa'} strokeWidth="1"/>
                      <rect x="15%" y="20%" width="30%" height="50%" fill="none" stroke={isDark?'#666':'#bbb'} strokeWidth="1.5"/>
                      <rect x="55%" y="25%" width="28%" height="40%" fill="none" stroke={isDark?'#666':'#bbb'} strokeWidth="1"/>
                      <line x1="15%" y1="75%" x2="85%" y2="75%" stroke={isDark?'#444':'#ccc'} strokeWidth="0.8" strokeDasharray="4,3"/>
                      <line x1="50%" y1="20%" x2="50%" y2="70%" stroke={isDark?'#555':'#bbb'} strokeWidth="0.8" strokeDasharray="3,3"/>
                    </svg>
                    <span style={{ fontSize:10, color:c.textMuted, opacity:0.5, zIndex:1 }}>Ground Floor Plan</span>
                    {[{x:'28%',y:'38%'},{x:'65%',y:'30%'},{x:'46%',y:'68%'}].map((pos,i) => (
                      <div key={i} style={{ position:'absolute', left:pos.x, top:pos.y, width:26, height:26, borderRadius:'50%', background:'oklch(0.72 0.18 45 / 0.25)', border:'2px solid #F97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#F97316', boxShadow:'0 0 10px oklch(0.72 0.18 45 / 0.5)' }}>{i+1}</div>
                    ))}
                  </div>
                </div>
                <div style={{ flex:1, padding:16, display:'flex', flexDirection:'column', gap:10, background: isDark ? 'oklch(0.20 0.004 270)' : '#fff', overflowY:'auto' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{l:'Concept',s:7.4,col:'#F97316'},{l:'Spatial',s:8.1,col:'oklch(0.72 0.17 145)'},{l:'Present.',s:6.8,col:'#F97316'}].map(({l,s,col}) => (
                      <div key={l} style={{ flex:1, background: isDark ? 'oklch(0.16 0.004 270)' : '#f9fafb', borderRadius:9, padding:'8px 4px', textAlign:'center', border:`1px solid ${c.border}` }}>
                        <div style={{ fontSize:19, fontWeight:800, fontFamily:FONT_DISPLAY, color:col, letterSpacing:'-0.02em' }}>{s}</div>
                        <div style={{ fontSize:9, color:c.textMuted, marginTop:1, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {[
                    {n:1, t:'Threshold logic', d:'Entry sequence is underspecified. A 1:200 section would clarify the public→private transition.'},
                    {n:2, t:'Circulation dead-end', d:'NE corner (Grid B-3) creates a spatial dead end. Connect to service core or add secondary exit.'},
                    {n:3, t:'Section datum missing', d:'Ground level datum ±0.00m is absent. Jury will probe this immediately — add before submission.'},
                  ].map(({n,t,d}) => (
                    <div key={n} style={{ background: isDark ? 'oklch(0.17 0.004 270)' : '#f9fafb', borderRadius:9, padding:'9px 11px', border:`1px solid ${c.border}`, display:'flex', gap:8, flexShrink:0 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'#F97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{n}</div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:c.textPrimary, marginBottom:2 }}>{t}</div>
                        <div style={{ fontSize:10, color:c.textMuted, lineHeight:1.45 }}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── MEET CRIT ── */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#fafafa', borderTop:`1px solid ${c.border}`, borderBottom:`1px solid ${c.border}`, padding: isMobile ? '48px 24px' : '64px 40px' }}>
        <div style={{ maxWidth:720, margin:'0 auto', display:'flex', alignItems:'center', gap: isMobile ? 28 : 48, flexWrap:'wrap', justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, flexShrink:0 }}>
            <AIOrb size={isMobile ? 60 : 80} float />
            <div style={{ fontSize:13, fontWeight:700, color:c.textPrimary, letterSpacing:'-0.01em' }}>Meet Crit</div>
            <div style={{ fontSize:11, color:'#F97316', fontWeight:500 }}>Your AI design critic</div>
          </div>
          <div style={{ flex:1, minWidth: isMobile ? '100%' : 280 }}>
            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight:800, letterSpacing:'-0.03em', margin:'0 0 12px', fontFamily:FONT_DISPLAY, color:c.textPrimary }}>
              A critic that actually knows your work
            </h2>
            <p style={{ fontSize:15, color:c.textMuted, lineHeight:1.7, margin:'0 0 16px' }}>
              Crit reads your drawings page by page, spots weak points, predicts jury questions, and coaches you on how to answer them.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {['Narrates your boards with voice critique','Pins annotations on exact areas','Simulates real jury Q&A for your project'].map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:c.textMuted }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'oklch(0.72 0.18 45 / 0.12)', border:'1px solid oklch(0.72 0.18 45 / 0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Check size={10} color="#F97316" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ maxWidth:960, margin:'0 auto', padding: isMobile ? '64px 20px' : '88px 40px', position:'relative' }}>
        <DotGrid theme={theme} />
        <div style={{ textAlign:'center', marginBottom:44, position:'relative', zIndex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Process</div>
          <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight:800, letterSpacing:'-0.035em', margin:0, fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Three steps to jury-ready</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap:16, position:'relative', zIndex:1 }}>
          {[
            { icon: Upload, n:'01', title:'Upload your boards', desc:'Combine your plans, sections, renders, and diagrams into one PDF. Every page gets its own analysis.' },
            { icon: Zap,    n:'02', title:'Crit reads everything', desc:'Scores your concept, spatial logic, and presentation. Pins annotations on the exact areas that need work.' },
            { icon: MessageSquare, n:'03', title:'Practice and refine', desc:'Get predicted jury questions tailored to your drawings. Chat with Crit to work through any weakness.' },
          ].map(({ icon: Icon, n, title, desc }) => (
            <div key={n} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius:18, padding:'24px', border:`1px solid ${c.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'oklch(0.72 0.18 45 / 0.1)', border:'1px solid oklch(0.72 0.18 45 / 0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={18} color="#F97316" />
                </div>
                <span style={{ fontSize:26, fontWeight:800, color:'#F97316', opacity:0.13, fontFamily:'monospace', letterSpacing:'-0.03em', lineHeight:1 }}>{n}</span>
              </div>
              <h3 style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.015em', margin:'0 0 8px', color:c.textPrimary, fontFamily:FONT_DISPLAY }}>{title}</h3>
              <p style={{ fontSize:13, color:c.textMuted, lineHeight:1.6, margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── STAGE FEATURE ── */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop:`1px solid ${c.border}`, borderBottom:`1px solid ${c.border}`, padding: isMobile ? '56px 20px' : '80px 40px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Adaptive feedback</div>
            <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight:800, letterSpacing:'-0.03em', margin:'0 0 10px', fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Feedback that knows your stage</h2>
            <p style={{ fontSize:14, color:c.textMuted, margin:0 }}>Pre-design gets different critique than jury prep.</p>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            {stages.map((s, i) => (
              <button key={i} onClick={() => setActiveStage(i)} style={{ padding:'7px 16px', borderRadius:100, border:'none', cursor:'pointer', background: activeStage===i ? '#F97316' : (isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), color: activeStage===i ? '#fff' : c.textMuted, fontSize:13, fontWeight:500, transition:'all 0.2s', boxShadow: activeStage===i ? '0 0 14px oklch(0.72 0.18 45 / 0.35)' : 'none', fontFamily:"'Inter', sans-serif" }}>{s.name}</button>
            ))}
          </div>
          <div style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius:16, border:'1px solid oklch(0.72 0.18 45 / 0.2)', padding:'20px 22px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#F97316' }} />
              <span style={{ fontSize:10, fontWeight:700, color:'#F97316', letterSpacing:'0.1em', textTransform:'uppercase' }}>{stages[activeStage].name} · Crit's feedback</span>
            </div>
            <p style={{ fontSize:14, color:c.textMuted, lineHeight:1.75, margin:0 }}>{stages[activeStage].feedback}</p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ maxWidth:960, margin:'0 auto', padding: isMobile ? '64px 20px' : '88px 40px' }}>
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>What you get</div>
          <h2 style={{ fontSize: isMobile ? 26 : 38, fontWeight:800, letterSpacing:'-0.03em', margin:'0 0 10px', fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Everything built for design school</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap:14 }}>
          {[
            { icon:'🎙', title:'PDF Voiceover',      desc:'Crit narrates your boards page by page with spoken, targeted critique.' },
            { icon:'📌', title:'Pinned Annotations', desc:'Pulsating markers on exact areas needing attention — not just text.' },
            { icon:'💬', title:'Jury Simulation',    desc:'Practice real jury questions generated from your actual drawings.' },
            { icon:'✨', title:'Ask Crit',           desc:'Chat with Crit about anything — scores, design decisions, how to improve.' },
            { icon:'🌍', title:'Multi-language',     desc:'Full critique in English, Russian, and Turkish.' },
            { icon:'📈', title:'Score Tracking',     desc:'Concept, spatial, and presentation scores tracked across projects.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius:16, padding: isMobile ? '18px 16px' : '22px', border:`1px solid ${c.border}` }}>
              <div style={{ width:36, height:36, borderRadius:9, background:'oklch(0.72 0.18 45 / 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, fontSize:18 }}>{icon}</div>
              <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 5px', letterSpacing:'-0.01em', color:c.textPrimary }}>{title}</h3>
              <p style={{ fontSize:12, color:c.textMuted, lineHeight:1.55, margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop:`1px solid ${c.border}`, borderBottom:`1px solid ${c.border}`, padding: isMobile ? '56px 20px' : '80px 40px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Pricing</div>
            <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight:800, letterSpacing:'-0.03em', margin:'0 0 10px', fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Start free. Upgrade anytime.</h2>
            <p style={{ fontSize:15, color:c.textMuted, margin:0 }}>No card required to start. Cancel anytime.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap:16 }}>
            {[
              {
                name:'Free', price:'$0', sub:'', featured:false,
                features:['1 project analysis','Concept, Spatial & Presentation scores','Pinned annotations on your drawings','10 messages with Crit'],
                cta:'Start analysing free',
              },
              {
                name:'Monthly', price:'$8', sub:'/mo', featured:true, badge:'Most popular',
                features:['Unlimited project analyses','PDF voiceover narration','Jury Q&A practice sessions','Unlimited Crit chat','Full project history'],
                cta:'Start monthly',
              },
              {
                name:'Yearly', price:'$49', sub:'/yr', crossed:'$96', save:'Save 49%', featured:false, badge:'Best value',
                features:['Everything in Monthly','Priority AI processing','Earliest access to new features','Direct support'],
                cta:'Start yearly',
              },
            ].map(({ name, price, sub, crossed, save, features: feats, cta, featured, badge }) => (
              <div key={name} style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius:20, padding:'28px 24px', border: featured ? '1.5px solid #F97316' : `1px solid ${c.border}`, boxShadow: featured ? '0 0 40px oklch(0.72 0.18 45 / 0.12)' : 'none', position:'relative', marginTop: (!isMobile && featured) ? -8 : 0 }}>
                {badge && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background: featured ? '#F97316' : (isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), padding:'4px 14px', borderRadius:100, fontSize:11, fontWeight:700, color: featured ? '#fff' : c.textMuted, whiteSpace:'nowrap' }}>{badge}</div>}
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#F97316', marginBottom:8, letterSpacing:'0.06em' }}>{name.toUpperCase()}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:2, marginBottom:4 }}>
                    <span style={{ fontSize:42, fontWeight:800, fontFamily:FONT_DISPLAY, letterSpacing:'-0.04em', lineHeight:1, color:c.textPrimary }}>{price}</span>
                    <span style={{ fontSize:14, color:c.textMuted }}>{sub}</span>
                  </div>
                  {crossed && <div style={{ fontSize:12, color:c.textMuted }}><span style={{ textDecoration:'line-through' }}>{crossed}</span><span style={{ color:'oklch(0.72 0.17 145)', marginLeft:6, fontWeight:600 }}>{save}</span></div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:22 }}>
                  {feats.map(f => (
                    <div key={f} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <Check size={13} color="oklch(0.72 0.17 145)" strokeWidth={2.5} style={{ flexShrink:0, marginTop:1 }} />
                      <span style={{ fontSize:13, color:c.textMuted, lineHeight:1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/signup" style={{ display:'block', width:'100%', padding:'11px 0', borderRadius:100, cursor:'pointer', background: featured ? '#F97316' : 'transparent', border: featured ? 'none' : `1.5px solid ${c.border}`, color: featured ? '#fff' : c.textPrimary, fontSize:14, fontWeight:600, transition:'all 0.15s', boxShadow: featured ? '0 0 18px oklch(0.72 0.18 45 / 0.35)' : 'none', textDecoration:'none', textAlign:'center', fontFamily:"'Inter', sans-serif" }}>{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ maxWidth:960, margin:'0 auto', padding: isMobile ? '64px 20px' : '88px 40px' }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>Early users</div>
          <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight:800, letterSpacing:'-0.03em', margin:0, fontFamily:FONT_DISPLAY, color:c.textPrimary }}>What students say</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap:16 }}>
          {testimonials.map(({ quote, name, meta }) => (
            <div key={name} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius:18, padding:'24px', border:`1px solid ${c.border}` }}>
              <div style={{ fontSize:32, color:'#F97316', lineHeight:1, marginBottom:10, fontFamily:'Georgia, serif', opacity:0.7 }}>"</div>
              <p style={{ fontSize:14, lineHeight:1.7, color:c.textMuted, margin:'0 0 16px' }}>{quote}</p>
              <div style={{ fontSize:13, fontWeight:600, color:c.textPrimary }}>{name}</div>
              <div style={{ fontSize:12, color:c.textMuted, marginTop:2 }}>{meta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop:`1px solid ${c.border}`, padding: isMobile ? '56px 20px' : '72px 40px' }}>
        <div style={{ maxWidth:660, margin:'0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 26 : 34, fontWeight:800, letterSpacing:'-0.03em', textAlign:'center', marginBottom:36, fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Common questions</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {faqs.map(({ q, a }, i) => (
              <div key={i} style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius:12, border:`1px solid ${c.border}`, overflow:'hidden' }}>
                <button onClick={() => setFaqOpen(faqOpen===i ? null : i)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 18px', background:'none', border:'none', cursor:'pointer', color:c.textPrimary, fontSize:14, fontWeight:500, textAlign:'left', gap:12, fontFamily:"'Inter', sans-serif" }}>
                  <span>{q}</span>
                  {faqOpen===i ? <X size={14} color="#F97316" /> : <Plus size={14} color="#F97316" />}
                </button>
                {faqOpen===i && <div style={{ padding:'0 18px 15px', fontSize:13, color:c.textMuted, lineHeight:1.65 }}>{a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: isMobile ? '72px 20px' : '96px 40px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <DotGrid theme={theme} />
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 70% at 50% 50%, oklch(0.72 0.18 45 / 0.06) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
            <AIOrb size={isMobile ? 52 : 64} float />
          </div>
          <h2 style={{ fontSize: isMobile ? 30 : 'clamp(36px,5vw,54px)', fontWeight:800, letterSpacing:'-0.035em', marginBottom:10, fontFamily:FONT_DISPLAY, color:c.textPrimary }}>Ready to walk in confident?</h2>
          <p style={{ fontSize:15, color:c.textMuted, marginBottom:30 }}>First analysis is free. No card required.</p>
          <Link to="/signup" style={{ padding: isMobile ? '13px 32px' : '15px 40px', borderRadius:100, background:'#F97316', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', boxShadow:'0 0 28px oklch(0.72 0.18 45 / 0.35)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
            Analyse my project free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:`1px solid ${c.border}`, padding: isMobile ? '24px 20px' : '28px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
        <CritupLogo size={18} showText theme={theme} />
        <div style={{ display:'flex', gap:20, fontSize:13, color:c.textMuted }}>
          <Link to="/privacy" style={{ color:c.textMuted, textDecoration:'none' }}>Privacy</Link>
          <Link to="/terms"   style={{ color:c.textMuted, textDecoration:'none' }}>Terms</Link>
          <a href="mailto:hello@critup.ai" style={{ color:c.textMuted, textDecoration:'none' }}>Contact</a>
        </div>
        <div style={{ fontSize:11, color: isDark ? 'oklch(0.4 0.004 270)' : '#9ca3af' }}>© 2026 Critup.ai · Avraam Valikhan & Adil Kamal Batcha</div>
      </footer>

      <style>{`@keyframes hero-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
    </div>
  )
}
