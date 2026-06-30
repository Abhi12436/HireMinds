import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Target, ShieldCheck, BarChart3, Sparkles, ArrowRight, Sun, Moon, Monitor, Eye, EyeOff } from 'lucide-react'
import { auth } from '../lib/auth'

const FEATURES = [
  { icon: Target, title: 'AI Matching', desc: 'TF-IDF ranking across 2,000+ real profiles' },
  { icon: ShieldCheck, title: 'Fraud Detection', desc: 'Cosine-similarity plagiarism scanning' },
  { icon: BarChart3, title: 'Talent Analytics', desc: 'Live insights from recruiter signals' },
  { icon: Sparkles, title: 'Salary Intel', desc: 'Market benchmarks by experience & skills' },
]

function ThemeToggle({ pref, setPref }) {
  const opts = [['light', Sun], ['dark', Moon], ['system', Monitor]]
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-sunken)', borderRadius: 99, border: '1px solid var(--border)' }}>
      {opts.map(([val, Icon]) => (
        <button key={val} onClick={() => setPref(val)} aria-label={val}
          style={{
            display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 99,
            background: pref === val ? 'var(--brand)' : 'transparent',
            color: pref === val ? '#fff' : 'var(--text-soft)', transition: 'all 0.2s',
          }}>
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

export default function Landing({ onAuth, themePref, setThemePref }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [role, setRole] = useState('hr')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const heroRef = useRef(null)
  const [glow, setGlow] = useState({ x: 0.5, y: 0.3 })

  // Cursor-following glow
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const move = (e) => {
      const r = el.getBoundingClientRect()
      setGlow({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
    }
    el.addEventListener('mousemove', move)
    return () => el.removeEventListener('mousemove', move)
  }, [])

  const submit = () => {
    setError('')
    try {
      const session = mode === 'signup'
        ? auth.signup(email, password, role, name)
        : auth.login(email, password)
      onAuth(session)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px', position: 'sticky', top: 0, zIndex: 50,
        background: 'color-mix(in srgb, var(--bg) 80%, transparent)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
          <div style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff' }}>
            <Brain size={20} />
          </div>
          <span className="gradient-text">HireMinds</span>
        </div>
        <ThemeToggle pref={themePref} setPref={setThemePref} />
      </nav>

      {/* Hero */}
      <div ref={heroRef} style={{ position: 'relative', overflow: 'hidden', padding: '64px 32px 48px' }}>
        {/* Animated glow that follows cursor */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(600px circle at ${glow.x * 100}% ${glow.y * 100}%, var(--brand-glow), transparent 60%)`,
          transition: 'background 0.2s ease-out',
        }} />
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99,
            background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
            color: 'var(--text-soft)', marginBottom: 24,
          }}>
            <Sparkles size={14} style={{ color: 'var(--brand)' }} />
            INDIA RUNS Hackathon · Redrob × Hack2Skill
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 18 }}>
            Hiring that sees<br /><span className="gradient-text">potential, not keywords.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-soft)', maxWidth: 540, margin: '0 auto 36px', lineHeight: 1.6 }}>
            An AI hiring platform that ranks and surfaces the best-fit talent from 100,000+ real candidate profiles — built for recruiters.
          </p>
        </motion.div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            maxWidth: 420, margin: '0 auto', position: 'relative',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: 32, boxShadow: 'var(--shadow-lg)',
          }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-sunken)', borderRadius: 12, marginBottom: 24 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 9, fontWeight: 600, fontSize: 14,
                  background: mode === m ? 'var(--surface)' : 'transparent',
                  color: mode === m ? 'var(--brand)' : 'var(--text-soft)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s',
                }}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {mode === 'signup' && (
                <Field label="Full name" value={name} onChange={setName} placeholder="Abhiya" />
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
              <PasswordField label="Password" value={password} onChange={setPassword} />

              <div style={{ height: 8 }} />

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={submit}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15,
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-deep))', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: 'var(--shadow-glow)',
                }}>
                {mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Feature strip */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 32px 64px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {FEATURES.map((f, i) => (
          <motion.div key={f.title}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }} whileHover={{ y: -6 }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: 22, boxShadow: 'var(--shadow-sm)', cursor: 'default',
            }}>
            <div style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 11, background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)', marginBottom: 14 }}>
              <f.icon size={22} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>{f.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
          background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)',
          transition: 'border 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--brand)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
    </div>
  )
}

function PasswordField({ label, value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder="••••••••"
          style={{
            width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, fontSize: 14,
            background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)',
            transition: 'border 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', display: 'grid', placeItems: 'center' }}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}
