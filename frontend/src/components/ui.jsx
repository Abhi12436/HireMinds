import { motion } from 'framer-motion'

export function MetricCard({ icon: Icon, value, label, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }} whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: 18, textAlign: 'center', boxShadow: 'var(--shadow-sm)',
      }}>
      {Icon && (
        <div style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, margin: '0 auto 8px', background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: color || 'var(--brand)' }}>
          <Icon size={20} />
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: color || 'var(--brand)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </motion.div>
  )
}

export function Badge({ children, tone = 'blue' }) {
  const map = {
    blue: ['var(--brand)', 'color-mix(in srgb, var(--brand) 12%, transparent)'],
    green: ['var(--green)', 'var(--green-bg)'],
    amber: ['var(--amber)', 'var(--amber-bg)'],
    red: ['var(--red)', 'var(--red-bg)'],
  }
  const [fg, bg] = map[tone] || map.blue
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: fg, background: bg }}>
      {children}
    </span>
  )
}

export function Pill({ children, tone = 'blue' }) {
  const map = {
    blue: ['var(--brand)', 'color-mix(in srgb, var(--brand) 10%, transparent)', 'color-mix(in srgb, var(--brand) 30%, transparent)'],
    green: ['var(--green)', 'var(--green-bg)', 'color-mix(in srgb, var(--green) 35%, transparent)'],
    red: ['var(--red)', 'var(--red-bg)', 'color-mix(in srgb, var(--red) 35%, transparent)'],
  }
  const [fg, bg, br] = map[tone] || map.blue
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', margin: 2, borderRadius: 99, fontSize: 12, fontWeight: 500, color: fg, background: bg, border: `1px solid ${br}` }}>
      {children}
    </span>
  )
}

export function SectionTitle({ children }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--brand)', display: 'inline-block' }}>
      {children}
    </h2>
  )
}

export function Button({ children, onClick, variant = 'primary', full, ...rest }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, var(--brand), var(--brand-deep))', color: '#fff', boxShadow: 'var(--shadow-glow)' },
    ghost: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  }
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick} {...rest}
      style={{ padding: '11px 22px', borderRadius: 99, fontWeight: 600, fontSize: 14, width: full ? '100%' : 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...styles[variant] }}>
      {children}
    </motion.button>
  )
}

export function Spinner({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, color: 'var(--text-soft)' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 32, height: 32, borderRadius: 99, border: '3px solid var(--border)', borderTopColor: 'var(--brand)' }} />
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
    </div>
  )
}
