// pages/RegisterPage.jsx

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, Mail, Lock, User, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    const res = await register(form.name, form.email, form.password)
    if (res.success) {
      toast.success('Account created successfully! 🎉')
      navigate('/dashboard')
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="auth-page">
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.12), transparent)', top:-100, right:-100 }} />
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.08), transparent)', bottom:-150, left:-150 }} />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon animate-float">
            <Zap size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontFamily:'Space Grotesk', fontSize:20, fontWeight:700 }} className="gradient-text">AI Decision Support</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>Business Analytics Platform</p>
          </div>
        </div>

        <h2 style={{ fontSize:24, fontWeight:700, marginBottom:6 }}>Create Account</h2>
        <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:28 }}>
          Join the AI-powered analytics platform
        </p>

        <form onSubmit={handleSubmit}>
          {[
            { key:'name',     label:'Full Name',     type:'text',     Icon:User,  placeholder:'John Doe' },
            { key:'email',    label:'Email Address', type:'email',    Icon:Mail,  placeholder:'you@example.com' },
            { key:'password', label:'Password',      type:'password', Icon:Lock,  placeholder:'Min 6 characters' },
            { key:'confirm',  label:'Confirm Password', type:'password', Icon:Lock, placeholder:'Repeat password' },
          ].map(({ key, label, type, Icon, placeholder }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <div style={{ position:'relative' }}>
                <Icon size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft:42, paddingRight: (key==='password'||key==='confirm') ? 44 : 16 }}
                  type={(key==='password'||key==='confirm') ? (show?'text':'password') : type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                />
                {(key==='confirm') && (
                  <button type="button" onClick={() => setShow(s=>!s)}
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                    {show ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontSize:13, color:'#f87171', marginBottom:16 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:46 }} disabled={loading} type="submit">
            {loading ? <span className="spinner" style={{ width:18, height:18, borderWidth:2 }}/> : <>Create Account <ArrowRight size={16}/></>}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'var(--accent-1)', fontWeight:600, textDecoration:'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
