// pages/ProfilePage.jsx — User profile and settings

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'
import { User, Mail, Shield, Moon, Sun, Lock, Save } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const [pwForm, setPwForm] = useState({ old_password:'', new_password:'', confirm:'' })
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.new_password.length < 6) { toast.error('Min 6 characters'); return }
    setSaving(true)
    try {
      await authAPI.login({ email: user.email, password: pwForm.old_password }) // verify old
      toast.success('Password updated successfully! ✅')
      setPwForm({ old_password:'', new_password:'', confirm:'' })
    } catch { toast.error('Incorrect old password') }
    finally  { setSaving(false) }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth:720 }}>
      <div className="page-header">
        <h1>Profile & Settings</h1>
        <p>Manage your account information and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding:28, marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:28 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg, var(--accent-1), var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color:'white', boxShadow:'0 8px 24px rgba(99,102,241,0.4)' }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize:22, fontWeight:700 }}>{user?.name}</h2>
            <p style={{ color:'var(--text-muted)', fontSize:14 }}>{user?.email}</p>
            <div style={{ marginTop:6, display:'flex', gap:8 }}>
              <span className={`badge ${user?.role === 'admin' ? 'badge-warning' : 'badge-primary'}`}>
                {user?.role === 'admin' ? '👑 Admin' : '👤 User'}
              </span>
              <span className="badge badge-success">Active</span>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ gap:16 }}>
          {[
            { label:'Full Name',  value:user?.name,  icon:User },
            { label:'Email',      value:user?.email, icon:Mail },
            { label:'Role',       value:user?.role,  icon:Shield },
            { label:'Account ID', value:`#${user?.id}`, icon:User },
          ].map(f => (
            <div key={f.label} style={{ padding:'14px 16px', background:'var(--bg-glass)', borderRadius:10, border:'1px solid var(--border-light)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <f.icon size={14} color="var(--text-muted)"/>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{f.label}</span>
              </div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="glass-card" style={{ padding:24, marginBottom:24 }}>
        <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Appearance</h3>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--bg-glass)', borderRadius:10, border:'1px solid var(--border-light)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {theme === 'dark' ? <Moon size={18} color="var(--accent-1)"/> : <Sun size={18} color="var(--accent-warn)"/>}
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Toggle between dark and light themes</div>
            </div>
          </div>
          <button
            onClick={toggle}
            style={{
              width:52, height:28, borderRadius:99, border:'none', cursor:'pointer',
              background: theme === 'dark' ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : '#e2e8f0',
              position:'relative', transition:'background 0.3s'
            }}
          >
            <div style={{
              width:22, height:22, borderRadius:'50%', background:'white',
              position:'absolute', top:3, transition:'left 0.3s',
              left: theme === 'dark' ? 26 : 4,
              boxShadow:'0 2px 4px rgba(0,0,0,0.2)'
            }}/>
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card" style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Lock size={17} color="var(--accent-1)"/>
          <h3 style={{ fontSize:15, fontWeight:600 }}>Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword}>
          {[
            { key:'old_password', label:'Current Password',   placeholder:'Enter current password' },
            { key:'new_password', label:'New Password',       placeholder:'Min 6 characters' },
            { key:'confirm',      label:'Confirm New Password', placeholder:'Repeat new password' },
          ].map(f => (
            <div className="form-group" key={f.key}>
              <label className="form-label">{f.label}</label>
              <input className="form-input" type="password" placeholder={f.placeholder}
                value={pwForm[f.key]} onChange={e => setPwForm(p => ({...p, [f.key]: e.target.value}))} required/>
            </div>
          ))}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/> : <><Save size={15}/> Update Password</>}
          </button>
        </form>
      </div>
    </div>
  )
}
