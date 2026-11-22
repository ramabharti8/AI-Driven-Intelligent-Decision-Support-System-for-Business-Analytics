// components/layout/TopBar.jsx

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Bell, Search, Sun, Moon, Mic, ChevronDown } from 'lucide-react'
import './TopBar.css'

const NOTIFICATIONS = [
  { id: 1, text: 'Random Forest model training complete — 94.7% accuracy', time: '2m ago', read: false },
  { id: 2, text: 'New dataset uploaded: sales_q3_2024.csv', time: '15m ago', read: false },
  { id: 3, text: 'PDF report generated successfully', time: '1h ago', read: true },
  { id: 4, text: 'Revenue forecast updated for Q4', time: '3h ago', read: true },
]

export default function TopBar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser,   setShowUser]   = useState(false)
  const [search, setSearch]         = useState('')
  const unread = NOTIFICATIONS.filter(n => !n.read).length

  return (
    <header className="topbar">
      {/* Search */}
      <div className="topbar-search">
        <Search size={16} className="search-icon" />
        <input
          className="search-input"
          placeholder="Search dashboards, models, reports..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="topbar-right">
        {/* Voice */}
        <button className="topbar-btn" title="Voice Assistant">
          <Mic size={18} />
        </button>

        {/* Theme toggle */}
        <button className="topbar-btn" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="topbar-notif-wrap">
          <button
            className="topbar-btn"
            onClick={() => { setShowNotifs(s => !s); setShowUser(false) }}
            title="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </button>

          {showNotifs && (
            <div className="dropdown notif-dropdown">
              <div className="dropdown-header">
                <span>Notifications</span>
                <span className="badge badge-primary">{unread} new</span>
              </div>
              {NOTIFICATIONS.map(n => (
                <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                  <div className="notif-dot-small" />
                  <div>
                    <p>{n.text}</p>
                    <span>{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="topbar-user-wrap">
          <button
            className="topbar-user"
            onClick={() => { setShowUser(s => !s); setShowNotifs(false) }}
          >
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            <ChevronDown size={14} />
          </button>

          {showUser && (
            <div className="dropdown user-dropdown">
              <div className="dropdown-header">{user?.email}</div>
              <div className="dropdown-item" onClick={() => { window.location.href='/profile'; setShowUser(false) }}>
                Profile Settings
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={logout}>Sign Out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
