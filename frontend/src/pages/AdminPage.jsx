// pages/AdminPage.jsx — Admin panel

import { useState, useEffect } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Shield, Users, Database, Activity, Cpu, RefreshCw, UserCheck, UserX, Trash2 } from 'lucide-react'

export default function AdminPage() {
  const [stats,   setStats]   = useState(null)
  const [users,   setUsers]   = useState([])
  const [logs,    setLogs]    = useState([])
  const [tab,     setTab]     = useState('overview')
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, u, l] = await Promise.all([adminAPI.stats(), adminAPI.users(), adminAPI.logs(30)])
      setStats(s.data); setUsers(u.data); setLogs(l.data)
    } catch { toast.error('Failed to load admin data') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const toggleUser = async (id, active) => {
    try {
      await adminAPI.updateUser(id, { is_active: !active })
      toast.success('User updated')
      setUsers(u => u.map(x => x.id === id ? {...x, is_active: !active} : x))
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed') }
  }

  const changeRole = async (id, role) => {
    try {
      await adminAPI.updateUser(id, { role })
      toast.success('Role updated')
      setUsers(u => u.map(x => x.id === id ? {...x, role} : x))
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed') }
  }

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return
    try {
      await adminAPI.deleteUser(id)
      toast.success('User deleted')
      setUsers(u => u.filter(x => x.id !== id))
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed') }
  }

  const TABS = [
    { key:'overview', label:'Overview',    icon: Shield },
    { key:'users',    label:'Users',       icon: Users },
    { key:'logs',     label:'System Logs', icon: Activity },
  ]

  const actionColor = (a) => {
    if (a.includes('login'))  return '#10b981'
    if (a.includes('delete')) return '#ef4444'
    if (a.includes('train'))  return '#8b5cf6'
    if (a.includes('upload')) return '#06b6d4'
    return '#6366f1'
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Shield size={24} color="var(--accent-1)"/> Admin Panel
          </h1>
          <p>System management, user administration and activity monitoring</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={14}/> Refresh</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab===t.key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"/></div>
      ) : (
        <>
          {tab === 'overview' && stats && (
            <div>
              <div className="grid-3" style={{ marginBottom:24 }}>
                {[
                  { label:'Total Users',      value:stats.total_users,       icon:Users,    color:'#6366f1' },
                  { label:'Active Users',      value:stats.active_users,      icon:UserCheck, color:'#10b981' },
                  { label:'Total Datasets',    value:stats.total_datasets,    icon:Database,  color:'#06b6d4' },
                  { label:'Total Predictions', value:stats.total_predictions, icon:Cpu,       color:'#8b5cf6' },
                  { label:'Reports Generated', value:stats.total_reports,     icon:Activity,  color:'#f59e0b' },
                  { label:'Activity Logs',     value:stats.total_logs,        icon:Activity,  color:'#ef4444' },
                ].map(s => (
                  <div key={s.label} className="glass-card" style={{ padding:24, display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ width:48, height:48, borderRadius:12, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <s.icon size={22} color={s.color}/>
                    </div>
                    <div>
                      <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:'Space Grotesk' }}>{s.value}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass-card" style={{ overflow:'hidden' }}>
                <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize:15, fontWeight:600 }}>Recent Activity</h3>
                </div>
                <table className="data-table">
                  <thead><tr><th>Action</th><th>User</th><th>Details</th><th>Time</th></tr></thead>
                  <tbody>
                    {logs.slice(0,8).map(l => (
                      <tr key={l.id}>
                        <td><span style={{ fontSize:12, fontWeight:600, color:actionColor(l.action.toLowerCase()) }}>● {l.action}</span></td>
                        <td style={{ fontWeight:600 }}>{l.user}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{l.details}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(l.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="glass-card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border-light)' }}>
                <h3 style={{ fontSize:15, fontWeight:600 }}>User Management <span className="badge badge-primary" style={{ marginLeft:8 }}>{users.length}</span></h3>
              </div>
              <table className="data-table">
                <thead><tr><th>User</th><th>Role</th><th>Datasets</th><th>Models</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,var(--accent-1),var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:'white' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{u.name}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                          style={{ background:'var(--bg-glass)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', fontSize:12, color:'var(--text-primary)', cursor:'pointer' }}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>{u.datasets_count}</td>
                      <td>{u.predictions_count}</td>
                      <td><span className={`badge ${u.is_active?'badge-success':'badge-danger'}`}>{u.is_active?'Active':'Disabled'}</span></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className={`btn btn-sm ${u.is_active?'btn-secondary':'btn-success'}`} onClick={() => toggleUser(u.id, u.is_active)}>
                            {u.is_active ? <UserX size={13}/> : <UserCheck size={13}/>}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'logs' && (
            <div className="glass-card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border-light)' }}>
                <h3 style={{ fontSize:15, fontWeight:600 }}>System Activity Logs</h3>
              </div>
              <table className="data-table">
                <thead><tr><th>#</th><th>Action</th><th>User</th><th>Details</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td style={{ color:'var(--text-muted)', fontSize:12 }}>{l.id}</td>
                      <td><span style={{ fontSize:12, fontWeight:600, color:actionColor(l.action.toLowerCase()) }}>● {l.action}</span></td>
                      <td style={{ fontWeight:600, fontSize:13 }}>{l.user}</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{l.details}</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(l.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
