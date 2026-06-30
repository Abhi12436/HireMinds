import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileEdit, Download, Plus, Trash2, Eye, Sparkles, Loader } from 'lucide-react'
import { auth } from '../lib/auth'
import { api } from '../lib/api'
import { Button, SectionTitle } from '../components/ui'

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

export default function ResumeBuilder({ session }) {
  const saved = auth.getProfile(session.email) || {}
  const [r, setR] = useState({
    name: saved.name || '', email: session.email, phone: saved.phone || '',
    location: saved.location || '', headline: saved.headline || '',
    linkedin: saved.linkedin || '', github: saved.github || '',
    summary: saved.summary || '',
    target_role: '',
    experiences: [{ title: '', company: '', period: '', desc: '' }],
    education: [{ degree: saved.education || '', institution: saved.institution || '', year: saved.gradYear || '' }],
    projects: [{ name: '', desc: '' }],
    skills: (saved.skills || []).map(s => s.name).join(', ') || '',
    certifications: saved.certifications || '',
    achievements: [''],
    interests: '',
  })
  const [built, setBuilt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState('template')
  const [preview, setPreview] = useState(false)

  useEffect(() => { api.resumeAiStatus().then(s => setAiMode(s.mode)).catch(() => {}) }, [])

  const set = (k, v) => setR(s => ({ ...s, [k]: v }))
  const setArr = (key, i, k, v) => setR(s => { const a = [...s[key]]; a[i] = { ...a[i], [k]: v }; return { ...s, [key]: a } })
  const addArr = (key, blank) => setR(s => ({ ...s, [key]: [...s[key], blank] }))
  const delArr = (key, i) => setR(s => ({ ...s, [key]: s[key].filter((_, x) => x !== i) }))
  const setAch = (i, v) => setR(s => { const a = [...s.achievements]; a[i] = v; return { ...s, achievements: a } })

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.buildResumeAi({
        ...r,
        achievements: r.achievements.filter(a => a.trim()),
      })
      setBuilt(res.data)
      setAiMode(res.mode)
      setPreview(true)
    } catch (e) {
      alert('Build failed: ' + e.message + '\n\nMake sure the backend is running.')
    } finally { setLoading(false) }
  }

  const printPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(resumeHTML(built))
    w.document.close()
    setTimeout(() => w.print(), 500)
  }
  const downloadHTML = () => {
    const blob = new Blob([resumeHTML(built)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${(built.name || 'resume').replace(/\s+/g, '_')}_resume.html`; a.click()
    URL.revokeObjectURL(url)
  }

  if (preview && built) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPreview(false)} style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>← Back to editor</button>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: aiMode === 'ai' ? 'var(--green-bg)' : 'var(--amber-bg)', color: aiMode === 'ai' ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
            {aiMode === 'ai' ? '✨ AI-polished' : '📝 Smart template'}
          </span>
          <div style={{ flex: 1 }} />
          <Button onClick={printPDF}><Download size={16} /> Save as PDF</Button>
          <Button variant="ghost" onClick={downloadHTML}><Download size={16} /> Download HTML</Button>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <iframe title="resume" srcDoc={resumeHTML(built)} style={{ width: '100%', height: 1000, border: 'none' }} />
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <SectionTitle>AI Resume Builder</SectionTitle>
        <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, background: 'var(--bg)', color: 'var(--text-soft)' }}>
          Mode: <b style={{ color: aiMode === 'ai' ? 'var(--green)' : 'var(--amber)' }}>{aiMode === 'ai' ? 'AI-powered ✨' : 'Smart template'}</b>
        </span>
      </div>

      {aiMode === 'template' && (
        <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--amber-bg)' }}>
          ℹ️ Running in smart-template mode (cleans + formats your text). For AI-written bullets, add your free Groq key in <code>backend/groq_config.py</code> and restart the backend.
        </div>
      )}

      <Card title="Personal Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <In label="Full Name" value={r.name} onChange={v => set('name', v)} placeholder="Jaswanth Potlacheruvu" />
          <In label="Headline" value={r.headline} onChange={v => set('headline', v)} placeholder="Data & Analytics | Python, SQL, Power BI" />
          <In label="Email" value={r.email} onChange={v => set('email', v)} />
          <In label="Phone" value={r.phone} onChange={v => set('phone', v)} />
          <In label="Location" value={r.location} onChange={v => set('location', v)} placeholder="Hyderabad" />
          <In label="Target Role (optional)" value={r.target_role} onChange={v => set('target_role', v)} placeholder="Data Analyst at Zepto" />
          <In label="LinkedIn" value={r.linkedin} onChange={v => set('linkedin', v)} />
          <In label="GitHub" value={r.github} onChange={v => set('github', v)} />
        </div>
        <In full label="Summary (rough notes OK — AI will polish)" type="textarea" value={r.summary} onChange={v => set('summary', v)} placeholder="data science grad, built ai apps, good at python and ml..." />
      </Card>

      <Card title="Work Experience" action={<button onClick={() => addArr('experiences', { title: '', company: '', period: '', desc: '' })} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.experiences.map((e, i) => (
          <div key={i} style={rowBox}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <In label="Job Title" value={e.title} onChange={v => setArr('experiences', i, 'title', v)} placeholder="Data Science Intern" />
              <In label="Company" value={e.company} onChange={v => setArr('experiences', i, 'company', v)} placeholder="Personifwy" />
              <In label="Period" value={e.period} onChange={v => setArr('experiences', i, 'period', v)} placeholder="Jun 2024 - Aug 2024" />
            </div>
            <In full label="What you did (rough notes)" type="textarea" value={e.desc} onChange={v => setArr('experiences', i, 'desc', v)} placeholder="analysed data with python. made dashboards. built ml models" />
            {r.experiences.length > 1 && <button onClick={() => delArr('experiences', i)} style={delBtn}><Trash2 size={13} /> Remove</button>}
          </div>
        ))}
      </Card>

      <Card title="Projects" action={<button onClick={() => addArr('projects', { name: '', desc: '' })} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.projects.map((p, i) => (
          <div key={i} style={rowBox}>
            <In label="Project Name" value={p.name} onChange={v => setArr('projects', i, 'name', v)} placeholder="CausalFlow — AI Operational Intelligence" />
            <In full label="Description (rough notes)" type="textarea" value={p.desc} onChange={v => setArr('projects', i, 'desc', v)} placeholder="react fastapi postgresql, ml delivery prediction, aws" />
            {r.projects.length > 1 && <button onClick={() => delArr('projects', i)} style={delBtn}><Trash2 size={13} /> Remove</button>}
          </div>
        ))}
      </Card>

      <Card title="Education" action={<button onClick={() => addArr('education', { degree: '', institution: '', year: '' })} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.education.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <In label="Degree" value={e.degree} onChange={v => setArr('education', i, 'degree', v)} placeholder="B.Tech Data Science" />
            <In label="Institution" value={e.institution} onChange={v => setArr('education', i, 'institution', v)} placeholder="Vignan Institute" />
            <In label="Year" value={e.year} onChange={v => setArr('education', i, 'year', v)} placeholder="2026" />
          </div>
        ))}
      </Card>

      <Card title="Achievements" action={<button onClick={() => addArr('achievements', '')} style={addBtn}><Plus size={14} /> Add</button>}>
        {r.achievements.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={a} onChange={e => setAch(i, e.target.value)} placeholder="ncc a certificate"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 13.5 }} />
            {r.achievements.length > 1 && <button onClick={() => delArr('achievements', i)} style={{ color: 'var(--red)', display: 'grid', placeItems: 'center', padding: 6 }}><Trash2 size={15} /></button>}
          </div>
        ))}
      </Card>

      <Card title="Skills, Certifications & Interests">
        <In full label="Skills (comma-separated)" value={r.skills} onChange={v => set('skills', v)} placeholder="Python, SQL, Power BI, ML, FastAPI" />
        <In full label="Certifications" value={r.certifications} onChange={v => set('certifications', v)} placeholder="NPTEL Python for Data Science, AWS Cloud Practitioner" />
        <In full label="Interests (comma-separated)" value={r.interests} onChange={v => set('interests', v)} placeholder="Competitive Programming, Reading, Karate" />
      </Card>

      <Button onClick={generate} disabled={loading}>
        {loading ? <><Loader size={16} /> Generating...</> : <><Sparkles size={16} /> Generate Resume</>}
      </Button>
    </motion.div>
  )
}

/* A4 ATS-friendly resume HTML — mirrors a clean professional layout */
function resumeHTML(d) {
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const contact = [d.email, d.phone, d.location, d.linkedin, d.github].filter(Boolean).map(esc).join('  |  ')
  const expHTML = (d.experiences || []).filter(e => e.title || e.company).map(e => `
    <div class="item">
      <div class="row"><span class="t">${esc(e.title)}${e.company ? ` — ${esc(e.company)}` : ''}</span><span class="d">${esc(e.period)}</span></div>
      ${(e.bullets || []).length ? `<ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`).join('')
  const projHTML = (d.projects || []).filter(p => p.name).map(p => `
    <div class="item">
      <div class="t">${esc(p.name)}</div>
      ${(p.bullets || []).length ? `<ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`).join('')
  const eduHTML = (d.education || []).filter(e => e.degree || e.institution).map(e => `
    <div class="item"><div class="row"><span class="t">${esc(e.degree)}${e.institution ? ` — ${esc(e.institution)}` : ''}</span><span class="d">${esc(e.year)}</span></div></div>`).join('')
  const achHTML = (d.achievements || []).filter(Boolean).map(a => `<li>${esc(a)}</li>`).join('')
  const skillsHTML = (d.skills || []).map(esc).join('  •  ')
  const interestsHTML = (d.interests || []).map(esc).join('  •  ')

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Calibri',Arial,sans-serif; color:#1a1a1a; line-height:1.45;
         width:210mm; min-height:297mm; margin:0 auto; padding:16mm 18mm; font-size:10.3pt; background:#fff; }
  h1 { font-size:21pt; font-weight:800; letter-spacing:-0.3px; }
  .head-sub { color:#0A66C2; font-weight:600; font-size:11pt; margin-top:1px; }
  .contact { color:#444; font-size:8.6pt; margin-top:5px; }
  .sec { margin-top:13px; }
  .sec h2 { font-size:9.5pt; text-transform:uppercase; letter-spacing:0.8px; color:#0A66C2;
            border-bottom:1.3px solid #0A66C2; padding-bottom:3px; margin-bottom:7px; font-weight:700; }
  .item { margin-bottom:9px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; }
  .t { font-weight:700; font-size:10.5pt; }
  .d { color:#777; font-size:8.6pt; white-space:nowrap; padding-left:10px; }
  ul { margin:3px 0 0 16px; }
  li { margin-bottom:2px; color:#222; }
  p { color:#222; }
  @media print { body { padding:14mm 16mm; } }
</style></head><body>
  <h1>${esc(d.name) || 'Your Name'}</h1>
  ${d.headline ? `<div class="head-sub">${esc(d.headline)}</div>` : ''}
  <div class="contact">${contact}</div>
  ${d.summary ? `<div class="sec"><h2>Professional Summary</h2><p>${esc(d.summary)}</p></div>` : ''}
  ${expHTML ? `<div class="sec"><h2>Experience</h2>${expHTML}</div>` : ''}
  ${projHTML ? `<div class="sec"><h2>Projects</h2>${projHTML}</div>` : ''}
  ${eduHTML ? `<div class="sec"><h2>Education</h2>${eduHTML}</div>` : ''}
  ${skillsHTML ? `<div class="sec"><h2>Skills</h2><p>${skillsHTML}</p></div>` : ''}
  ${achHTML ? `<div class="sec"><h2>Achievements</h2><ul>${achHTML}</ul></div>` : ''}
  ${d.certifications ? `<div class="sec"><h2>Certifications</h2><p>${esc(d.certifications)}</p></div>` : ''}
  ${interestsHTML ? `<div class="sec"><h2>Interests</h2><p>${interestsHTML}</p></div>` : ''}
</body></html>`
}
