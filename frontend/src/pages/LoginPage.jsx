// pages/LoginPage.jsx — Glassmorphism login with animations

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, Mail, Lock, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [show, setShow]   = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const res = await login(form.email, form.password)
    if (res.success) {
      toast.success(`Welcome back, ${res.user.name}! 👋`)
      navigate('/dashboard')
    } else {
      setError(res.message)
      toast.error(res.message)
    }
  }

  const fillDemo = (role) => {
    if (role === 'admin') setForm({ email: 'admin@demo.com', password: 'admin123' })
    else                  setForm({ email: 'user@demo.com',  password: 'user123'  })
  }

  return (
    <div className="auth-page">
      {/* Background orbs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.12), transparent)', top:-100, left:-100 }} />
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.08), transparent)', bottom:-150, right:-150 }} />
        <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(6,182,212,0.06), transparent)', top:'40%', right:'20%' }} />
      </div>

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon animate-float">
            <Zap size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontFamily:'Space Grotesk', fontSize:20, fontWeight:700 }} className="gradient-text">
              AI Decision Support
            </h1>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>Business Analytics Platform</p>
          </div>
        </div>

        <h2 style={{ fontSize:24, fontWeight:700, marginBottom:6 }}>Welcome back</h2>
        <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:28 }}>
          Sign in to your analytics dashboard
        </p>

        {/* Demo credentials */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => fillDemo('admin')}>
            👑 Admin Demo
          </button>
          <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => fillDemo('user')}>
            👤 User Demo
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position:'relative' }}>
              <Mail size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft:42 }}
                type="email"
                placeholder="admin@demo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position:'relative' }}>
              <Lock size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft:42, paddingRight:44 }}
                type={show ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShow(s => !s)}
                style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontSize:13, color:'#f87171', marginBottom:16 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:46 }} disabled={loading} type="submit">
            {loading ? <span className="spinner" style={{ width:18, height:18, borderWidth:2 }} /> : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color:'var(--accent-1)', fontWeight:600, textDecoration:'none' }}>
            Create account
          </Link>
        </div>

        {/* Credential hint */}
        <div style={{ marginTop:20, padding:'12px 14px', background:'rgba(6,182,212,0.06)', border:'1px solid rgba(6,182,212,0.15)', borderRadius:10, fontSize:12, color:'var(--text-muted)' }}>
          <strong style={{ color:'var(--accent-3)' }}>Demo credentials:</strong><br/>
          Admin: admin@demo.com / admin123<br/>
          User: user@demo.com / user123
        </div>
      </div>
    </div>
  )
}
