import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, MapPin, Briefcase, DollarSign, Building2 } from 'lucide-react'
import { auth } from '../lib/auth'
import { api } from '../lib/api'
import { Button, SectionTitle, Pill, Spinner, Badge } from '../components/ui'

export default function FindJobs({ session }) {
  const saved = auth.getProfile(session.email) || {}
  const [skills, setSkills] = useState((saved.skills || []).map(s => s.name).join(', ') || 'Python, SQL, Spark')
  const [exp, setExp] = useState(saved.experience || 2)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  const search = async () => {
    const list = skills.split(',').map(s => s.trim()).filter(Boolean)
    if (!list.length) return
    setLoading(true)
    try {
      const r = await api.findJobs(list, Number(exp), 8)
      setResults(r.results)
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <SectionTitle>Find Jobs For You</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 5 }}>Your skills (comma-separated)</label>
          <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Python, SQL, Spark, AWS"
            style={{ width: '100%', padding: '11px 13px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 5 }}>Experience: {exp}y</label>
          <input type="range" min={0} max={15} value={exp} onChange={e => setExp(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
        </div>
        <Button onClick={search}><Search size={16} /> Find Jobs</Button>
      </div>

      {loading && <Spinner label="Finding the best jobs for you..." />}

      {results && !loading && (
        <>
          <div style={{ padding: '12px 18px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            ✅ Found {results.length} jobs matching your skills
          </div>
          {results.map((job, i) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              whileHover={{ borderColor: 'var(--brand)' }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{job.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-soft)', fontSize: 13, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={14} /> {job.company}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {job.location}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={14} /> {job.experience}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={14} /> {job.salary}</span>
                    <Pill>{job.work_mode}</Pill>
                  </div>
                </div>
                <Badge tone={job.match_score > 25 ? 'green' : job.match_score > 12 ? 'amber' : 'blue'}>{job.match_score}% match</Badge>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-soft)', marginBottom: 12, lineHeight: 1.5 }}>{job.description}</p>
              {job.matched_skills.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)' }}>✅ Your matching skills: </span>
                  {job.matched_skills.map(s => <Pill key={s} tone="green">{s}</Pill>)}
                </div>
              )}
              {job.skills_to_learn.length > 0 && (
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)' }}>📚 Skills to learn: </span>
                  {job.skills_to_learn.map(s => <Pill key={s} tone="red">{s}</Pill>)}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <Button variant="ghost" onClick={() => alert(`Application submitted for ${job.title} at ${job.company}! (demo)`)}>Apply Now</Button>
              </div>
            </motion.div>
          ))}
        </>
      )}
    </motion.div>
  )
}
