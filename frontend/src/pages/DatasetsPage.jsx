// pages/DatasetsPage.jsx — Drag-and-drop dataset upload & management

import { useState, useEffect, useRef } from 'react'
import { datasetsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Upload, Trash2, Eye, Database, FileSpreadsheet, X, ChevronDown, ChevronUp } from 'lucide-react'

export default function DatasetsPage() {
  const [datasets,  setDatasets]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [preview,   setPreview]   = useState(null)
  const [prevLoad,  setPrevLoad]  = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const fileRef = useRef()

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      const { data } = await datasetsAPI.list()
      setDatasets(data)
    } catch { toast.error('Failed to load datasets') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchDatasets() }, [])

  const handleUpload = async (file) => {
    if (!file) return
    if (!['.csv','.xlsx','.xls'].some(ext => file.name.endsWith(ext))) {
      toast.error('Only CSV or Excel files allowed')
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name.replace(/\.[^.]+$/, ''))
    try {
      await datasetsAPI.upload(formData)
      toast.success('Dataset uploaded successfully! ✅')
      fetchDatasets()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleUpload(e.dataTransfer.files[0])
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset?')) return
    try {
      await datasetsAPI.delete(id)
      toast.success('Dataset deleted')
      setDatasets(d => d.filter(x => x.id !== id))
      if (preview?.id === id) setPreview(null)
    } catch { toast.error('Delete failed') }
  }

  const handlePreview = async (id) => {
    if (expandedId === id) { setExpandedId(null); setPreview(null); return }
    setExpandedId(id)
    setPrevLoad(true)
    try {
      const { data } = await datasetsAPI.preview(id, 10)
      setPreview({ id, ...data })
    } catch { toast.error('Preview failed') }
    finally { setPrevLoad(false) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Dataset Manager</h1>
        <p>Upload, preview and manage your business datasets</p>
      </div>

      {/* Upload Zone */}
      <div
        className={`glass-card ${dragOver ? 'animate-pulse-glow' : ''}`}
        style={{
          padding: 40, textAlign:'center', marginBottom:28,
          border: `2px dashed ${dragOver ? 'var(--accent-1)' : 'var(--border)'}`,
          background: dragOver ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)',
          cursor:'pointer', transition:'var(--transition)'
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => handleUpload(e.target.files[0])} />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {uploading
              ? <span className="spinner"/>
              : <Upload size={28} color="var(--accent-1)"/>
            }
          </div>
          <div>
            <p style={{ fontWeight:600, fontSize:16, color:'var(--text-primary)', marginBottom:4 }}>
              {uploading ? 'Uploading...' : dragOver ? 'Drop your file here' : 'Drag & drop your dataset'}
            </p>
            <p style={{ color:'var(--text-muted)', fontSize:14 }}>Supports CSV, Excel (.xlsx, .xls) · Max 50MB</p>
          </div>
          {!uploading && <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); fileRef.current.click() }}>Browse File</button>}
        </div>
      </div>

      {/* Datasets Table */}
      <div className="glass-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Database size={18} color="var(--accent-1)"/>
            <h3 style={{ fontSize:16, fontWeight:600 }}>Your Datasets</h3>
            <span className="badge badge-primary">{datasets.length}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchDatasets}><span style={{ fontSize:13 }}>↻ Refresh</span></button>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner"/></div>
        ) : datasets.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={48}/>
            <h3>No Datasets Yet</h3>
            <p>Upload a CSV or Excel file to get started with analysis</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Rows</th><th>Columns</th><th>Size</th><th>Uploaded</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(ds => (
                <>
                  <tr key={ds.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <FileSpreadsheet size={16} color="var(--accent-3)"/>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{ds.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{ds.filename}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{ds.rows?.toLocaleString()}</span></td>
                    <td><span className="badge badge-primary">{ds.columns}</span></td>
                    <td style={{ color:'var(--text-muted)', fontSize:13 }}>{ds.size_kb?.toFixed(1)} KB</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(ds.uploaded_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handlePreview(ds.id)}>
                          <Eye size={13}/>
                          {expandedId === ds.id ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ds.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Preview Row */}
                  {expandedId === ds.id && (
                    <tr key={`prev-${ds.id}`}>
                      <td colSpan={6} style={{ padding:0 }}>
                        <div style={{ background:'var(--bg-primary)', padding:20, borderTop:'1px solid var(--border-light)' }}>
                          {prevLoad ? (
                            <div className="loading-overlay" style={{ minHeight:80 }}><div className="spinner"/></div>
                          ) : preview ? (
                            <>
                              {/* Column Stats */}
                              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                                {Object.entries(preview.column_stats || {}).slice(0,8).map(([col, stats]) => (
                                  <div key={col} style={{ background:'var(--bg-glass)', border:'1px solid var(--border-light)', borderRadius:8, padding:'6px 12px', fontSize:12 }}>
                                    <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{col}</div>
                                    <div style={{ color:'var(--text-muted)' }}>{stats.dtype} · {stats.missing} null</div>
                                  </div>
                                ))}
                              </div>
                              {/* Data Table */}
                              <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid var(--border-light)' }}>
                                <table className="data-table" style={{ fontSize:12 }}>
                                  <thead>
                                    <tr>{preview.columns?.map(c => <th key={c}>{c}</th>)}</tr>
                                  </thead>
                                  <tbody>
                                    {preview.rows?.map((row, i) => (
                                      <tr key={i}>
                                        {preview.columns?.map(c => (
                                          <td key={c} style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            {String(row[c] ?? '')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:8 }}>
                                Showing 10 of {preview.total_rows} rows · {preview.total_columns} columns
                              </p>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
