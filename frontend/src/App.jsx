import { useState } from 'react'
import { useTheme } from './lib/useTheme'
import { auth } from './lib/auth'
import Landing from './pages/Landing'
import HRDashboard from './pages/HRDashboard'

export default function App() {
  const [themePref, setThemePref] = useTheme()
  const [session, setSession] = useState(() => auth.current())

  const logout = () => { auth.logout(); setSession(null) }

  if (!session) {
    return <Landing onAuth={setSession} themePref={themePref} setThemePref={setThemePref} />
  }

  const shared = { session, onLogout: logout, themePref, setThemePref }
  // Recruiter-only tool: everyone goes to the HR dashboard
  return <HRDashboard {...shared} />
}
