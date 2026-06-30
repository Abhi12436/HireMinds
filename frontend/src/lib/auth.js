const USERS_KEY = 'hireminds_users'
const SESSION_KEY = 'hireminds_session'
const PROFILE_KEY = 'hireminds_profiles'

function readUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {} }
  catch { return {} }
}
function writeUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)) }

function readProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {} }
  catch { return {} }
}
function writeProfiles(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) }

export const auth = {
  signup(email, password, role, name) {
    const users = readUsers()
    if (users[email]) throw new Error('An account with this email already exists.')
    users[email] = { password, role, name: name || email.split('@')[0] }
    writeUsers(users)
    return this.login(email, password)
  },
  login(email, password) {
    const users = readUsers()
    const u = users[email]
    if (!u) throw new Error('No account found. Please sign up first.')
    if (u.password !== password) throw new Error('Incorrect password.')
    const session = { email, role: u.role, name: u.name }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  },
  current() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) }
    catch { return null }
  },
  logout() { localStorage.removeItem(SESSION_KEY) },
  getProfile(email) {
    const profiles = readProfiles()
    return profiles[email] || null
  },
  saveProfile(email, data) {
    const profiles = readProfiles()
    profiles[email] = { ...(profiles[email] || {}), ...data }
    writeProfiles(profiles)
    return profiles[email]
  },
}
