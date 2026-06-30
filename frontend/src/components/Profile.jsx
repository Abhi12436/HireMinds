import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Save, Plus, Trash2, Building2, Phone, Mail, MapPin, Linkedin, Github,
  Briefcase, GraduationCap, Award, Globe, DollarSign, Check,
} from 'lucide-react'
import { auth } from '../lib/auth'
import { Button, SectionTitle, Pill } from './ui'

/* Reusable form field */
function Field({ label, value, onChange, type = 'text', placeholder, full }) {
  return (
    <div style={{ marginBottom: 14, gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>{label}</label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', minHeight: 80, padding: '11px 13px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(type === 'number' ? e.target.value : e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: '11px 13px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 14 }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 13px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 14 }}>
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '10px 0' }}>
      <label style={{ fontSize: 14, fontWeight: 500 }}>{label}</label>
      <button onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 99, background: value ? 'var(--brand)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}>
        <motion.div animate={{ x: value ? 22 : 2 }} style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 99, background: '#fff' }} />
      </button>
    </div>
  )
}

function Card({ icon: Icon, title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 700, fontSize: 15 }}>
        {Icon && <Icon size={18} style={{ color: 'var(--brand)' }} />} {title}
      </div>
      {children}
    </div>
  )
}

/* ════════ HR PROFILE ════════ */
export function HRProfile({ session }) {
  const existing = auth.getProfile(session.email) || {}
  const [p, setP] = useState({
    name: existing.name || session.name || '',
    title: existing.title || '',
    phone: existing.phone || '',
    linkedin: existing.linkedin || '',
    companyName: existing.companyName || '',
    industry: existing.industry || '',
    companySize: existing.companySize || '',
    website: existing.website || '',
    location: existing.location || '',
    about: existing.about || '',
    hiringFor: existing.hiringFor || '',
    ...existing,
  })
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setP(s => ({ ...s, [k]: v })); setSaved(false) }
  const save = () => { auth.saveProfile(session.email, p); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const initials = (p.name || session.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <SectionTitle>My Recruiter Profile</SectionTitle>

      {/* Header banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 24, borderRadius: 14, marginBottom: 20, background: 'linear-gradient(110deg, var(--brand-deep), var(--brand))' }}>
        <div style={{ display: 'grid', placeItems: 'center', minWidth: 72, width: 72, height: 72, borderRadius: 99, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 26, fontWeight: 800 }}>{initials}</div>
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name || 'Your Name'}</div>
          <div style={{ opacity: 0.85, fontSize: 14 }}>{p.title || 'Recruiter'} {p.companyName && `· ${p.companyName}`}</div>
          <div style={{ opacity: 0.7, fontSize: 13, marginTop: 2 }}>{session.email}</div>
        </div>
      </div>

      <Card icon={Mail} title="Personal Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Full Name" value={p.name} onChange={v => set('name', v)} placeholder="Abhiya Bellamkonda" />
          <Field label="Job Title" value={p.title} onChange={v => set('title', v)} placeholder="Senior Technical Recruiter" />
          <Field label="Phone" value={p.phone} onChange={v => set('phone', v)} placeholder="+91 98765 43210" />
          <Field label="LinkedIn URL" value={p.linkedin} onChange={v => set('linkedin', v)} placeholder="linkedin.com/in/..." />
        </div>
      </Card>

      <Card icon={Building2} title="Company Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Company Name" value={p.companyName} onChange={v => set('companyName', v)} placeholder="TechCorp" />
          <Select label="Industry" value={p.industry} onChange={v => set('industry', v)} options={['IT Services', 'Product', 'Fintech', 'Healthcare', 'E-commerce', 'Consulting', 'Other']} />
          <Select label="Company Size" value={p.companySize} onChange={v => set('companySize', v)} options={['1-50', '51-200', '201-1000', '1001-5000', '5001-10000', '10001+']} />
          <Field label="Website" value={p.website} onChange={v => set('website', v)} placeholder="techcorp.com" />
          <Field label="Location / HQ" value={p.location} onChange={v => set('location', v)} placeholder="Hyderabad, India" />
        </div>
        <Field label="About the Company" type="textarea" value={p.about} onChange={v => set('about', v)} placeholder="What your company does..." />
      </Card>

      <Card icon={Briefcase} title="Recruiting Context">
        <Field label="Roles I Typically Hire For" value={p.hiringFor} onChange={v => set('hiringFor', v)} placeholder="Data Scientists, ML Engineers, Backend Developers" />
      </Card>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button onClick={save}>{saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Profile</>}</Button>
        {saved && <span style={{ color: 'var(--green)', fontSize: 14, fontWeight: 600 }}>✓ Your profile has been saved</span>}
      </div>
    </motion.div>
  )
}

/* ════════ JOB SEEKER PROFILE ════════ */
export function SeekerProfile({ session }) {
  const existing = auth.getProfile(session.email) || {}
  const [p, setP] = useState({
    name: existing.name || session.name || '',
    headline: existing.headline || '',
    summary: existing.summary || '',
    phone: existing.phone || '',
    location: existing.location || '',
    country: existing.country || '',
    currentTitle: existing.currentTitle || '',
    currentCompany: existing.currentCompany || '',
    experience: existing.experience || '',
    industry: existing.industry || '',
    education: existing.education || '',
    institution: existing.institution || '',
    gradYear: existing.gradYear || '',
    linkedin: existing.linkedin || '',
    github: existing.github || '',
    portfolio: existing.portfolio || '',
    salaryMin: existing.salaryMin || '',
    salaryMax: existing.salaryMax || '',
    workMode: existing.workMode || '',
    relocate: existing.relocate || false,
    noticeDays: existing.noticeDays || '',
    openToWork: existing.openToWork ?? true,
    certifications: existing.certifications || '',
    languages: existing.languages || '',
    skills: existing.skills || [],
    ...existing,
  })
  const [newSkill, setNewSkill] = useState({ name: '', proficiency: 'intermediate' })
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setP(s => ({ ...s, [k]: v })); setSaved(false) }
  const save = () => { auth.saveProfile(session.email, p); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const addSkill = () => {
    if (!newSkill.name.trim()) return
    set('skills', [...p.skills, { ...newSkill }])
    setNewSkill({ name: '', proficiency: 'intermediate' })
  }
  const removeSkill = (i) => set('skills', p.skills.filter((_, idx) => idx !== i))

  const initials = (p.name || session.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const profTone = { beginner: 'amber', intermediate: 'blue', expert: 'green' }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <SectionTitle>My Profile</SectionTitle>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 24, borderRadius: 14, marginBottom: 20, background: 'linear-gradient(110deg, var(--brand-deep), var(--brand))' }}>
        <div style={{ display: 'grid', placeItems: 'center', minWidth: 72, width: 72, height: 72, borderRadius: 99, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 26, fontWeight: 800 }}>{initials}</div>
        <div style={{ color: '#fff', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name || 'Your Name'}</div>
          <div style={{ opacity: 0.85, fontSize: 14 }}>{p.headline || 'Add a headline'}</div>
          <div style={{ opacity: 0.7, fontSize: 13, marginTop: 2 }}>{session.email}</div>
        </div>
        {p.openToWork && <div style={{ padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700 }}>🟢 Open to work</div>}
      </div>

      <Card icon={Mail} title="Basic Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Full Name" value={p.name} onChange={v => set('name', v)} placeholder="Your name" />
          <Field label="Headline" value={p.headline} onChange={v => set('headline', v)} placeholder="Data Engineer | Python, Spark" />
          <Field label="Phone" value={p.phone} onChange={v => set('phone', v)} placeholder="+91 ..." />
          <Field label="Location" value={p.location} onChange={v => set('location', v)} placeholder="Hyderabad" />
          <Field label="Country" value={p.country} onChange={v => set('country', v)} placeholder="India" />
        </div>
        <Field label="Professional Summary" type="textarea" value={p.summary} onChange={v => set('summary', v)} placeholder="A short summary of your experience and goals..." />
      </Card>

      <Card icon={Briefcase} title="Experience">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Current Title" value={p.currentTitle} onChange={v => set('currentTitle', v)} placeholder="Backend Engineer" />
          <Field label="Current Company" value={p.currentCompany} onChange={v => set('currentCompany', v)} placeholder="Mindtree" />
          <Field label="Years of Experience" type="number" value={p.experience} onChange={v => set('experience', v)} placeholder="3" />
          <Field label="Industry" value={p.industry} onChange={v => set('industry', v)} placeholder="IT Services" />
        </div>
      </Card>

      <Card icon={Award} title="Skills">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input value={newSkill.name} onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))} placeholder="Add a skill (e.g. Python)"
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            style={{ flex: '1 1 200px', padding: '10px 13px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 14 }} />
          <select value={newSkill.proficiency} onChange={e => setNewSkill(s => ({ ...s, proficiency: e.target.value }))}
            style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 14 }}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <Button onClick={addSkill}><Plus size={16} /> Add</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {p.skills.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No skills added yet</span>}
          {p.skills.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13 }}>
              <b>{s.name}</b>
              <Pill tone={profTone[s.proficiency]}>{s.proficiency}</Pill>
              <button onClick={() => removeSkill(i)} style={{ color: 'var(--red)', display: 'grid', placeItems: 'center' }}><Trash2 size={13} /></button>
            </span>
          ))}
        </div>
      </Card>

      <Card icon={GraduationCap} title="Education">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Degree" value={p.education} onChange={v => set('education', v)} placeholder="B.Tech CSE" />
          <Field label="Institution" value={p.institution} onChange={v => set('institution', v)} placeholder="Vignan Institute" />
          <Field label="Year" type="number" value={p.gradYear} onChange={v => set('gradYear', v)} placeholder="2026" />
        </div>
      </Card>

      <Card icon={DollarSign} title="Job Preferences">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Expected Salary Min (LPA)" type="number" value={p.salaryMin} onChange={v => set('salaryMin', v)} placeholder="8" />
          <Field label="Expected Salary Max (LPA)" type="number" value={p.salaryMax} onChange={v => set('salaryMax', v)} placeholder="14" />
          <Select label="Preferred Work Mode" value={p.workMode} onChange={v => set('workMode', v)} options={['remote', 'hybrid', 'onsite']} />
          <Field label="Notice Period (days)" type="number" value={p.noticeDays} onChange={v => set('noticeDays', v)} placeholder="30" />
        </div>
        <Toggle label="Willing to relocate" value={p.relocate} onChange={v => set('relocate', v)} />
        <Toggle label="Open to work" value={p.openToWork} onChange={v => set('openToWork', v)} />
      </Card>

      <Card icon={Github} title="Links & More">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="LinkedIn" value={p.linkedin} onChange={v => set('linkedin', v)} placeholder="linkedin.com/in/..." />
          <Field label="GitHub" value={p.github} onChange={v => set('github', v)} placeholder="github.com/..." />
          <Field label="Portfolio" value={p.portfolio} onChange={v => set('portfolio', v)} placeholder="yoursite.com" />
          <Field label="Languages" value={p.languages} onChange={v => set('languages', v)} placeholder="English, Hindi, Telugu" />
        </div>
        <Field label="Certifications" value={p.certifications} onChange={v => set('certifications', v)} placeholder="AWS Certified, Google Data Analytics" />
      </Card>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button onClick={save}>{saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Profile</>}</Button>
        {saved && <span style={{ color: 'var(--green)', fontSize: 14, fontWeight: 600 }}>✓ Your profile has been saved</span>}
      </div>
    </motion.div>
  )
}
