import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Plus, Trash2, Eye } from 'lucide-react'
import { auth } from '../lib/auth'
import { Button, SectionTitle } from '../components/ui'

/* Reusable input */
function In({ label, value, onChange, placeholder, type = 'text', full }) {
  return (
    <div style={{ marginBottom: 12, gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 5 }}>{label}</label>
      {type === 'textarea'
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 13.5, resize: 'vertical', fontFamily: 'inherit' }} />
        : <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 13.5 }} />}
    </div>
  )
}

export default function ResumeBuilder({ session }) {
  const saved = auth.getProfile(session.email) || {}
  const [r, setR] = useState({
    name: saved.name || '', email: session.email, phone: saved.phone || '',
    location: saved.location || '', headline: saved.headline || '',
    linkedin: saved.linkedin || '', github: saved.github || '',
    summary: saved.summary || '',
    experiences: saved.experiences || [{ title: '', company: '', period: '', desc: '' }],
    education: [{ degree: saved.education || '', institution: saved.institution || '', year: saved.gradYear || '' }],
    skills: (saved.skills || []).map(s => s.name).join(', ') || '',
    certifications: saved.certifications || '',
    projects: [{ name: '', desc: '' }],
  })
  const [preview, setPreview] = useState(false)
  const set = (k, v) => setR(s => ({ ...s, [k]: v }))

  const setExp = (i, k, v) => setR(s => { const e = [...s.experiences]; e[i] = { ...e[i], [k]: v }; return { ...s, experiences: e } })
  const addExp = () => setR(s => ({ ...s, experiences: [...s.experiences, { title: '', company: '', period: '', desc: '' }] }))
  const delExp = (i) => setR(s => ({ ...s, experiences: s.experiences.filter((_, x) => x !== i) }))

  const setProj = (i, k, v) => setR(s => { const p = [...s.projects]; p[i] = { ...p[i], [k]: v }; return { ...s, projects: p } })
  const addProj = () => setR(s => ({ ...s, projects: [...s.projects, { name: '', desc: '' }] }))
  const delProj = (i) => setR(s => ({ ...s, projects: s.projects.filter((_, x) => x !== i) }))

  const setEdu = (i, k, v) => setR(s => { const e = [...s.education]; e[i] = { ...e[i], [k]: v }; return { ...s, education: e } })
  const addEdu = () => setR(s => ({ ...s, education: [...s.education, { degree: '', institution: '', year: '' }] }))

  const downloadHTML = () => {
    const html = generateResumeHTML(r)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(r.name || 'resume').replace(/\s+/g, '_')}_resume.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(generateResumeHTML(r))
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  if (preview) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setPreview(false)} style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>← Back to editor</button>
          <div style={{ flex: 1 }} />
          <Button onClick={printPDF}><Download size={16} /> Save as PDF</Button>
          <Button variant="ghost" onClick={downloadHTML}><Download size={16} /> Download HTML</Button>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <iframe title="resume" srcDoc={generateResumeHTML(r)} style={{ width: '100%', height: 800, border: 'none' }} />
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionTitle>Resume Builder</SectionTitle>
        <Button onClick={() => setPreview(true)}><Eye size={16} /> Preview & Download</Button>
      </div>

      <Card title="Personal Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <In label="Full Name" value={r.name} onChange={v => set('name', v)} placeholder="Abhiya Bellamkonda" />
          <In label="Headline" value={r.headline} onChange={v => set('headline', v)} placeholder="Data Engineer | Python, Spark" />
          <In label="Email" value={r.email} onChange={v => set('email', v)} />
          <In label="Phone" value={r.phone} onChange={v => set('phone', v)} placeholder="+91 ..." />
          <In label="Location" value={r.location} onChange={v => set('location', v)} placeholder="Hyderabad, India" />
          <In label="LinkedIn" value={r.linkedin} onChange={v => set('linkedin', v)} placeholder="linkedin.com/in/..." />
          <In label="GitHub" value={r.github} onChange={v => set('github', v)} placeholder="github.com/..." />
        </div>
        <In full label="Professional Summary" type="textarea" value={r.summary} onChange={v => set('summary', v)} placeholder="2-3 sentences about you..." />
      </Card>

      <Card title="Work Experience" action={<button onClick={addExp} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.experiences.map((e, i) => (
          <div key={i} style={rowBox}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <In label="Job Title" value={e.title} onChange={v => setExp(i, 'title', v)} placeholder="Backend Engineer" />
              <In label="Company" value={e.company} onChange={v => setExp(i, 'company', v)} placeholder="Mindtree" />
              <In label="Period" value={e.period} onChange={v => setExp(i, 'period', v)} placeholder="2024 - Present" />
            </div>
            <In full label="What you did" type="textarea" value={e.desc} onChange={v => setExp(i, 'desc', v)} placeholder="Built streaming pipelines with Kafka & Spark..." />
            {r.experiences.length > 1 && <button onClick={() => delExp(i)} style={delBtn}><Trash2 size={13} /> Remove</button>}
          </div>
        ))}
      </Card>

      <Card title="Projects" action={<button onClick={addProj} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.projects.map((p, i) => (
          <div key={i} style={rowBox}>
            <In label="Project Name" value={p.name} onChange={v => setProj(i, 'name', v)} placeholder="CausalFlow - Decision Intelligence Platform" />
            <In full label="Description" type="textarea" value={p.desc} onChange={v => setProj(i, 'desc', v)} placeholder="React + FastAPI app that..." />
            {r.projects.length > 1 && <button onClick={() => delProj(i)} style={delBtn}><Trash2 size={13} /> Remove</button>}
          </div>
        ))}
      </Card>

      <Card title="Education" action={<button onClick={addEdu} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.education.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <In label="Degree" value={e.degree} onChange={v => setEdu(i, 'degree', v)} placeholder="B.Tech Data Science" />
            <In label="Institution" value={e.institution} onChange={v => setEdu(i, 'institution', v)} placeholder="Vignan Institute" />
            <In label="Year" value={e.year} onChange={v => setEdu(i, 'year', v)} placeholder="2026" />
          </div>
        ))}
      </Card>

      <Card title="Skills & Certifications">
        <In full label="Skills (comma-separated)" value={r.skills} onChange={v => set('skills', v)} placeholder="Python, SQL, Spark, AWS, Docker" />
        <In full label="Certifications" value={r.certifications} onChange={v => set('certifications', v)} placeholder="AWS Certified, Google Data Analytics" />
      </Card>

      <Button onClick={() => setPreview(true)}><Eye size={16} /> Preview & Download Resume</Button>
    </motion.div>
  )
}

const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)', fontWeight: 600, fontSize: 13 }
const delBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontSize: 12.5, fontWeight: 500, marginTop: 4 }
const rowBox = { padding: 14, background: 'var(--bg)', borderRadius: 10, marginBottom: 12 }

function Card({ title, action, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

/* Generates a clean printable resume HTML */
function generateResumeHTML(r) {
  const skills = (r.skills || '').split(',').map(s => s.trim()).filter(Boolean)
  const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#1a1a1a; line-height:1.5; padding:48px 56px; max-width:850px; margin:auto; font-size:13.5px; }
  h1 { font-size:30px; font-weight:800; letter-spacing:-0.5px; }
  .head-sub { color:#0A66C2; font-weight:600; font-size:15px; margin-top:2px; }
  .contact { color:#555; font-size:12.5px; margin-top:8px; display:flex; gap:14px; flex-wrap:wrap; }
  .sec { margin-top:24px; }
  .sec h2 { font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#0A66C2; border-bottom:2px solid #0A66C2; padding-bottom:4px; margin-bottom:10px; }
  .item { margin-bottom:12px; }
  .item-top { display:flex; justify-content:space-between; }
  .item-title { font-weight:700; }
  .item-sub { color:#555; font-size:12.5px; }
  .item-period { color:#888; font-size:12px; }
  .item-desc { margin-top:3px; color:#333; }
  .skills { display:flex; flex-wrap:wrap; gap:7px; }
  .skill { background:#EEF3FB; color:#0A66C2; padding:4px 11px; border-radius:20px; font-size:12px; font-weight:500; }
  @media print { body { padding:32px 40px; } }
</style></head><body>
  <h1>${esc(r.name) || 'Your Name'}</h1>
  ${r.headline ? `<div class="head-sub">${esc(r.headline)}</div>` : ''}
  <div class="contact">
    ${r.email ? `<span>✉ ${esc(r.email)}</span>` : ''}
    ${r.phone ? `<span>☎ ${esc(r.phone)}</span>` : ''}
    ${r.location ? `<span>📍 ${esc(r.location)}</span>` : ''}
    ${r.linkedin ? `<span>in ${esc(r.linkedin)}</span>` : ''}
    ${r.github ? `<span>⌥ ${esc(r.github)}</span>` : ''}
  </div>
  ${r.summary ? `<div class="sec"><h2>Summary</h2><p>${esc(r.summary)}</p></div>` : ''}
  ${r.experiences.some(e => e.title || e.company) ? `<div class="sec"><h2>Experience</h2>
    ${r.experiences.filter(e => e.title || e.company).map(e => `
      <div class="item"><div class="item-top">
        <div><span class="item-title">${esc(e.title)}</span> ${e.company ? `<span class="item-sub">· ${esc(e.company)}</span>` : ''}</div>
        <span class="item-period">${esc(e.period)}</span></div>
        ${e.desc ? `<div class="item-desc">${esc(e.desc)}</div>` : ''}</div>`).join('')}
  </div>` : ''}
  ${r.projects.some(p => p.name) ? `<div class="sec"><h2>Projects</h2>
    ${r.projects.filter(p => p.name).map(p => `
      <div class="item"><span class="item-title">${esc(p.name)}</span>
      ${p.desc ? `<div class="item-desc">${esc(p.desc)}</div>` : ''}</div>`).join('')}
  </div>` : ''}
  ${r.education.some(e => e.degree || e.institution) ? `<div class="sec"><h2>Education</h2>
    ${r.education.filter(e => e.degree || e.institution).map(e => `
      <div class="item"><div class="item-top">
        <div><span class="item-title">${esc(e.degree)}</span> ${e.institution ? `<span class="item-sub">· ${esc(e.institution)}</span>` : ''}</div>
        <span class="item-period">${esc(e.year)}</span></div></div>`).join('')}
  </div>` : ''}
  ${skills.length ? `<div class="sec"><h2>Skills</h2><div class="skills">${skills.map(s => `<span class="skill">${esc(s)}</span>`).join('')}</div></div>` : ''}
  ${r.certifications ? `<div class="sec"><h2>Certifications</h2><p>${esc(r.certifications)}</p></div>` : ''}
</body></html>`
}
