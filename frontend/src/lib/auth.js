// API client — talks to FastAPI backend (proxied via vite to :8000)
const BASE = '/api'

async function jpost(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`)
  return r.json()
}

async function jget(path) {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`)
  return r.json()
}

export const api = {
  stats: () => jget('/stats'),
  roles: () => jget('/roles'),
  match: (job_description, top_n, work_mode, budget_max, weights, recruiter) =>
    jpost('/match', { job_description, top_n, work_mode, budget_max, weights, recruiter }),
  plagiarism: () => jget('/plagiarism'),
  salary: (experience, skills) => jpost('/salary', { experience, skills }),
  skillgap: (target_role, current_skills) =>
    jpost('/skillgap', { target_role, current_skills }),
  resume: async (file, jd) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('jd', jd || '')
    const r = await fetch(BASE + '/resume', { method: 'POST', body: fd })
    if (!r.ok) throw new Error('resume failed')
    return r.json()
  },
}

// Email + jobs (appended)
api.emailStatus = () => jget('/email/status')
api.emailShortlist = (payload) => jpost('/email/shortlist', payload)
api.findJobs = (skills, experience, top_n) => jpost('/findjobs', { skills, experience, top_n })
api.listJobs = () => jget('/jobs')
api.resumeAiStatus = () => jget('/resume-ai/status')
api.buildResumeAi = (payload) => jpost('/resume-ai/build', payload)

// Shortlist storage + insights (backend-persisted)
api.getShortlist = (recruiter) => jget('/shortlist?recruiter=' + encodeURIComponent(recruiter || 'default'))
api.addShortlist = (recruiter, candidate) => jpost('/shortlist/add', { recruiter, candidate })
api.removeShortlist = (recruiter, candidate_id) => jpost('/shortlist/remove', { recruiter, candidate_id })
api.bulkShortlist = (items) => jpost('/shortlist/bulk', items)
api.shortlistInsights = (recruiter) => jget('/shortlist/insights?recruiter=' + encodeURIComponent(recruiter || 'default'))
