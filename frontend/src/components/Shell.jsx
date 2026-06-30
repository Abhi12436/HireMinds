import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sun, Moon, Monitor, LogOut, User, ChevronDown } from 'lucide-react'

function ThemeToggle({ pref, setPref }) {
  const opts = [['light', Sun], ['dark', Moon], ['system', Monitor]]
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-sunken)', borderRadius: 99, border: '1px solid var(--border)' }}>
      {opts.map(([val, Icon]) => (
        <button key={val} onClick={() => setPref(val)} aria-label={val}
          style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 99, background: pref === val ? 'var(--brand)' : 'transparent', color: pref === val ? '#fff' : 'var(--text-soft)', transition: 'all 0.2s' }}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

function ProfileMenu({ session, onLogout, onProfile }) {
  const [open, setOpen] = useState(false)
  const initials = (session.name || session.email).slice(0, 2).toUpperCase()
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 99, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff', fontSize: 12, fontWeight: 800 }}>{initials}</div>
        <ChevronDown size={14} style={{ color: 'var(--text-soft)' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'absolute', right: 0, top: 46, width: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 8, zIndex: 100 }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{session.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{session.email}</div>
              <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>{session.role === 'hr' ? 'Recruiter' : 'Job Seeker'}</div>
            </div>
            <MenuItem icon={User} label="My Profile" onClick={() => { setOpen(false); onProfile && onProfile() }} />
            <MenuItem icon={LogOut} label="Sign out" onClick={onLogout} danger />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, color: danger ? 'var(--red)' : 'var(--text)', textAlign: 'left' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sunken)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon size={16} /> {label}
    </button>
  )
}

export default function Shell({ session, onLogout, themePref, setThemePref, onProfile, backendOffline, hero, children }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', position: 'sticky', top: 0, zIndex: 50, background: 'color-mix(in srgb, var(--bg) 85%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>
          <div style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff' }}>
            <Brain size={18} />
          </div>
          <span className="gradient-text">HireMinds</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle pref={themePref} setPref={setThemePref} />
          <ProfileMenu session={session} onLogout={onLogout} onProfile={onProfile} />
        </div>
      </nav>

      {backendOffline && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 28px', fontSize: 13, fontWeight: 600, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          ⚠️ Backend not running — open a terminal in the backend folder and run: python -m uvicorn main:app --port 8000
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px 60px' }}>
        {hero}
        {children}
      </div>
    </div>
  )
}

export function Hero({ title, subtitle }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)', padding: '32px 36px', marginBottom: 24, background: 'linear-gradient(110deg, var(--brand-deep), var(--brand) 55%, var(--brand-light))' }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', bottom: -70, left: '30%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#fff', position: 'relative' }}>{title}</h1>
      <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, marginTop: 4, position: 'relative' }}>{subtitle}</p>
    </motion.div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 20px', fontSize: 14, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? 'var(--brand)' : 'var(--text-soft)', borderBottom: `2px solid ${active === t.id ? 'var(--brand)' : 'transparent'}`, marginBottom: -2, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
          <t.icon size={16} /> {t.label}
        </button>
      ))}
    </div>
  )
}
