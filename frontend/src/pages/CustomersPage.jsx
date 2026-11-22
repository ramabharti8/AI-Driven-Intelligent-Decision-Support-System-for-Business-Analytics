// pages/CustomersPage.jsx — Segments, churn model, at-risk list and retention what-if

import { useEffect, useState } from 'react'
import { decisionsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { ANIM } from '../motion'
import {
  PieChart, Pie, Cell, BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { Users, ShieldAlert, Target, Calculator } from 'lucide-react'
import { gbp, tooltipStyle } from './Dashboard'

const SEG_COLORS = {
  'Champions': '#10b981', 'Loyal': '#6366f1', 'Promising': '#06b6d4', 'New / Occasional': '#0ea5e9',
  'At Risk (high value)': '#f59e0b', "Can't Lose Them": '#f97316', 'Hibernating': '#94a3b8', 'Lost': '#ef4444',
}
const color = (s) => SEG_COLORS[s] || '#8b5cf6'
const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }
const pct = (v) => `${(v * 100).toFixed(0)}%`

export default function CustomersPage() {
  const [seg, setSeg] = useState(null)
  const [churn, setChurn] = useState(null)
  const [risk, setRisk] = useState([])
  const [plan, setPlan] = useState(null)
  const [inputs, setInputs] = useState({ contact_cost: 5, save_rate: 0.2 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([decisionsAPI.segments(), decisionsAPI.churn(), decisionsAPI.atRisk(15)])
      .then(([s, c, r]) => { setSeg(s.data); setChurn(c.data); setRisk(r.data.customers) })
      .catch(e => toast.error(e.response?.data?.detail || 'Failed to load customer intelligence'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      decisionsAPI.retentionPlan(inputs).then(r => setPlan(r.data)).catch(() => toast.error('Could not run the what-if'))
    }, 300)
    return () => clearTimeout(t)
  }, [inputs])

  if (loading || !seg || !churn) return (
    <div className="loading-overlay" style={{ minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
      <div className="spinner" style={{ width: 48, height: 48 }} />
      <p style={{ color: 'var(--text-muted)' }}>Segmenting customers and scoring churn risk…</p>
    </div>
  )

  const pieData = seg.segments.map(s => ({ name: s.segment, value: s.revenue }))
  const impData = churn.feature_importance.slice(0, 8).map(f => ({ name: f.label, value: +(f.importance * 100).toFixed(2) }))
  const bySeg = {}
  seg.points.forEach(p => { (bySeg[p.segment] = bySeg[p.segment] || []).push({ x: p.recency, y: p.monetary, z: p.frequency }) })
  const cm = churn.holdout.confusion_matrix

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Customer Intelligence</h1>
        <p>Who your customers are, who is likely to leave, and how much a retention campaign is worth</p>
      </div>

      {/* Segments */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Users size={18} color="var(--accent-1)" />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>RFM segmentation</h3>
          <span className="badge badge-primary">K-Means, k={seg.k}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Recency, Frequency and Monetary value per customer, log-scaled, clustered with K-Means. k chosen by silhouette score:{' '}
          {Object.entries(seg.silhouette_by_k).map(([k, v]) => `k=${k}: ${v}`).join(' · ')}
        </p>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie isAnimationActive={ANIM} data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {pieData.map(p => <Cell key={p.name} fill={color(p.name)} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [gbp(v), 'Lifetime revenue']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis type="number" dataKey="x" name="Days since last order" tick={axisTick} axisLine={false} />
              <YAxis type="number" dataKey="y" name="Spend" scale="log" domain={['auto', 'auto']} tick={axisTick} axisLine={false} tickFormatter={gbp} />
              <ZAxis type="number" dataKey="z" range={[15, 120]} name="Orders" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === 'Spend' ? gbp(v) : v, n]} />
              {Object.entries(bySeg).map(([s, pts]) => <Scatter isAnimationActive={ANIM} key={s} name={s} data={pts} fill={color(s)} fillOpacity={0.6} />)}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <table className="data-table">
          <thead><tr><th>Segment</th><th>Customers</th><th>Revenue share</th><th>Avg days since order</th><th>Avg orders</th><th>Avg spend</th><th>Recommended action</th></tr></thead>
          <tbody>
            {seg.segments.map(s => (
              <tr key={s.segment}>
                <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color(s.segment), marginRight: 8 }} /><strong>{s.segment}</strong></td>
                <td>{s.customers.toLocaleString()} ({s.customer_share}%)</td>
                <td><strong>{s.revenue_share}%</strong></td>
                <td>{s.avg_recency_days}</td>
                <td>{s.avg_orders}</td>
                <td>{gbp(s.avg_spend)}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320 }}>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Churn model */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ShieldAlert size={18} color="#f59e0b" />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Churn prediction model</h3>
          <span className="badge badge-warning">{churn.churn_rate}% churn rate</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{churn.definition} Features use only data before that date, so the model never sees the future. {churn.training_customers.toLocaleString()} customers.</p>
        <div className="grid-2">
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Model comparison (5-fold stratified cross-validation)</p>
            <table className="data-table">
              <thead><tr><th>Model</th><th>ROC-AUC</th><th>PR-AUC</th><th>Precision</th><th>Recall</th></tr></thead>
              <tbody>
                {churn.comparison.map(c => (
                  <tr key={c.algorithm} style={c.algorithm === churn.model_used ? { background: 'rgba(99,102,241,0.08)' } : {}}>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.algorithm.replace(/_/g, ' ')}{c.algorithm === churn.model_used ? ' ✓' : ''}</td>
                    <td>{c.roc_auc} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>± {c.roc_auc_std}</span></td>
                    <td>{c.pr_auc}</td><td>{pct(c.precision)}</td><td>{pct(c.recall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '18px 0 10px' }}>Hold-out test ({churn.holdout.test_customers} unseen customers)</p>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 64px 64px', gap: 4, fontSize: 12, alignItems: 'center' }}>
                <span /><span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Pred stay</span><span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Pred churn</span>
                {[['Stayed', cm[0]], ['Churned', cm[1]]].map(([lab, row], i) => [
                  <span key={lab} style={{ color: 'var(--text-muted)' }}>{lab}</span>,
                  ...row.map((v, j) => (
                    <div key={`${i}${j}`} style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontWeight: 700, fontSize: 16,
                      background: i === j ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.18)' }}>{v}</div>
                  )),
                ])}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                ROC-AUC <strong>{churn.holdout.roc_auc}</strong><br />
                Precision <strong>{pct(churn.holdout.precision)}</strong> · Recall <strong>{pct(churn.holdout.recall)}</strong><br />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Catches {pct(churn.holdout.recall)} of real churners; {pct(churn.holdout.precision)} of flagged customers really churn.</span>
              </div>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>What drives churn (permutation importance, drop in ROC-AUC ×100)</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={impData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis type="number" tick={axisTick} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} width={160} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar isAnimationActive={ANIM} dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Importance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Retention what-if */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(16,185,129,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Calculator size={18} color="#10b981" />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Retention campaign what-if</h3>
          <span className="badge badge-success">Decision support</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Contact customers in order of expected loss (churn probability × their quarterly spend). Set your own campaign assumptions; the system finds how many to contact for the highest net gain.
        </p>
        <div className="grid-3" style={{ marginBottom: 18 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="cc">Cost per customer contacted: £{inputs.contact_cost}</label>
            <input id="cc" type="range" min="1" max="50" step="1" value={inputs.contact_cost}
              onChange={e => setInputs(i => ({ ...i, contact_cost: +e.target.value }))} style={{ width: '100%', accentColor: '#10b981' }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sr">Share of churners the campaign saves: {Math.round(inputs.save_rate * 100)}%</label>
            <input id="sr" type="range" min="0.05" max="0.6" step="0.05" value={inputs.save_rate}
              onChange={e => setInputs(i => ({ ...i, save_rate: +e.target.value }))} style={{ width: '100%', accentColor: '#10b981' }} />
          </div>
          {plan && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {plan.eligible_customers.toLocaleString()} customers eligible (ordered in the last 180 days)
            </div>
          )}
        </div>
        {plan && (
          <>
            <div className="grid-4" style={{ marginBottom: 18 }}>
              {[
                ['Contact', plan.recommended_n.toLocaleString(), 'customers (optimal)'],
                ['Revenue protected', gbp(plan.expected_revenue_saved), 'expected, next quarter'],
                ['Campaign cost', gbp(plan.campaign_cost), ''],
                ['Net gain', gbp(plan.net_gain), plan.roi_pct !== null ? `ROI ${plan.roi_pct}%` : ''],
              ].map(([t, v, s]) => (
                <div key={t} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border-light)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: t === 'Net gain' ? (plan.net_gain >= 0 ? '#10b981' : '#ef4444') : 'var(--text-primary)' }}>{v}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={plan.curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey="n" type="number" domain={[0, 'dataMax']} tick={axisTick} axisLine={false} label={{ value: 'customers contacted', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={axisTick} axisLine={false} tickFormatter={gbp} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [gbp(v), n]} labelFormatter={(l) => `${l} customers`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={plan.recommended_n} stroke="#10b981" strokeDasharray="4 3" />
                <Line isAnimationActive={ANIM} dataKey="saved" name="Revenue protected" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line isAnimationActive={ANIM} dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line isAnimationActive={ANIM} dataKey="net" name="Net gain" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{plan.assumptions}</p>
          </>
        )}
      </div>

      {/* At-risk list */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Target size={18} color="#ef4444" />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Who to call first: highest expected loss</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Segment</th><th>Churn probability</th><th>Quarterly value</th><th>Expected loss</th><th>Days since order</th><th>Orders</th><th>Lifetime spend</th></tr></thead>
            <tbody>
              {risk.map(c => (
                <tr key={c.customer_id}>
                  <td style={{ fontWeight: 600 }}>#{c.customer_id}</td>
                  <td><span style={{ color: color(c.segment), fontWeight: 600 }}>{c.segment}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar-wrap" style={{ width: 70 }}><div className="progress-bar-fill" style={{ width: `${c.churn_probability * 100}%`, background: c.churn_probability > 0.6 ? '#ef4444' : '#f59e0b' }} /></div>
                      {pct(c.churn_probability)}
                    </div>
                  </td>
                  <td>{gbp(c.quarter_value)}</td>
                  <td style={{ fontWeight: 700, color: '#ef4444' }}>{gbp(c.expected_loss)}</td>
                  <td>{c.recency_days}</td><td>{c.orders}</td><td>{gbp(c.lifetime_spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
