// pages/MLModelsPage.jsx — Train, evaluate, compare ML models

import { useState, useEffect } from 'react'
import { mlAPI, datasetsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { ANIM } from '../motion'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Cpu, Play, BarChart2, Award, RefreshCw } from 'lucide-react'

const ALGORITHMS = [
  { value:'random_forest',       label:'Random Forest',          color:'#6366f1' },
  { value:'gradient_boosting',   label:'Gradient Boosting',      color:'#ec4899' },
  { value:'decision_tree',       label:'Decision Tree',          color:'#8b5cf6' },
  { value:'logistic_regression', label:'Logistic Regression',    color:'#06b6d4' },
  { value:'svm',                 label:'Support Vector Machine', color:'#10b981' },
  { value:'linear_regression',   label:'Linear Regression',      color:'#f59e0b' },
]

const METRICS_COLORS = { Accuracy:'#6366f1', Precision:'#8b5cf6', Recall:'#06b6d4', 'F1 Score':'#10b981' }

export default function MLModelsPage() {
  const [datasets,    setDatasets]    = useState([])
  const [comparison,  setComparison]  = useState([])
  const [history,     setHistory]     = useState([])
  const [training,    setTraining]    = useState(false)
  const [activeResult, setActiveResult] = useState(null)
  const [config, setConfig] = useState({
    dataset_id: '', algorithm: 'random_forest', task_type: 'classification',
    target_column: 'revenue_category', test_size: 0.2,
  })
  const [columns, setColumns] = useState([])

  useEffect(() => {
    datasetsAPI.list().then(r => setDatasets(r.data)).catch(() => {})
    mlAPI.compare().then(r => setComparison(r.data.comparison || [])).catch(() => {})
    mlAPI.history().then(r => setHistory(r.data || [])).catch(() => {})
  }, [])

  const handleSelectDS = (id) => {
    setConfig(c => ({ ...c, dataset_id: id }))
    const ds = datasets.find(d => String(d.id) === id)
    if (ds?.column_names) setColumns(ds.column_names)
  }

  const handleTrain = async () => {
    setTraining(true)
    setActiveResult(null)
    try {
      const payload = { ...config, dataset_id: config.dataset_id ? parseInt(config.dataset_id) : null }
      const { data } = await mlAPI.train(payload)
      setActiveResult(data)
      toast.success(config.task_type === 'classification'
        ? `${config.algorithm.replace(/_/g,' ')} trained: ${data.accuracy}% CV accuracy`
        : `${config.algorithm.replace(/_/g,' ')} trained: R² ${data.r2_score}`)
      mlAPI.compare().then(r => setComparison(r.data.comparison || [])).catch(() => {})
      mlAPI.history().then(r => setHistory(r.data || [])).catch(() => {})
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Training failed')
    } finally { setTraining(false) }
  }

  const [ranking, setRanking] = useState(null)
  const [comparing, setComparing] = useState(false)
  const handleCompareAll = async () => {
    setComparing(true)
    try {
      const { data } = await mlAPI.compareRun({
        dataset_id: config.dataset_id ? parseInt(config.dataset_id) : null,
        target_column: config.target_column, task_type: config.task_type,
      })
      setRanking(data)
      toast.success(`Compared ${data.results.length} algorithms`)
      mlAPI.compare().then(r => setComparison(r.data.comparison || [])).catch(() => {})
      mlAPI.history().then(r => setHistory(r.data || [])).catch(() => {})
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Comparison failed')
    } finally { setComparing(false) }
  }

  // Compare bar data
  const compareData = comparison.map(c => ({
    algo: c.algorithm.replace(' Machine','').replace(' Regression','').replace(' Forest',''),
    Accuracy: c.accuracy, Precision: c.precision, Recall: c.recall, 'F1 Score': c.f1_score,
  }))

  // Radar data for active result
  const radarData = activeResult ? [
    { metric:'Accuracy',  value: activeResult.accuracy },
    { metric:'Precision', value: activeResult.precision },
    { metric:'Recall',    value: activeResult.recall },
    { metric:'F1 Score',  value: activeResult.f1_score },
  ] : []

  // Feat importance
  const featImpData = activeResult?.feature_importance
    ? Object.entries(activeResult.feature_importance).slice(0,8).map(([k,v]) => ({ name:k, value:Math.round(v*100) }))
    : []

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Machine Learning Models</h1>
        <p>Train, cross-validate and compare 6 algorithms on the sample table or any uploaded CSV/Excel file</p>
      </div>

      {/* Config */}
      <div className="glass-card" style={{ padding:24, marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Cpu size={18} color="var(--accent-1)"/>
          <h3 style={{ fontSize:16, fontWeight:600 }}>Model Training Configuration</h3>
        </div>

        <div className="grid-3" style={{ gap:16, marginBottom:20 }}>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Dataset</label>
            <select className="form-select" value={config.dataset_id} onChange={e => handleSelectDS(e.target.value)}>
              <option value="">— Sample Dataset (default) —</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Algorithm</label>
            <select className="form-select" value={config.algorithm} onChange={e => setConfig(c => ({...c, algorithm: e.target.value}))}>
              {ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Task Type</label>
            <select className="form-select" value={config.task_type} onChange={e => setConfig(c => ({...c, task_type: e.target.value}))}>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Target Column</label>
            <input className="form-input" value={config.target_column}
              onChange={e => setConfig(c => ({...c, target_column: e.target.value}))}
              placeholder="e.g. revenue_category" />
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Test Size ({Math.round(config.test_size*100)}%)</label>
            <input type="range" min="0.1" max="0.4" step="0.05" value={config.test_size}
              onChange={e => setConfig(c => ({...c, test_size: parseFloat(e.target.value)}))}
              style={{ width:'100%', accentColor:'var(--accent-1)' }}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={handleTrain} disabled={training || comparing}>
            {training
              ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/> Training Model...</>
              : <><Play size={15}/> Train Model</>
            }
          </button>
          <button className="btn btn-secondary" onClick={handleCompareAll} disabled={training || comparing}>
            {comparing ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/> Comparing...</> : <><BarChart2 size={15}/> Compare all algorithms</>}
          </button>
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:12 }}>
          Every model runs inside one pipeline (imputation, one-hot encoding, scaling) with k-fold cross-validation.
          ID columns and columns that leak the target are dropped automatically.
        </p>
      </div>

      {ranking && (
        <div className="glass-card" style={{ padding:24, marginBottom:24 }}>
          <h3 style={{ fontSize:16, fontWeight:600, marginBottom:12 }}>Algorithm ranking (by {ranking.ranked_by === 'f1_score' ? 'cross-validated F1' : 'cross-validated R²'})</h3>
          <table className="data-table">
            <thead><tr><th>#</th><th>Algorithm</th>{ranking.task_type === 'classification'
              ? <><th>Accuracy (CV)</th><th>F1</th><th>Majority-class baseline</th></>
              : <><th>R² (CV)</th><th>MAE</th></>}</tr></thead>
            <tbody>
              {ranking.results.map((r, i) => (
                <tr key={r.algorithm}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight:600 }}>{r.algorithm.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</td>
                  {ranking.task_type === 'classification'
                    ? <><td>{r.accuracy}% <span style={{ color:'var(--text-muted)', fontSize:11 }}>± {r.accuracy_std}</span></td><td>{r.f1_score}%</td><td>{r.baseline_accuracy}%</td></>
                    : <><td>{r.r2_score} <span style={{ color:'var(--text-muted)', fontSize:11 }}>± {r.r2_std}</span></td><td>{r.mae}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
          {ranking.dropped_columns?.length > 0 && (
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:12 }}>
              Dropped before training: {ranking.dropped_columns.map(d => `${d.column} (${d.reason})`).join('; ')}
            </p>
          )}
        </div>
      )}

      {/* Active Result */}
      {activeResult && (
        <div className="glass-card" style={{ padding:24, marginBottom:24, border:'1px solid rgba(99,102,241,0.25)', animation:'fadeIn 0.4s' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Award size={18} color="#f59e0b"/>
              <h3 style={{ fontSize:16, fontWeight:600 }}>Training Results — {activeResult.algorithm?.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</h3>
            </div>
            <span className="badge badge-success">✓ Trained</span>
          </div>

          {/* Metric Cards */}
          <div className="grid-4" style={{ marginBottom:24 }}>
            {[
              { label:'Accuracy',  value:activeResult.accuracy,  color:'#6366f1' },
              { label:'Precision', value:activeResult.precision, color:'#8b5cf6' },
              { label:'Recall',    value:activeResult.recall,    color:'#06b6d4' },
              { label:'F1 Score',  value:activeResult.f1_score,  color:'#10b981' },
            ].map(m => (
              <div key={m.label} style={{ padding:20, background:'var(--bg-glass)', borderRadius:12, border:'1px solid var(--border-light)', textAlign:'center' }}>
                <div style={{ fontSize:32, fontWeight:800, color:m.color, fontFamily:'Space Grotesk' }}>{m.value?.toFixed(1)}%</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, fontWeight:600 }}>{m.label}</div>
                <div style={{ marginTop:10 }}>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width:`${m.value}%`, background:`linear-gradient(90deg, ${m.color}, ${m.color}99)` }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            {/* Radar */}
            <div>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Model Performance Radar</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-light)"/>
                  <PolarAngleAxis dataKey="metric" tick={{ fill:'var(--text-muted)', fontSize:12 }}/>
                  <Radar isAnimationActive={ANIM} dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Feature Importance */}
            {featImpData.length > 0 && (
              <div>
                <p style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Top Feature Importance</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={featImpData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
                    <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} width={100} axisLine={false}/>
                    <Tooltip contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, fontSize:13 }}/>
                    <Bar isAnimationActive={ANIM} dataKey="value" radius={[0,4,4,0]}>
                      {featImpData.map((_, i) => <Cell key={i} fill={`hsl(${245 + i*15}, 70%, 65%)`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Confusion Matrix */}
            {activeResult.confusion_matrix?.length > 0 && activeResult.confusion_matrix?.length <= 4 && (
              <div>
                <p style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Confusion Matrix</p>
                <div style={{ display:'inline-flex', flexDirection:'column', gap:4 }}>
                  {activeResult.confusion_matrix.map((row, i) => (
                    <div key={i} style={{ display:'flex', gap:4 }}>
                      {row.map((val, j) => {
                        const max = Math.max(...activeResult.confusion_matrix.flat())
                        const intensity = val/max
                        return (
                          <div key={j} style={{ width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, background:`rgba(99,102,241,${0.1 + intensity*0.7})`, fontSize:18, fontWeight:700, color: intensity > 0.5 ? 'white' : 'var(--text-primary)' }}>
                            {val}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop:16, fontSize:12, color:'var(--text-muted)', lineHeight:1.8 }}>
            Metrics are the mean of {activeResult.cv_folds}-fold cross-validation
            {activeResult.accuracy_std !== undefined && <> (accuracy ± {activeResult.accuracy_std})</>}
            {activeResult.baseline_accuracy !== undefined && <> · majority-class baseline {activeResult.baseline_accuracy}%</>}
            {' '}· Hold-out: {activeResult.testing_samples} rows · Features: {activeResult.features_used?.join(', ')}
            {activeResult.dropped_columns?.length > 0 && <><br/>Dropped (leakage / IDs): {activeResult.dropped_columns.map(d => `${d.column}: ${d.reason}`).join('; ')}</>}
          </div>
        </div>
      )}

      {/* Algorithm Comparison */}
      {compareData.length > 0 && (
        <div className="glass-card" style={{ padding:24, marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <BarChart2 size={18} color="var(--accent-3)"/>
            <h3 style={{ fontSize:16, fontWeight:600 }}>Algorithm Comparison</h3>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft:'auto' }} onClick={() => mlAPI.compare().then(r => setComparison(r.data.comparison || []))}>
              <RefreshCw size={13}/>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)"/>
              <XAxis dataKey="algo" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false}/>
              <YAxis domain={[0,100]} tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false}/>
              <Tooltip contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, fontSize:13 }} formatter={v => [`${v}%`,'']}/>
              {Object.keys(METRICS_COLORS).map(k => (
                <Bar isAnimationActive={ANIM} key={k} dataKey={k} fill={METRICS_COLORS[k]} radius={[4,4,0,0]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border-light)' }}>
            <h3 style={{ fontSize:15, fontWeight:600 }}>Training History</h3>
          </div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Algorithm</th><th>Task</th><th>Target</th><th>Accuracy</th><th>F1 Score</th><th>Date</th></tr></thead>
            <tbody>
              {history.slice(0,10).map(h => (
                <tr key={h.id}>
                  <td style={{ color:'var(--text-muted)' }}>{h.id}</td>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{h.algorithm?.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</td>
                  <td><span className={`badge ${h.task_type==='classification'?'badge-primary':'badge-info'}`}>{h.task_type}</span></td>
                  <td style={{ color:'var(--text-muted)' }}>{h.target_column}</td>
                  <td><span style={{ color:'#10b981', fontWeight:700 }}>{h.accuracy?.toFixed(1)}%</span></td>
                  <td><span style={{ color:'#6366f1', fontWeight:700 }}>{h.f1_score?.toFixed(1)}%</span></td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(h.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
