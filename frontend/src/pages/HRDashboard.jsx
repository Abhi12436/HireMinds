import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, BarChart3, ShieldCheck, DollarSign, Search, Users, Calendar,
  Wrench, Star, Link2, MapPin, CheckCircle, AlertTriangle, Github, Download,
  Mail, Trash2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from 'recharts'
import Shell, { Hero, Tabs } from '../components/Shell'
import { MetricCard, Badge, Pill, SectionTitle, Button, Spinner } from '../components/ui'
import { HRProfile } from '../components/Profile'
import { api } from '../lib/api'

const TABS = [
  { id: 'match', label: 'AI Matching', icon: Target },
  { id: 'shortlist', label: 'Shortlist', icon: Star },
  { id: 'analytics', label: 'Talent Analytics', icon: BarChart3 },
  { id: 'fraud', label: 'Fraud Check', icon: ShieldCheck },
  { id: 'salary', label: 'Salary Benchmarks', icon: DollarSign },
]

const CHART_COLORS = ['#0A66C2', '#378FE9', '#70B5F9', '#A6D0F7', '#004182', '#5B8DD9']

export default function HRDashboard(props) {
  const [tab, setTab] = useState('match')
  const [stats, setStats] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [offline, setOffline] = useState(false)
  // Shortlist persisted to backend (survives restart)
  const [shortlist, setShortlist] = useState([])
  const recruiter = props.session?.email || 'default'

  useEffect(() => {
    api.stats().then(s => { setStats(s); setOffline(false) }).catch(() => setOffline(true))
    // Load saved shortlist from backend
    api.getShortlist(recruiter).then(r => setShortlist(r.shortlist || [])).catch(() => {})
  }, [])

  const toggleShortlist = (c) => {
    const exists = shortlist.find(x => x.id === c.id)
    if (exists) {
      setShortlist(prev => prev.filter(x => x.id !== c.id))
      api.removeShortlist(recruiter, c.id).catch(() => {})
    } else {
      setShortlist(prev => [...prev, c])
      api.addShortlist(recruiter, c).catch(() => {})
    }
  }

  const bulkAdd = (candidates) => {
    const newOnes = candidates.filter(c => !shortlist.find(x => x.id === c.id))
    if (!newOnes.length) return
    setShortlist(prev => [...prev, ...newOnes])
    api.bulkShortlist(newOnes.map(c => ({ recruiter, candidate: c }))).catch(() => {})
  }

  return (
    <Shell {...props} backendOffline={offline} onProfile={() => setShowProfile(true)}
      hero={!showProfile && <Hero title="🏢 HR Command Center" subtitle="Find, analyse, and validate top talent with AI precision" />}>
      {showProfile ? (
        <div>
          <button onClick={() => setShowProfile(false)} style={{ marginBottom: 16, color: 'var(--brand)', fontWeight: 600, fontSize: 14 }}>← Back to dashboard</button>
          <HRProfile session={props.session} />
        </div>
      ) : (
        <>
          {stats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Candidates in pool</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--brand)' }}>{stats.total.toLocaleString()}</div>
              </div>
              {shortlist.length > 0 && (
                <div onClick={() => setTab('shortlist')} style={{ flex: '1 1 140px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>⭐ Shortlisted</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--brand)' }}>{shortlist.length}</div>
                </div>
              )}
            </div>
          )}

          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'match' && <MatchTab totalCount={stats?.total} shortlist={shortlist} onToggleShortlist={toggleShortlist} onBulkAdd={bulkAdd} />}
              {tab === 'shortlist' && <ShortlistTab shortlist={shortlist} onToggleShortlist={toggleShortlist} />}
              {tab === 'analytics' && <AnalyticsTab stats={stats} />}
              {tab === 'fraud' && <FraudTab />}
              {tab === 'salary' && <SalaryTab />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </Shell>
  )
}

/* ── TAB 1: AI MATCHING ── */
function MatchTab({ totalCount, shortlist, onToggleShortlist, onBulkAdd }) {
  const [compareIds, setCompareIds] = useState([])
  const toggleCompare = (c) => {
    setCompareIds(prev => prev.find(x => x.id === c.id)
      ? prev.filter(x => x.id !== c.id)
      : prev.length >= 3 ? prev : [...prev, c])
  }
  const [jd, setJd] = useState('')
  const [topN, setTopN] = useState(10)
  const [mode, setMode] = useState('Any')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  // Weight presets — let HR prioritise what matters for this role
  const PRESETS = {
    balanced: null,  // backend defaults
    skills: { text: 35, skills: 35, github: 10, endorsements: 5, connections: 2, salary_fit: 5, work_pref: 4, availability: 2, completeness: 2 },
    social: { text: 30, skills: 15, github: 12, endorsements: 20, connections: 13, salary_fit: 4, work_pref: 4, availability: 2, completeness: 0 },
    budget: { text: 30, skills: 18, github: 6, endorsements: 6, connections: 3, salary_fit: 25, work_pref: 6, availability: 4, completeness: 2 },
    available: { text: 30, skills: 18, github: 6, endorsements: 6, connections: 3, salary_fit: 8, work_pref: 8, availability: 19, completeness: 2 },
  }

  const EXAMPLES = [
    'Machine Learning Developer who knows deep learning and can deploy models to the cloud',
    'Senior backend engineer with API design and database experience, available soon',
    'Data analyst skilled in dashboards and business reporting',
  ]

  const run = async () => {
    if (!jd.trim()) return
    setLoading(true)
    try {
      setData(await api.match(jd, topN, mode, budget ? Number(budget) : null, PRESETS[priority]))
    } finally { setLoading(false) }
  }

  return (
    <div>
      <SectionTitle>AI Candidate Matching</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 12 }}>
        <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description — or describe the role in plain English. The AI understands meaning, not just keywords."
          style={{ minHeight: 130, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Top candidates: {topN}</label>
            <input type="range" min={5} max={50} value={topN} onChange={e => setTopN(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Work mode</label>
              <select value={mode} onChange={e => setMode(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {['Any', 'remote', 'hybrid', 'onsite'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Budget ≤ (LPA)</label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 20"
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
          </div>
          <Button onClick={run} full><Search size={16} /> Find Candidates</Button>
        </div>
      </div>

      {/* Priority presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-soft)', fontWeight: 600 }}>Prioritise:</span>
        {[['balanced', '⚖️ Balanced'], ['skills', '🎯 Skills'], ['social', '🤝 Social proof'], ['budget', '💰 Budget fit'], ['available', '⚡ Availability']].map(([k, label]) => (
          <button key={k} onClick={() => setPriority(k)}
            style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: priority === k ? 'var(--brand)' : 'var(--surface)',
              color: priority === k ? '#fff' : 'var(--text-soft)',
              border: `1px solid ${priority === k ? 'var(--brand)' : 'var(--border)'}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* Example JD chips */}
      {!jd && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>Try:</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setJd(ex)}
              style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, background: 'var(--bg)', color: 'var(--brand)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              {ex.slice(0, 42)}...
            </button>
          ))}
        </div>
      )}

      {loading && <Spinner label="Analysing profiles..." />}

      {data && !loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 14, fontWeight: 600, marginBottom: 16, flexWrap: 'wrap' }}>
            <span>✅ Showing top {data.results.length} of {(totalCount || data.pool_size).toLocaleString()} ranked candidates</span>
            {data.match_method === 'semantic+keyword' && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'color-mix(in srgb, var(--brand) 15%, transparent)', color: 'var(--brand)' }}>
                🧠 Semantic AI — understands meaning, not just keywords
              </span>
            )}
          </div>

          {/* Bulk actions + compare bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="ghost" onClick={() => onBulkAdd(data.results)}>
              <Star size={15} /> Shortlist all {data.results.length}
            </Button>
            {compareIds.length > 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {compareIds.length} selected to compare {compareIds.length >= 2 ? '↓ see below' : '(pick 1-2 more)'}
              </span>
            )}
          </div>

          {/* Score distribution across the whole pool */}
          {data.distribution && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📊 How all {(totalCount || data.pool_size).toLocaleString()} candidates scored for this job</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginBottom: 12 }}>Most candidates score low; only a few are strong matches — that's the ranking working.</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="range" stroke="var(--text-faint)" fontSize={10} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="var(--brand)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Compare panel */}
          {compareIds.length >= 2 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--brand)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionTitle>⚖️ Compare Candidates</SectionTitle>
                <button onClick={() => setCompareIds([])} style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>Clear</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${compareIds.length}, 1fr)`, gap: 10, fontSize: 13 }}>
                <div></div>
                {compareIds.map(c => <div key={c.id} style={{ fontWeight: 700, textAlign: 'center' }}>{c.name}</div>)}
                {[['Match', 'match_score', '%'], ['Experience', 'experience', 'y'], ['GitHub', 'github_score', ''], ['Endorsements', 'endorsements', ''], ['Connections', 'connections', ''], ['Salary max', 'salary_max', ' LPA'], ['Notice', 'notice_days', 'd']].map(([label, key, suf]) => (
                  <>
                    <div style={{ color: 'var(--text-soft)', fontWeight: 600, padding: '6px 0', borderTop: '1px solid var(--border)' }}>{label}</div>
                    {compareIds.map(c => {
                      const vals = compareIds.map(x => x[key] ?? 0)
                      const best = Math.max(...vals)
                      const isBest = key !== 'notice_days' && key !== 'salary_max' && (c[key] ?? 0) === best && best > 0
                      return <div key={c.id} style={{ textAlign: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', fontWeight: isBest ? 800 : 500, color: isBest ? 'var(--green)' : 'var(--text)' }}>{c[key] ?? '—'}{c[key] != null ? suf : ''}</div>
                    })}
                  </>
                ))}
              </div>
            </div>
          )}

          {data.results.map((c, i) => (
            <CandidateCard key={c.id} c={c} delay={i * 0.04}
              shortlisted={!!shortlist.find(x => x.id === c.id)}
              onShortlist={() => onToggleShortlist(c)}
              comparing={!!compareIds.find(x => x.id === c.id)}
              onCompare={() => toggleCompare(c)} />
          ))}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 16 }}>
            <SectionTitle>Match Scores</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(220, data.results.length * 34)}>
              <BarChart layout="vertical" data={data.results.map(c => ({ name: c.name, score: c.match_score }))} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} stroke="var(--text-faint)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={120} stroke="var(--text-faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                  {data.results.map((c, i) => (
                    <Cell key={i} fill={c.match_score > 50 ? '#1A7E3C' : c.match_score > 25 ? '#9A6600' : '#C0392B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function CandidateCard({ c, delay, shortlisted, onShortlist, comparing, onCompare }) {
  const [open, setOpen] = useState(false)
  const tone = c.match_score > 50 ? 'green' : c.match_score > 25 ? 'amber' : 'red'
  const topScores = Object.entries(c.skill_scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileHover={{ borderColor: 'var(--brand)' }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
        {onShortlist && (
          <button onClick={(e) => { e.stopPropagation(); onShortlist() }} aria-label="Shortlist"
            style={{ display: 'grid', placeItems: 'center', color: shortlisted ? '#F5A623' : 'var(--text-faint)', cursor: 'pointer', padding: 4 }}>
            <Star size={20} fill={shortlisted ? '#F5A623' : 'none'} />
          </button>
        )}
        {onCompare && (
          <button onClick={(e) => { e.stopPropagation(); onCompare() }} aria-label="Compare" title="Add to compare"
            style={{ display: 'grid', placeItems: 'center', color: comparing ? 'var(--brand)' : 'var(--text-faint)', cursor: 'pointer', padding: 4, fontSize: 11, fontWeight: 700, border: `1.5px solid ${comparing ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 6, width: 26, height: 26 }}>
            ⚖
          </button>
        )}
        <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, textAlign: 'left' }}>
          <div style={{ display: 'grid', placeItems: 'center', minWidth: 46, width: 46, height: 46, borderRadius: 99, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff', fontWeight: 800 }}>
            {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>#{c.rank} · {c.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.role} · {c.experience}y · {c.location}</div>
          </div>
          <Badge tone={tone}>{c.match_score}% match</Badge>
        </button>
      </div>
      {c.explanation && (
        <div style={{ padding: '0 16px 12px 76px', marginTop: -4 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-soft)', fontStyle: 'italic' }}>💡 {c.explanation}</div>
        </div>
      )}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: 18 }}>
              {c.breakdown && (
                <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🔍 Why this rank — all signals
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    {[
                      ['Job relevance', c.breakdown.text, 'var(--brand)'],
                      ['Skill scores', c.breakdown.skills, 'var(--green)'],
                      ['GitHub', c.breakdown.github, '#6e5494'],
                      ['Endorsements', c.breakdown.endorsements, '#F5A623'],
                      ['Connections', c.breakdown.connections, '#0A66C2'],
                      ['Salary fit', c.breakdown.salary_fit, '#16a34a'],
                      ['Work mode', c.breakdown.work_pref, '#0891b2'],
                      ['Availability', c.breakdown.availability, '#db2777'],
                      ['Completeness', c.breakdown.completeness, '#64748b'],
                    ].map(([label, val, color]) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-soft)' }}>{label}</span>
                          <span style={{ fontWeight: 700 }}>{val}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-sunken)' }}>
                          <div style={{ height: '100%', width: `${val}%`, borderRadius: 99, background: color, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(c.strengths?.length || c.concerns?.length) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: 'var(--green-bg)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>✓ Why shortlist</div>
                    {(c.strengths || []).map((s, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }}>• {s}</div>
                    ))}
                    {!c.strengths?.length && <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>—</div>}
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: 'var(--red-bg, color-mix(in srgb, var(--red) 8%, transparent))', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚠ Concerns / why reject</div>
                    {(c.concerns || []).map((s, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }}>• {s}</div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
                <Stat icon={Calendar} val={`${c.experience}y`} lbl="Experience" />
                <Stat icon={Wrench} val={c.skills.length} lbl="Skills" />
                <Stat icon={Github} val={c.github_score ?? '—'} lbl="GitHub" />
                <Stat icon={Link2} val={c.connections ?? '—'} lbl="Connections" />
                <Stat icon={Star} val={c.endorsements ?? '—'} lbl="Endorsements" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Row icon={MapPin} label="Location" value={c.location} />
                  <Row label="Company" value={c.company} />
                  <Row label="Industry" value={c.industry} />
                  <Row label="Work mode" value={c.work_mode} />
                  <Row icon={CheckCircle} label="Open to work" value={c.open_to_work ? 'Yes' : 'No'} />
                  {c.salary_min > 0 && <Row icon={DollarSign} label="Expected" value={`₹${c.salary_min}–${c.salary_max} LPA`} />}
                  {c.notice_days != null && <Row label="Notice" value={`${c.notice_days} days`} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>Skills</div>
                  <div style={{ marginBottom: 12 }}>{c.skills.map(s => <Pill key={s}>{s}</Pill>)}</div>
                  {topScores.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>Assessment scores</div>
                      {topScores.map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                            <span>{k}</span><span style={{ fontWeight: 600 }}>{Math.round(v)}%</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-sunken)' }}>
                            <div style={{ height: '100%', width: `${v}%`, borderRadius: 99, background: 'linear-gradient(90deg, var(--brand), var(--brand-light))' }} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Stat({ icon: Icon, val, lbl }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
      {Icon && <Icon size={16} style={{ color: 'var(--brand)', marginBottom: 4 }} />}
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--brand)' }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{lbl}</div>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 6 }}>
      {Icon && <Icon size={14} style={{ color: 'var(--text-faint)' }} />}
      <span style={{ color: 'var(--text-soft)' }}>{label}:</span>
      <span style={{ fontWeight: 600, textTransform: label === 'Work mode' ? 'capitalize' : 'none' }}>{value}</span>
    </div>
  )
}

/* ── TAB: SHORTLIST (dedicated section) ── */
function ShortlistTab({ shortlist, onToggleShortlist }) {
  const [emailMode, setEmailMode] = useState('simulated')
  const [sending, setSending] = useState(null)
  const [sent, setSent] = useState({})
  const [jobTitle, setJobTitle] = useState('the role you applied for')
  const [company, setCompany] = useState('our company')
  const [showTemplate, setShowTemplate] = useState(false)

  useEffect(() => { api.emailStatus().then(r => setEmailMode(r.mode)).catch(() => {}) }, [])

  const sendEmail = async (c) => {
    const toEmail = c.email || prompt(`Enter ${c.name}'s email address to notify them:`)
    if (!toEmail) return
    setSending(c.id)
    try {
      const res = await api.emailShortlist({
        to_email: toEmail,
        candidate_name: c.name,
        job_title: jobTitle,
        recruiter_name: 'HireMinds Recruiting Team',
        company: company,
      })
      setSent(prev => ({ ...prev, [c.id]: { mode: res.mode, email: toEmail } }))
    } catch (e) {
      alert('Email failed: ' + e.message)
    } finally { setSending(null) }
  }

  const exportCSV = () => {
    if (!shortlist.length) return
    const headers = ['candidate_id', 'name', 'role', 'match_score', 'experience', 'location', 'work_mode', 'salary_min', 'salary_max', 'github_score', 'skills']
    const rows = shortlist.map(c => [
      c.id, c.name, c.role, c.match_score, c.experience, c.location,
      c.work_mode, c.salary_min, c.salary_max, c.github_score ?? '',
      '"' + (c.skills || []).join('; ') + '"'
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'hireminds_shortlist.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const notifyAll = async () => {
    for (const c of shortlist) {
      if (!sent[c.id]) await sendEmail(c)
    }
  }

  if (!shortlist.length) {
    return (
      <div>
        <SectionTitle>⭐ Shortlisted Candidates</SectionTitle>
        <div style={{ textAlign: 'center', padding: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text-soft)' }}>
          <Star size={40} style={{ color: 'var(--text-faint)', marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>No candidates shortlisted yet</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>Go to <b>AI Matching</b>, run a search, and click the ⭐ star on candidates you like. They'll appear here.</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle>⭐ Shortlisted Candidates ({shortlist.length})</SectionTitle>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-soft)', padding: '5px 12px', borderRadius: 99, background: 'var(--bg)' }}>
            Email: <b style={{ color: emailMode === 'real' ? 'var(--green)' : 'var(--amber)' }}>{emailMode === 'real' ? 'live' : 'demo'}</b>
          </span>
          <Button variant="ghost" onClick={() => setShowTemplate(s => !s)}><Mail size={16} /> Customize email</Button>
          <Button variant="ghost" onClick={exportCSV}><Download size={16} /> Export CSV</Button>
          <Button onClick={notifyAll}><Mail size={16} /> Notify All</Button>
        </div>
      </div>

      {showTemplate && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 5 }}>Job title (in email)</label>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13.5 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 5 }}>Company name</label>
            <input value={company} onChange={e => setCompany(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13.5 }} />
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-soft)' }}>
            Preview: "Hi [name], you've been shortlisted for <b>{jobTitle}</b> at <b>{company}</b>. Our team will reach out shortly."
          </div>
        </div>
      )}

      {emailMode === 'simulated' && (
        <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--amber-bg)' }}>
          ℹ️ Email is in <b>demo mode</b> — clicking Notify shows success but doesn't send a real email. To send real emails, add your Gmail credentials in <code>backend/email_config.py</code> and restart the backend.
        </div>
      )}

      {/* Pool insights */}
      {shortlist.length > 0 && (() => {
        const modes = {}
        let expSum = 0, expN = 0, salSum = 0, salN = 0
        shortlist.forEach(c => {
          const m = c.work_mode || 'unknown'; modes[m] = (modes[m] || 0) + 1
          if (typeof c.experience === 'number') { expSum += c.experience; expN++ }
          if (c.salary_max) { salSum += c.salary_max; salN++ }
        })
        const modeStr = Object.entries(modes).map(([k, v]) => `${v} ${k}`).join(' · ')
        return (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px', background: 'var(--bg)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Avg experience</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>{expN ? (expSum / expN).toFixed(1) : 0}y</div>
            </div>
            <div style={{ flex: '1 1 130px', background: 'var(--bg)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Avg salary (max)</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>₹{salN ? (salSum / salN).toFixed(1) : 0} LPA</div>
            </div>
            <div style={{ flex: '2 1 200px', background: 'var(--bg)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Work mode mix</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{modeStr}</div>
            </div>
          </div>
        )
      })()}

      {shortlist.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 10, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', placeItems: 'center', minWidth: 46, width: 46, height: 46, borderRadius: 99, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff', fontWeight: 800 }}>
            {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{c.role} · {c.experience}y · {c.location}</div>
            <div style={{ marginTop: 4 }}>{(c.skills || []).slice(0, 5).map(s => <Pill key={s}>{s}</Pill>)}</div>
          </div>
          <Badge tone={c.match_score > 50 ? 'green' : c.match_score > 25 ? 'amber' : 'red'}>{c.match_score}% match</Badge>
          {sent[c.id] ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, color: 'var(--green)', fontSize: 13, fontWeight: 600, minWidth: 130 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={16} /> Notified</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>{sent[c.id].email}</span>
            </span>
          ) : (
            <Button onClick={() => sendEmail(c)} disabled={sending === c.id}>
              <Mail size={15} /> {sending === c.id ? 'Sending...' : 'Notify'}
            </Button>
          )}
          <button onClick={() => onToggleShortlist(c)} aria-label="Remove" style={{ color: 'var(--red)', display: 'grid', placeItems: 'center', padding: 6 }}><Trash2 size={16} /></button>
        </motion.div>
      ))}
    </div>
  )
}

/* ── TAB 2: ANALYTICS ── */
function AnalyticsTab({ stats }) {
  if (!stats) return <Spinner label="Loading analytics..." />

  const expBins = bin(stats.experience_dist, 0, 15, 15)
  const skillBins = bin(stats.skills_dist, 0, 20, 10)
  const modeData = Object.entries(stats.work_modes).map(([name, value]) => ({ name, value }))

  return (
    <div>
      <SectionTitle>Talent Pool Analytics</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard icon={Users} value={stats.total.toLocaleString()} label="Total Candidates" delay={0} />
        <MetricCard icon={Calendar} value={`${stats.avg_experience}y`} label="Avg Experience" delay={0.05} />
        <MetricCard icon={Wrench} value={stats.avg_skills} label="Avg Skills" delay={0.1} />
        <MetricCard icon={Github} value={stats.avg_github ?? '—'} label="Avg GitHub Score" delay={0.15} />
        <MetricCard icon={Star} value={stats.avg_completeness ?? '—'} label="Avg Completeness" delay={0.2} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Experience Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={expBins}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text-faint)" fontSize={11} />
              <YAxis stroke="var(--text-faint)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#0A66C2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Skills Per Candidate">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={skillBins}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--text-faint)" fontSize={11} />
              <YAxis stroke="var(--text-faint)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#378FE9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Preferred Work Mode">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {modeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top Candidate Roles">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={stats.top_roles} margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--text-faint)" fontSize={11} />
              <YAxis type="category" dataKey="role" width={110} stroke="var(--text-faint)" fontSize={10} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#004182" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function bin(arr, min, max, n) {
  const w = (max - min) / n
  const bins = Array.from({ length: n }, (_, i) => ({ label: `${Math.round(min + i * w)}`, count: 0 }))
  arr.forEach(v => {
    let idx = Math.floor((v - min) / w)
    if (idx < 0) idx = 0; if (idx >= n) idx = n - 1
    bins[idx].count++
  })
  return bins
}

/* ── TAB 3: FRAUD ── */
function FraudTab() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  const scan = async () => {
    setLoading(true)
    try { setData(await api.plagiarism()) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <SectionTitle>Plagiarism & Fraud Detection</SectionTitle>
      <div style={{ padding: '12px 18px', borderRadius: 10, background: 'color-mix(in srgb, var(--brand) 8%, transparent)', color: 'var(--text-soft)', fontSize: 14, marginBottom: 16 }}>
        Scans profiles for duplicate or suspiciously similar resumes using cosine similarity.
      </div>
      <Button onClick={scan}><ShieldCheck size={16} /> Run Fraud Scan</Button>

      {loading && <Spinner label="Scanning profiles..." />}

      {data && !loading && (
        <div style={{ marginTop: 16 }}>
          {data.flagged.length > 0 ? (
            <>
              <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 12 }}>⚠️ {data.flagged.length} suspicious pair(s) found</div>
              {data.flagged.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: 'var(--red-bg)', borderLeft: '4px solid var(--red)', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--red)' }} /><b>{f.c1}</b> & <b>{f.c2}</b></span>
                  <Badge tone="red">{f.similarity}% similar</Badge>
                </motion.div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--green-bg)', borderRadius: 12, marginTop: 16 }}>
              <CheckCircle size={40} style={{ color: 'var(--green)' }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)', marginTop: 8 }}>All Clear — No Plagiarism Detected</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>Scanned {data.scanned} profiles — all appear authentic</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── TAB 4: SALARY ── */
function SalaryTab() {
  const [exp, setExp] = useState(3)
  const [skills, setSkills] = useState('Python, SQL, Machine Learning')
  const [data, setData] = useState(null)

  const calc = async () => {
    const list = skills.split(',').map(s => s.trim()).filter(Boolean)
    setData(await api.salary(exp, list))
  }

  return (
    <div>
      <SectionTitle>Salary Intelligence</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Years of experience: {exp}</label>
          <input type="range" min={0} max={15} value={exp} onChange={e => setExp(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Key skills</label>
          <input value={skills} onChange={e => setSkills(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
      </div>
      <Button onClick={calc}><DollarSign size={16} /> Calculate Salary Range</Button>

      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 20 }}>
          <div style={{ textAlign: 'center', padding: 28, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '4px solid var(--brand)', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Estimated market salary · {exp} yrs</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 38, color: 'var(--brand)', margin: '6px 0' }}>₹{data.min}L – ₹{data.max}L</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Annual CTC · Indian market estimate</div>
          </div>
          <ChartCard title="Salary Growth Curve">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.curve}>
                <defs>
                  <linearGradient id="salG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A66C2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0A66C2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="exp" stroke="var(--text-faint)" fontSize={11} />
                <YAxis stroke="var(--text-faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="salary" stroke="#0A66C2" strokeWidth={2.5} fill="url(#salG)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>
      )}
    </div>
  )
}
