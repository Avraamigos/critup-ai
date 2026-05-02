import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Sun, Moon, Check, Plus, X } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
    }} />
  )
}

export function LandingPage() {
  const { theme, toggle, isDark } = useTheme()
  const c = useColors(theme)
  const [activeStage, setActiveStage] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const stages = [
    { name: 'Pre-Design', feedback: "Your brief analysis shows a strong civic program. Focus your concept around the tension between public/private threshold — this is what juries probe first at this stage. Three precedents worth studying: Sou Fujimoto's spatial gradients, Aires Mateus's spatial economy." },
    { name: 'Initial Concept', feedback: "Your parti diagram communicates the core idea but the form generation feels arbitrary. Ground your massing in topographic data or program adjacency logic. The jury will immediately ask 'why this shape?' — have three answers ready." },
    { name: 'Finalized Design', feedback: "Circulation on Level 2 creates a dead-end corridor near Grid B-3. The section reveals a 4.2m ceiling in the gallery that feels inconsistent with your stated 'compressed/released' spatial narrative. Address this before submission." },
    { name: 'Jury Prep', feedback: "Open with your concept in one sentence, then immediately show the site diagram. Practice this: 'My project proposes X as a response to Y constraint.' Juries in your faculty typically ask about structure after slide 4 — prepare a 30-second structural logic answer." },
  ]

  const features = [
    { icon: '🎙', title: 'PDF Voiceover', desc: 'AI narrates your boards page by page with targeted critique.' },
    { icon: '🎯', title: 'Region Highlights', desc: 'Pulsating markers on exact areas needing your attention.' },
    { icon: '💬', title: 'Jury Simulation', desc: 'Practice real jury questions tailored to your project.' },
    { icon: '✨', title: 'AI Assistant', desc: 'Chat with full context of your project and feedback.' },
    { icon: '🌍', title: 'Multi-language', desc: 'Full support in English, Russian, and Turkish.' },
    { icon: '📈', title: 'Score Tracking', desc: 'Concept, spatial, and presentation scores over time.' },
  ]

  const faqs = [
    { q: 'How does Critup understand my project?', a: 'You upload your project brief and your design boards as a PDF. Critup reads both together — the brief tells it your site, program, and constraints; the boards show your design decisions. This combination gives targeted, specific critique rather than generic feedback.' },
    { q: 'What file formats do you accept?', a: 'PDFs for both brief and boards. Combine all your sheets — plans, sections, elevations, renders, concept diagrams — into one PDF. Each page gets its own analysis and highlighted annotations.' },
    { q: 'How is this different from ChatGPT?', a: "ChatGPT gives general writing feedback. Critup is trained on architecture jury culture, design theory, and academic presentation standards. It understands spatial logic, circulation, and what juries in architecture schools actually probe." },
    { q: 'Does it work for interior design and urban planning?', a: 'Yes. Critup adapts based on your discipline. Interior architecture critique focuses on spatial sequence and material narrative; urban planning on connectivity, density, and program relationships.' },
    { q: 'Can I use it in Russian or Turkish?', a: 'Yes. Set your preferred language in onboarding or settings. All feedback, jury questions, and assistant conversations respond in your chosen language.' },
    { q: 'Is my work private?', a: 'Your files are encrypted and used only to generate your critique. We do not use your project files to train our models. Delete your projects at any time.' },
  ]

  const testimonials = [
    { quote: "I went into my final jury with confidence for the first time. The stage-specific feedback caught things my tutors hadn't mentioned.", name: 'Lara M.', meta: 'Architecture · TU Berlin' },
    { quote: "The jury simulation is scary accurate. Three practice questions came up word-for-word in my actual crit.", name: 'Kerem A.', meta: 'Interior Architecture · METU' },
    { quote: "It identified that my section was missing the ground datum. I never would have caught that myself.", name: 'Sofia R.', meta: 'Urban Design · Strelka' },
  ]

  const navBg = isDark ? 'oklch(0.19 0.004 270 / 0.9)' : 'rgba(255,255,255,0.9)'

  return (
    <div style={{ background: c.bg, color: c.textPrimary, fontFamily: "'Inter', sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 64, background: navBg, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.border}` }}>
        <CritupLogo size={22} showText theme={theme} />
        <div style={{ display: 'flex', gap: 36, fontSize: 14, color: c.textMuted, fontWeight: 500 }}>
          {['Features', 'How it Works', 'Pricing'].map(l => (
            <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = c.textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = c.textMuted)}
            >{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={toggle} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex' }}>
            {isDark ? <Sun size={15} color={c.textMuted} /> : <Moon size={15} color={c.textMuted} />}
          </button>
          <select style={{ background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
            <option>EN</option><option>RU</option><option>TR</option>
          </select>
          <Link to="/login" style={{ padding: '8px 18px', borderRadius: 100, background: 'transparent', border: `1.5px solid ${c.border}`, color: c.textPrimary, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
          <Link to="/signup" style={{ padding: '9px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 20px oklch(0.72 0.18 45 / 0.3)' }}>Get started free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <DotGrid theme={theme} />
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '55%', height: '60%', background: 'radial-gradient(ellipse 60% 50% at 70% 20%, oklch(0.72 0.18 45 / 0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 8px', borderRadius: 100, background: 'oklch(0.72 0.18 45 / 0.1)', border: '1px solid oklch(0.72 0.18 45 / 0.25)', fontSize: 13, color: '#F97316', fontWeight: 500, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
            AI-powered jury feedback for design students
          </div>
          <h1 style={{ fontSize: 'clamp(44px, 7vw, 76px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 22, color: c.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
            Get jury-ready<br />feedback in minutes
          </h1>
          <p style={{ fontSize: 18, color: c.textMuted, lineHeight: 1.65, maxWidth: 520, margin: '0 auto 36px' }}>
            AI-powered critique for architecture, interior design, and urban planning students. Upload your project. Hear what the jury will say.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ padding: '14px 34px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45 / 0.3)', textDecoration: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
              Start free analysis
            </Link>
            <a href="#how" style={{ padding: '14px 26px', borderRadius: 100, background: 'transparent', border: `1.5px solid ${c.border}`, color: c.textPrimary, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>See how it works ↓</a>
          </div>
        </div>

        {/* App mock */}
        <div style={{ maxWidth: 940, margin: '56px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#ffffff', border: `1px solid ${c.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: isDark ? '0 32px 80px oklch(0.72 0.18 45 / 0.12)' : '0 32px 80px rgba(0,0,0,0.12)', transform: 'perspective(1200px) rotateX(2deg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${c.border}`, background: isDark ? 'oklch(0.21 0.004 270)' : '#f9fafb' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map((col, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: col, opacity: 0.8 }} />)}
              </div>
              <div style={{ flex: 1, background: isDark ? 'oklch(0.19 0.004 270)' : '#e5e7eb', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 11, color: c.textMuted }}>Analysis — Riverside Cultural Pavilion</div>
            </div>
            <div style={{ display: 'flex', height: 320 }}>
              <div style={{ width: '55%', padding: 16, borderRight: `1px solid ${c.border}`, background: isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 10, background: `repeating-linear-gradient(45deg, ${isDark ? 'oklch(0.225 0.004 270)' : '#f0f0f0'} 0, ${isDark ? 'oklch(0.225 0.004 270)' : '#f0f0f0'} 10px, ${isDark ? 'oklch(0.21 0.004 270)' : '#e8e8e8'} 10px, ${isDark ? 'oklch(0.21 0.004 270)' : '#e8e8e8'} 20px)`, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: isDark ? 'oklch(0.4 0.004 270)' : '#9ca3af' }}>project boards</span>
                </div>
                {[{ x: '28%', y: '38%' }, { x: '62%', y: '24%' }, { x: '48%', y: '68%' }].map((pos, i) => (
                  <div key={i} style={{ position: 'absolute', left: pos.x, top: pos.y, width: 28, height: 28, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.35)', border: '2px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#F97316', boxShadow: '0 0 10px oklch(0.72 0.18 45 / 0.4)' }}>{i + 1}</div>
                ))}
              </div>
              <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: isDark ? 'oklch(0.225 0.004 270)' : '#fff' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ l: 'Concept', s: 7.4 }, { l: 'Spatial', s: 8.1 }, { l: 'Present.', s: 6.8 }].map(({ l, s }) => (
                    <div key={l} style={{ flex: 1, background: isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb', borderRadius: 9, padding: '8px 6px', textAlign: 'center', border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", fontVariantNumeric: 'tabular-nums', color: s >= 8 ? 'oklch(0.72 0.17 145)' : '#F97316' }}>{s}</div>
                      <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2, textTransform: 'uppercase' }}>{l}</div>
                    </div>
                  ))}
                </div>
                {[{ n: 1, t: 'Concept clarity', d: 'The parti diagram reads but threshold logic is underdeveloped.' }, { n: 2, t: 'Spatial hierarchy', d: 'Level 2 circulation resolves well. Ground floor datum needs clarification.' }, { n: 3, t: 'Presentation', d: 'Section line weights inconsistent — jury will notice.' }].map(({ n, t, d }) => (
                  <div key={n} style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb', borderRadius: 9, padding: '9px 11px', border: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{n}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: c.textPrimary, marginBottom: 2 }}>{t}</div>
                      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.4 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '32px 48px', borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'center', gap: 56, flexWrap: 'wrap', background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc' }}>
        {[{ n: '10k+', l: 'projects analyzed' }, { n: '94%', l: 'felt more confident' }, { n: '4.9★', l: 'student rating' }, { n: '200+', l: 'universities' }].map(({ n, l }) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F97316', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
            <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ maxWidth: 980, margin: '0 auto', padding: '88px 40px', position: 'relative' }}>
        <DotGrid theme={theme} />
        <div style={{ textAlign: 'center', marginBottom: 52, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Process</div>
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.035em', margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Three steps to jury-ready</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, position: 'relative', zIndex: 1 }}>
          {[
            { n: '01', emoji: '📤', title: 'Upload your brief', desc: 'Paste or upload the project brief from your university. Critup reads your site, program, constraints, and objectives.' },
            { n: '02', emoji: '📄', title: 'Upload your work', desc: 'Boards, plans, renders, diagrams — combine everything into one PDF. Each page gets its own analysis.' },
            { n: '03', emoji: '✨', title: 'Get targeted critique', desc: 'AI analyzes based on your exact design stage. Pre-design gets different feedback than jury prep.' },
          ].map(({ n, emoji, title, desc }) => (
            <div key={n} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius: 18, padding: '28px', border: `1px solid ${c.border}`, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.border = '1px solid oklch(0.72 0.18 45 / 0.3)'; e.currentTarget.style.boxShadow = '0 0 28px oklch(0.72 0.18 45 / 0.07)' }}
              onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${c.border}`; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'oklch(0.72 0.18 45 / 0.1)', border: '1px solid oklch(0.72 0.18 45 / 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emoji}</div>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#F97316', opacity: 0.15, fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>{n}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 8px', color: c.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{title}</h3>
              <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STAGE FEATURE */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`, padding: '80px 40px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Key feature</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 10px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Feedback that knows your stage</h2>
            <p style={{ fontSize: 15, color: c.textMuted, margin: 0 }}>Four modes — each calibrated to where you are in your project.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            {stages.map((s, i) => (
              <button key={i} onClick={() => setActiveStage(i)} style={{ padding: '8px 20px', borderRadius: 100, border: 'none', cursor: 'pointer', background: activeStage === i ? '#F97316' : (isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), color: activeStage === i ? '#fff' : c.textMuted, fontSize: 13, fontWeight: 500, transition: 'all 0.2s', boxShadow: activeStage === i ? '0 0 14px oklch(0.72 0.18 45 / 0.35)' : 'none' }}>{s.name}</button>
            ))}
          </div>
          <div style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius: 16, border: '1px solid oklch(0.72 0.18 45 / 0.2)', padding: '22px 26px', boxShadow: '0 0 30px oklch(0.72 0.18 45 / 0.05)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{stages[activeStage].name} · AI Feedback</div>
            <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.7, margin: 0 }}>{stages[activeStage].feedback}</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '88px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 10px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Everything you need</h2>
          <p style={{ fontSize: 15, color: c.textMuted, margin: 0 }}>Built for architecture school. Used by students at 200+ universities.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {features.map(({ icon, title, desc }) => (
            <div key={title} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius: 16, padding: '22px', border: `1px solid ${c.border}`, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.border = '1px solid oklch(0.72 0.18 45 / 0.3)'; e.currentTarget.style.boxShadow = '0 0 20px oklch(0.72 0.18 45 / 0.07)' }}
              onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${c.border}`; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 18 }}>{icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em', color: c.textPrimary }}>{title}</h3>
              <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.55, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`, padding: '80px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 10px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Simple pricing</h2>
            <p style={{ fontSize: 15, color: c.textMuted, margin: 0 }}>Start free. Upgrade when you need more.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { name: 'Free', price: '$0', sub: '', features: ['1 project analysis', 'Concept + Spatial + Presentation scores', 'PDF upload', 'Basic AI critique'], cta: 'Start free', featured: false },
              { name: 'Monthly', price: '$9', sub: '/mo', features: ['Unlimited analyses', 'Voiceover narration', 'Jury Q&A practice', 'Progress history', 'AI project assistant'], cta: 'Start monthly', featured: true, badge: 'Most popular' },
              { name: 'Yearly', price: '$59', sub: '/yr', crossed: '$108', save: 'Save 45%', features: ['Everything in Monthly', 'Video presentation coach', 'Priority processing', 'Early access'], cta: 'Start yearly', featured: false, badge: 'Best value' },
            ].map(({ name, price, sub, crossed, save, features: feats, cta, featured, badge }) => (
              <div key={name} style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius: 20, padding: '30px 26px', border: featured ? '1.5px solid #F97316' : `1px solid ${c.border}`, boxShadow: featured ? '0 0 40px oklch(0.72 0.18 45 / 0.12)' : 'none', position: 'relative', transform: featured ? 'scale(1.02)' : 'scale(1)' }}>
                {badge && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: featured ? '#F97316' : (isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), padding: '4px 14px', borderRadius: 100, fontSize: 11, fontWeight: 700, color: featured ? '#fff' : c.textMuted, whiteSpace: 'nowrap' }}>{badge}</div>}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F97316', marginBottom: 8, letterSpacing: '0.04em' }}>{name.toUpperCase()}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", letterSpacing: '-0.04em', lineHeight: 1, color: c.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{price}</span>
                    <span style={{ fontSize: 14, color: c.textMuted }}>{sub}</span>
                  </div>
                  {crossed && <div style={{ fontSize: 12, color: c.textMuted }}><span style={{ textDecoration: 'line-through' }}>{crossed}</span><span style={{ color: 'oklch(0.72 0.17 145)', marginLeft: 6 }}>{save}</span></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {feats.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Check size={14} color="oklch(0.72 0.17 145)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/signup" style={{ display: 'block', width: '100%', padding: '11px 0', borderRadius: 100, cursor: 'pointer', background: featured ? '#F97316' : 'transparent', border: featured ? 'none' : `1.5px solid ${c.border}`, color: featured ? '#fff' : c.textPrimary, fontSize: 14, fontWeight: 600, transition: 'all 0.15s', boxShadow: featured ? '0 0 18px oklch(0.72 0.18 45 / 0.35)' : 'none', textDecoration: 'none', textAlign: 'center' }}>{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '88px 40px' }}>
        <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 48, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>What students say</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {testimonials.map(({ quote, name, meta }) => (
            <div key={name} style={{ background: isDark ? 'oklch(0.225 0.004 270)' : '#fff', borderRadius: 18, padding: '26px', border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 28, color: '#F97316', lineHeight: 1, marginBottom: 14, fontFamily: 'Georgia, serif' }}>"</div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: c.textMuted, margin: '0 0 18px' }}>{quote}</p>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{name}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{meta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: isDark ? 'oklch(0.21 0.004 270)' : '#f8fafc', borderTop: `1px solid ${c.border}`, padding: '72px 40px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 40, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {faqs.map(({ q, a }, i) => (
              <div key={i} style={{ background: isDark ? 'oklch(0.19 0.004 270)' : '#fff', borderRadius: 12, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', color: c.textPrimary, fontSize: 14, fontWeight: 500, textAlign: 'left', gap: 12 }}>
                  <span>{q}</span>
                  {faqOpen === i ? <X size={14} color="#F97316" /> : <Plus size={14} color="#F97316" />}
                </button>
                {faqOpen === i && <div style={{ padding: '0 18px 14px', fontSize: 13, color: c.textMuted, lineHeight: 1.65 }}>{a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '88px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <DotGrid theme={theme} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 80% at 50% 50%, oklch(0.72 0.18 45 / 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif", color: c.textPrimary }}>Ready to get jury-ready?</h2>
          <p style={{ fontSize: 15, color: c.textMuted, marginBottom: 32 }}>One free analysis. No card required.</p>
          <Link to="/signup" style={{ padding: '14px 38px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45 / 0.3)', textDecoration: 'none' }}>Start free →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${c.border}`, padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <CritupLogo size={18} showText theme={theme} />
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: c.textMuted }}>
          {['Privacy', 'Terms', 'Contact'].map(l => <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{l}</a>)}
        </div>
        <div style={{ fontSize: 12, color: isDark ? 'oklch(0.45 0.004 270)' : '#9ca3af' }}>© 2026 Critup.ai</div>
      </footer>
    </div>
  )
}
