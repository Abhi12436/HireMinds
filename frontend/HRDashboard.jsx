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

  useEffect(() => {
    api.stats().then(s => { setStats(s); setOffline(false) }).catch(() => setOffline(true))
  }, [])

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
            </div>
          )}

          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'match' && <MatchTab totalCount={stats?.total} />}
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
function MatchTab({ totalCount }) {
  const [jd, setJd] = useState('')
  const [topN, setTopN] = useState(10)
  const [mode, setMode] = useState('Any')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [shortlist, setShortlist] = useState([])
  const [showShortlist, setShowShortlist] = useState(false)
  const [emailMode, setEmailMode] = useState('simulated')
  const [sending, setSending] = useState(null)
  const [sent, setSent] = useState({})

  useEffect(() => { api.emailStatus().then(r => setEmailMode(r.mode)).catch(() => {}) }, [])

  const run = async () => {
    if (!jd.trim()) return
    setLoading(true)
    try { setData(await api.match(jd, topN, mode)) }
    finally { setLoading(false) }
  }

  const toggleShortlist = (c) => {
    setShortlist(prev => prev.find(x => x.id === c.id)
      ? prev.filter(x => x.id !== c.id)
      : [...prev, c])
  }

  const sendEmail = async (c) => {
    const toEmail = c.email || prompt(`Enter ${c.name}'s email address:`)
    if (!toEmail) return
    setSending(c.id)
    try {
      const res = await api.emailShortlist({
        to_email: toEmail,
        candidate_name: c.name,
        job_title: 'the role you applied for',
        recruiter_name: 'HireMinds Recruiting Team',
        company: 'our company',
      })
      setSent(prev => ({ ...prev, [c.id]: res.mode }))
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
    a.href = url
    a.download = 'hireminds_shortlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <SectionTitle>AI Candidate Matching</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description — skills, experience, responsibilities..."
          style={{ minHeight: 130, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Top candidates: {topN}</label>
            <input type="range" min={5} max={50} value={topN} onChange={e => setTopN(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Work mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {['Any', 'remote', 'hybrid', 'onsite'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Button onClick={run} full><Search size={16} /> Find Candidates</Button>
        </div>
      </div>

      {shortlist.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 10, background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>⭐ {shortlist.length} candidate{shortlist.length > 1 ? 's' : ''} shortlisted</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={() => setShowShortlist(s => !s)}>{showShortlist ? 'Hide' : 'View'} Shortlist</Button>
            <Button onClick={exportCSV}><Download size={16} /> Export CSV</Button>
          </div>
        </div>
      )}

      {showShortlist && shortlist.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle>⭐ Your Shortlist</SectionTitle>
            <span style={{ fontSize: 12, color: 'var(--text-soft)', padding: '4px 10px', borderRadius: 99, background: 'var(--bg)' }}>
              Email mode: <b style={{ color: emailMode === 'real' ? 'var(--green)' : 'var(--amber)' }}>{emailMode}</b>
            </span>
          </div>
          {shortlist.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 10, background: 'var(--bg)', marginBottom: 10 }}>
              <div style={{ display: 'grid', placeItems: 'center', minWidth: 42, width: 42, height: 42, borderRadius: 99, background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', color: '#fff', fontWeight: 800 }}>
                {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{c.role} · {c.match_score}% match</div>
              </div>
              {sent[c.id] ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>
                  <CheckCircle size={16} /> {sent[c.id] === 'real' ? 'Email sent' : 'Email sent (demo)'}
                </span>
              ) : (
                <Button onClick={() => sendEmail(c)} disabled={sending === c.id}>
                  <Mail size={15} /> {sending === c.id ? 'Sending...' : 'Notify Candidate'}
                </Button>
              )}
              <button onClick={() => toggleShortlist(c)} style={{ color: 'var(--red)', display: 'grid', placeItems: 'center', padding: 6 }}><Trash2 size={16} /></button>
            </div>
          ))}
          {emailMode === 'simulated' && (
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-bg)' }}>
              ℹ️ Email is in <b>simulated</b> mode (no real emails sent). To send real emails, add your Gmail credentials in <code>backend/email_config.py</code> and restart the backend.
            </div>
          )}
        </motion.div>
      )}

      {loading && <Spinner label="Analysing profiles..." />}

      {data && !loading && (
        <>
          <div style={{ padding: '12px 18px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            ✅ Showing top {data.results.length} of {(totalCount || data.pool_size).toLocaleString()} ranked candidates
          </div>
          {data.results.map((c, i) => (
            <CandidateCard key={c.id} c={c} delay={i * 0.04}
              shortlisted={!!shortlist.find(x => x.id === c.id)}
              onShortlist={() => toggleShortlist(c)} />
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

function CandidateCard({ c, delay, shortlisted, onShortlist }) {
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
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 4 }}>Text relevance</div>
                  <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-sunken)' }}>
                    <div style={{ height: '100%', width: `${c.text_score || 0}%`, borderRadius: 99, background: 'var(--brand)' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{c.text_score || 0}%</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 4 }}>Skill assessment</div>
                  <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-sunken)' }}>
                    <div style={{ height: '100%', width: `${c.assessment_score || 0}%`, borderRadius: 99, background: 'var(--green)' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{c.assessment_score || 0}%</div>
                </div>
              </div>
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
