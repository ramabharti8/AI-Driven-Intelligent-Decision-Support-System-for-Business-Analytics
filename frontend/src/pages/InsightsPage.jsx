// pages/InsightsPage.jsx — AI Insights + Chatbot

import { useState, useEffect, useRef } from 'react'
import { insightsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Lightbulb, Send, Bot, User, RefreshCw, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

const severityStyle = (s) => ({
  positive: { bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)', icon:'#34d399' },
  warning:  { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', icon:'#fbbf24' },
  danger:   { bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)',  icon:'#f87171' },
}[s] || { bg:'var(--bg-glass)', border:'var(--border)', icon:'#818cf8' })

export default function InsightsPage() {
  const [insights, setInsights] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [messages, setMessages] = useState([
    { role:'assistant', text:"👋 Hello! I answer from the real data: revenue, churn, segments, forecast, products, countries or recommendations." }
  ])
  const [input,    setInput]    = useState('')
  const [chatLoad, setChatLoad] = useState(false)
  const chatEndRef = useRef()

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const { data } = await insightsAPI.list()
      setInsights(data.insights || [])
    } catch { toast.error('Failed to load insights') }
    finally   { setLoading(false) }
  }

  useEffect(() => { fetchInsights() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const sendMessage = async () => {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    setMessages(m => [...m, { role:'user', text:msg }])
    setChatLoad(true)
    try {
      const { data } = await insightsAPI.chat(msg)
      setMessages(m => [...m, { role:'assistant', text:data.response }])
    } catch {
      setMessages(m => [...m, { role:'assistant', text:"Sorry, I couldn't process that. Please try again." }])
    } finally { setChatLoad(false) }
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const QUICK_PROMPTS = ['📊 Revenue analysis', '👥 Customer insights', '🤖 Model accuracy', '⚠️ Churn risk', '💡 Recommendations']

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>AI Insights</h1>
        <p>Intelligent business recommendations and AI assistant</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:24, alignItems:'start' }}>
        {/* Insights Grid */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Lightbulb size={18} color="var(--accent-warn)"/>
              <h3 style={{ fontSize:16, fontWeight:600 }}>AI-Generated Insights</h3>
              <span className="badge badge-warning">{insights.length}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchInsights}><RefreshCw size={13}/> Refresh</button>
          </div>

          {loading ? (
            <div className="loading-overlay"><div className="spinner"/></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {insights.map(ins => {
                const st = severityStyle(ins.severity)
                return (
                  <div key={ins.id} className="animate-fade-in" style={{ padding:20, borderRadius:14, background:st.bg, border:`1px solid ${st.border}`, transition:'var(--transition)', cursor:'default' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <h4 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                            {ins.title}
                          </h4>
                        </div>
                        <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>{ins.description}</p>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                        <span className={`badge ${ins.severity==='positive'?'badge-success':ins.severity==='danger'?'badge-danger':'badge-warning'}`}>
                          {ins.severity==='positive'?'Opportunity':ins.severity==='danger'?'Act now':'Watch'}
                        </span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', maxWidth:180, textAlign:'right' }} title="Where this number comes from">Source: {ins.source}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{ins.category?.replace(/_/g,' ')}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Chatbot */}
        <div className="glass-card" style={{ display:'flex', flexDirection:'column', height:620, position:'sticky', top: 80 }}>
          {/* Header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, var(--accent-1), var(--accent-2))', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Bot size={18} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>AI Business Assistant</div>
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }}/>
                Online · Rule-based AI
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection: msg.role==='user' ? 'row-reverse' : 'row' }}>
                <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  background: msg.role==='user' ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(99,102,241,0.15)' }}>
                  {msg.role === 'user' ? <User size={14} color="white"/> : <Bot size={14} color="var(--accent-1)"/>}
                </div>
                <div style={{
                  maxWidth:'80%',
                  padding:'10px 14px',
                  borderRadius: msg.role==='user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role==='user' ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'var(--bg-glass)',
                  border: msg.role==='user' ? 'none' : '1px solid var(--border-light)',
                  fontSize: 13,
                  color: msg.role==='user' ? 'white' : 'var(--text-primary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoad && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Bot size={14} color="var(--accent-1)"/>
                </div>
                <div style={{ display:'flex', gap:4, padding:'10px 14px', background:'var(--bg-glass)', borderRadius:'4px 14px 14px 14px', border:'1px solid var(--border-light)' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-1)', animation:`bounce 1s ${i*0.15}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Quick Prompts */}
          <div style={{ padding:'8px 20px', display:'flex', gap:6, flexWrap:'wrap', borderTop:'1px solid var(--border-light)' }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => { setInput(p.split(' ').slice(1).join(' ')); }} className="btn btn-secondary" style={{ padding:'3px 10px', fontSize:11, borderRadius:99 }}>
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border-light)', display:'flex', gap:8 }}>
            <textarea
              className="form-input"
              style={{ flex:1, resize:'none', height:42, lineHeight:1.5, paddingTop:10 }}
              placeholder="Ask about revenue, customers, ML models..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={chatLoad || !input.trim()} style={{ height:42, paddingLeft:14, paddingRight:14 }}>
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
