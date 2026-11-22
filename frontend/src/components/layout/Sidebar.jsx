// components/layout/Sidebar.jsx

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Sidebar.css'
import {
  LayoutDashboard, Database, Cpu, BarChart3, TrendingUp,
  Lightbulb, FileText, Shield, User, LogOut, ChevronLeft,
  ChevronRight, Zap, Settings, Users
} from 'lucide-react'

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    section: 'Data & ML',
    items: [
      { to: '/datasets',    icon: Database,   label: 'Datasets' },
      { to: '/preprocess',  icon: Settings,   label: 'Preprocessing' },
      { to: '/ml-models',   icon: Cpu,        label: 'ML Models' },
    ]
  },
  {
    section: 'Analytics',
    items: [
      { to: '/customers',   icon: Users,      label: 'Customers & Churn' },
      { to: '/predictions', icon: TrendingUp, label: 'Forecasting' },
      { to: '/insights',    icon: Lightbulb,  label: 'AI Insights' },
      { to: '/reports',     icon: FileText,   label: 'Reports' },
    ]
  },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={20} color="white" />
        </div>
        <div className="sidebar-logo-text">
          <h2>AI Decision</h2>
          <span>Support System</span>
        </div>
      </div>

      {/* Toggle button */}
      <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(section => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <span className="nav-icon"><item.icon size={18} /></span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        {/* Admin */}
        {isAdmin && (
          <div>
            <div className="nav-section-label">Administration</div>
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? 'Admin Panel' : ''}
            >
              <span className="nav-icon"><Shield size={18} /></span>
              <span className="nav-label">Admin Panel</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={collapsed ? 'Profile' : ''}
        >
          <span className="nav-icon"><User size={18} /></span>
          <span className="nav-label">{user?.name || 'Profile'}</span>
        </NavLink>
        <div
          className="nav-item"
          onClick={handleLogout}
          title={collapsed ? 'Logout' : ''}
          style={{ color: 'var(--accent-danger)', cursor: 'pointer' }}
        >
          <span className="nav-icon"><LogOut size={18} /></span>
          <span className="nav-label">Logout</span>
        </div>
      </div>
    </aside>
  )
}
