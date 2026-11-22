// components/layout/AppLayout.jsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar  from './TopBar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <TopBar />
        <div className="page-wrapper">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
