// pages/PredictionsPage.jsx — Revenue forecasting with a transparent backtest

import { useState, useEffect } from 'react'
import { analyticsAPI } from '../services/api'
import toast from 'react-hot-toast'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, RefreshCw, FlaskConical } from 'lucide-react'
import { gbp, tooltipStyle } from './Dashboard'

const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }
const MODEL_TEXT = {
  naive: 'Next week = this week',
  moving_average: 'Next week = average of the last 4 weeks',
  ridge_lags: 'Ridge regression on the last 4 weeks + time trend',
}

export default function PredictionsPage() {
  const [f, setF] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setF((await analyticsAPI.forecast()).data) }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to load forecast') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading || !f) return (
    <div className="loading-overlay" style={{ minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
      <div className="spinner" style={{ width: 48, height: 48 }} />
      <p style={{ color: 'var(--text-muted)' }}>Running the forecasting backtest…</p>
    </div>
  )

  const hist = f.history.labels.map((l, i) => ({ week: l.slice(0, 6), Actual: f.history.revenue[i] }))
  const fut = f.forecast.labels.map((l, i) => ({
    week: l.slice(0, 6), Forecast: f.forecast.predicted[i], Range: [f.forecast.lower[i], f.forecast.upper[i]],
  }))
  const last = hist[hist.length - 1]
  const chart = [...hist.slice(0, -1), { ...last, Forecast: last.Actual }, ...fut]
  const bt = f.backtest.labels.map((l, i) => ({ week: l.slice(0, 6), Actual: f.backtest.actual[i], Predicted: f.backtest.predicted[i] }))
  const total8 = f.forecast.predicted.reduce((a, b) => a + b, 0)

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Revenue Forecasting</h1>
          <p>Three models compared on a rolling backtest; the most accurate one makes the forecast</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          ['Next 8 weeks (forecast)', gbp(total8), `${f.forecast.interval} interval shown on chart`],
          ['Model selected', f.model_used.replace(/_/g, ' '), MODEL_TEXT[f.model_used]],
          ['Better than naive baseline', `${f.improvement_vs_naive_pct}%`, `lower mean absolute error over ${f.backtest_weeks} weeks`],
        ].map(([t, v, s]) => (
          <div key={t} className="glass-card" style={{ padding: 20 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t}</p>
            <p style={{ fontSize: 26, fontWeight: 700, margin: '6px 0', textTransform: 'capitalize' }}>{v}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s}</p>
          </div>
        ))}
      </div>

      <div className="chart-container" style={{ marginBottom: 24 }}>
        <p className="chart-title"><TrendingUp size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Weekly revenue: history and forecast</p>
        <p className="chart-subtitle">Partial first and last weeks are excluded so they don't look like crashes</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="week" tick={axisTick} axisLine={false} interval={4} />
            <YAxis tick={axisTick} axisLine={false} tickFormatter={gbp} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [Array.isArray(v) ? `${gbp(v[0])} – ${gbp(v[1])}` : gbp(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area dataKey="Range" stroke="none" fill="#8b5cf6" fillOpacity={0.15} name="80% interval" />
            <Line dataKey="Actual" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line dataKey="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-container">
          <p className="chart-title"><FlaskConical size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Backtest: predicted vs actual</p>
          <p className="chart-subtitle">Each week predicted using only the weeks before it</p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={bt}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="week" tick={axisTick} axisLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickFormatter={gbp} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [gbp(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="Actual" stroke="#6366f1" strokeWidth={2} />
              <Line dataKey="Predicted" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Model comparison ({f.backtest_weeks}-week backtest)</h3>
          <table className="data-table">
            <thead><tr><th>Model</th><th>How it predicts</th><th>MAE</th><th>MAPE</th></tr></thead>
            <tbody>
              {f.models.map(m => (
                <tr key={m.model} style={m.model === f.model_used ? { background: 'rgba(99,102,241,0.08)' } : {}}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{m.model.replace(/_/g, ' ')}{m.model === f.model_used ? ' ✓' : ''}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{MODEL_TEXT[m.model]}</td>
                  <td>{gbp(m.mae)}</td>
                  <td>{m.mape}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            MAE = average error in pounds per week. MAPE = average error as % of actual. {f.note}
          </p>
        </div>
      </div>
    </div>
  )
}
