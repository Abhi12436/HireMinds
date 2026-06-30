import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Map, Upload, DollarSign, CheckCircle, Lightbulb, Target, FileEdit, Search } from 'lucide-react'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import Shell, { Hero, Tabs } from '../components/Shell'
import { MetricCard, Pill, SectionTitle, Button, Spinner } from '../components/ui'
import { SeekerProfile } from '../components/Profile'
import ResumeBuilder from './ResumeBuilder'
import FindJobs from './FindJobs'
import { api } from '../lib/api'

const TABS = [
  { id: 'resume', label: 'Resume Analyser', icon: FileText },
  { id: 'builder', label: 'Resume Builder', icon: FileEdit },
  { id: 'jobs', label: 'Find Jobs', icon: Search },
  { id: 'gap', label: 'Skill Gap Finder', icon: Map },
]

export default function CandidatePortal(props) {
  const [tab, setTab] = useState('resume')
  const [showProfile, setShowProfile] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    api.stats().then(() => setOffline(false)).catch(() => setOffline(true))
  }, [])

  return (
    <Shell {...props} backendOffline={offline} onProfile={() => setShowProfile(true)}
      hero={!showProfile && <Hero title="👨‍💼 Candidate Portal" subtitle="Upload your resume and get AI-powered career insights in seconds" />}>
      {showProfile ? (
        <div>
          <button onClick={() => setShowProfile(false)} style={{ marginBottom: 16, color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>← Back to portal</button>
          <SeekerProfile session={props.session} />
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'resume' && <ResumeTab />}
              {tab === 'builder' && <ResumeBuilder session={props.session} />}
              {tab === 'jobs' && <FindJobs session={props.session} />}
              {tab === 'gap' && <GapTab />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </Shell>
  )
}

/* ── RESUME ANALYSER ── */
function ResumeTab() {
  const [file, setFile] = useState(null)
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [exp, setExp] = useState(1)
  const [sal, setSal] = useState(null)

  const analyse = async () => {
    if (!file) return
    setLoading(true)
    try { setData(await api.resume(file, jd)) }
    catch (e) { alert('Could not read PDF: ' + e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (data) api.salary(exp, data.found_skills).then(r => setSal(r))
  }, [data, exp])

  const scoreColor = data ? (data.score >= 70 ? 'var(--green)' : data.score >= 50 ? 'var(--amber)' : 'var(--red)') : 'var(--brand)'

  return (
    <div>
      <SectionTitle>AI Resume Analyser</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 28, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--surface)', cursor: 'pointer', minHeight: 130 }}>
          <Upload size={28} style={{ color: 'var(--brand)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{file ? file.name : 'Upload Resume (PDF)'}</span>
          <input type="file" accept=".pdf" hidden onChange={e => setFile(e.target.files[0])} />
        </label>
        <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Target job description (optional) — paste to get a match score..."
          style={{ minHeight: 130, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }} />
      </div>
      <Button onClick={analyse} disabled={!file}><FileText size={16} /> Analyse Resume</Button>

      {loading && <Spinner label="Reading and analysing your resume..." />}

      {data && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <MetricCard value={`${data.score}`} label="Resume Score" color={scoreColor} />
            <MetricCard value={data.words} label="Word Count" />
            <MetricCard value={jd ? `${data.jd_match}%` : data.found_skills.length} label={jd ? 'JD Match' : 'Skills Found'} color="#7C3AED" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, display: 'grid', placeItems: 'center' }}>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: data.score, fill: scoreColor }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={99} background={{ fill: 'var(--bg-sunken)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: -120, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: scoreColor }}>{data.score}</div>
              <div style={{ marginTop: 70, fontSize: 13, color: 'var(--text-soft)' }}>Resume Strength</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>✅ Detected skills</div>
              <div style={{ marginBottom: 16 }}>
                {data.found_skills.length ? data.found_skills.map(s => <Pill key={s}>{s}</Pill>)
                  : <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No standard tech skills detected</span>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>💡 Improvement tips</div>
              {data.tips.length ? data.tips.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13, marginBottom: 6 }}>
                  <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {t}
                </div>
              )) : <div style={{ color: 'var(--green)', fontSize: 13 }}>🌟 Excellent resume!</div>}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Your experience: {exp} years</label>
            <input type="range" min={0} max={15} value={exp} onChange={e => setExp(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>
          {sal && (
            <div style={{ textAlign: 'center', padding: 24, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '4px solid var(--brand)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>💰 Your estimated market value</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: 'var(--brand)', marginTop: 6 }}>₹{sal.min}L – ₹{sal.max}L</div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ── SKILL GAP ── */
function GapTab() {
  const [roles, setRoles] = useState([])
  const [role, setRole] = useState('')
  const [skills, setSkills] = useState('Python, Excel, SQL')
  const [data, setData] = useState(null)

  useEffect(() => {
    api.roles().then(r => { setRoles(r.roles); setRole(r.roles[0]) })
  }, [])

  const analyse = async () => {
    const list = skills.split(',').map(s => s.trim()).filter(Boolean)
    setData(await api.skillgap(role, list))
  }

  return (
    <div>
      <SectionTitle>Skill Gap Finder</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Target role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {roles.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Your current skills</label>
          <input value={skills} onChange={e => setSkills(e.target.value)}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
      </div>
      <Button onClick={analyse}><Target size={16} /> Analyse My Profile</Button>

      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard value={`${data.match_pct}%`} label="Profile Match" />
            <MetricCard value={data.matched.length} label="Skills Matched" color="var(--green)" />
            <MetricCard value={data.missing.length} label="Skills Missing" color="var(--red)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>✅ Skills you have</div>
              <div>{data.matched.length ? data.matched.map(s => <Pill key={s} tone="green">{s}</Pill>) : <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>None yet — start with the roadmap</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>❌ Skills to acquire</div>
              <div>{data.missing.length ? data.missing.map(s => <Pill key={s} tone="red">{s}</Pill>) : <span style={{ color: 'var(--green)', fontSize: 13 }}>🎉 You have all required skills!</span>}</div>
            </div>
          </div>

          {data.roadmap.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📚 Your Learning Roadmap</div>
              {data.roadmap.map((step, i) => (
                <motion.div key={step.skill} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--brand)', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}><b style={{ color: 'var(--brand)' }}>Step {step.step}</b> &nbsp; Learn <b>{step.skill}</b></span>
                  <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>⏱ {step.time}</span>
                </motion.div>
              ))}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
