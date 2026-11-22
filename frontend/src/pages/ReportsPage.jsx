// pages/ReportsPage.jsx — Generate & download PDF/Excel reports

import { useState, useEffect } from 'react'
import { reportsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FileText, Download, Trash2, Plus, FileSpreadsheet, RefreshCw } from 'lucide-react'

export default function ReportsPage() {
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({ title:'Business Analytics Report', report_type:'pdf', include_kpis:true, include_ml:true })

  const fetchReports = async () => {
    setLoading(true)
    try { const { data } = await reportsAPI.list(); setReports(data) }
    catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data } = await reportsAPI.generate(form)
      toast.success(`${form.report_type.toUpperCase()} report generated! 📄`)
      fetchReports()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Generation failed')
    } finally { setGenerating(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return
    try {
      await reportsAPI.delete(id)
      toast.success('Report deleted')
      setReports(r => r.filter(x => x.id !== id))
    } catch { toast.error('Delete failed') }
  }

  // The download endpoint needs the auth token, so fetch it as a blob instead of a plain link.
  const handleDownload = async (id, title, type) => {
    try {
      const res = await reportsAPI.downloadBlob(id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Downloaded ${type.toUpperCase()} report`)
    } catch { toast.error('Download failed') }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Report Generator</h1>
        <p>Generate downloadable PDF and Excel business analytics reports</p>
      </div>

      <div className="grid-2" style={{ alignItems:'start', gap:24 }}>
        {/* Generator */}
        <div className="glass-card" style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <Plus size={18} color="var(--accent-1)"/>
            <h3 style={{ fontSize:16, fontWeight:600 }}>Generate New Report</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Report Title</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} placeholder="Enter report title"/>
          </div>

          <div className="form-group">
            <label className="form-label">Format</label>
            <div style={{ display:'flex', gap:12 }}>
              {['pdf','excel'].map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({...f, report_type:t}))}
                  style={{
                    flex:1, padding:'12px 16px', borderRadius:10, border:`2px solid ${form.report_type===t ? 'var(--accent-1)' : 'var(--border-light)'}`,
                    background: form.report_type===t ? 'rgba(99,102,241,0.12)' : 'var(--bg-glass)',
                    color: form.report_type===t ? '#818cf8' : 'var(--text-secondary)',
                    cursor:'pointer', transition:'var(--transition)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontWeight:600, fontSize:14
                  }}
                >
                  {t === 'pdf' ? <FileText size={16}/> : <FileSpreadsheet size={16}/>}
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:18 }}>
            <label className="form-label">Include Sections</label>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'include_kpis', label:'📊 KPI Dashboard & Business Metrics' },
                { key:'include_ml',   label:'🤖 Machine Learning Model Results' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:14, color:'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({...f, [key]:e.target.checked}))} style={{ accentColor:'var(--accent-1)', width:16, height:16 }}/>
                  {label}
                </label>
              ))}
              {/* Always included */}
              {['📈 Sales & Revenue Analysis','💡 AI Business Insights','⚠️ Risk Assessment'].map(s => (
                <label key={s} style={{ display:'flex', alignItems:'center', gap:10, cursor:'default', fontSize:14, color:'var(--text-muted)' }}>
                  <input type="checkbox" checked disabled style={{ accentColor:'var(--accent-1)', width:16, height:16 }}/>
                  {s} <span style={{ fontSize:11, marginLeft:4 }}>(always included)</span>
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleGenerate} disabled={generating}>
            {generating
              ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/> Generating...</>
              : <><FileText size={15}/> Generate {form.report_type.toUpperCase()} Report</>
            }
          </button>

          {/* Info box */}
          <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(6,182,212,0.06)', border:'1px solid rgba(6,182,212,0.15)', borderRadius:10, fontSize:12, color:'var(--text-muted)' }}>
            <strong style={{ color:'var(--accent-3)' }}>What's included:</strong>
            <ul style={{ marginTop:6, paddingLeft:16, lineHeight:2 }}>
              <li>KPI cards with all business metrics</li>
              <li>ML model accuracy & comparison</li>
              <li>Revenue & sales trend analysis</li>
              <li>AI-generated business recommendations</li>
              <li>Risk assessment overview</li>
            </ul>
          </div>
        </div>

        {/* Reports List */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <FileText size={17} color="var(--accent-1)"/>
              <h3 style={{ fontSize:16, fontWeight:600 }}>Generated Reports</h3>
              <span className="badge badge-primary">{reports.length}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchReports}><RefreshCw size={13}/></button>
          </div>

          {loading ? (
            <div className="loading-overlay"><div className="spinner"/></div>
          ) : reports.length === 0 ? (
            <div className="empty-state glass-card">
              <FileText size={40}/>
              <h3>No Reports Yet</h3>
              <p>Generate your first report using the form on the left</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {reports.map(r => (
                <div key={r.id} className="glass-card" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background: r.report_type==='pdf' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {r.report_type === 'pdf' ? <FileText size={20} color="#f87171"/> : <FileSpreadsheet size={20} color="#34d399"/>}
                  </div>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                      {r.report_type.toUpperCase()} · {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleDownload(r.id, r.title, r.report_type)}>
                      <Download size={13}/>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
