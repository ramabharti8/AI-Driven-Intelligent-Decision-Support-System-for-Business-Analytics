// pages/Dashboard.jsx — KPIs and trends computed from the real retail data

import { useEffect, useState } from 'react'
import { analyticsAPI } from '../services/api'
import KPICard from '../components/ui/KPICard'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, Line, ComposedChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { PoundSterling, ShoppingCart, Users, Package, Repeat, AlertCircle, RefreshCw, Database } from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#94a3b8']

export const gbp = (v) => {
  if (v === null || v === undefined) return ''
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `£${(v / 1_000).toFixed(0)}K`
  return `£${Math.round(v)}`
}

export const tooltipStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }
const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [countries, setCountries] = useState(null)
  const [products, setProducts] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, m, c, p, f] = await Promise.all([
        analyticsAPI.dashboard(), analyticsAPI.monthly(), analyticsAPI.countries(),
        analyticsAPI.products(8), analyticsAPI.forecast(),
      ])
      setD(a.data); setMonthly(m.data); setCountries(c.data); setProducts(p.data.products); setForecast(f.data)
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to load dashboard data'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  if (loading) return (
    <div className="loading-overlay" style={{ minHeight: '60vh', flexDirection: 'column', gap: 14 }}>
      <div className="spinner" style={{ width: 48, height: 48 }} />
      <p style={{ color: 'var(--text-muted)' }}>Computing analytics from 396K order lines… (first load trains the models)</p>
    </div>
  )
  if (error || !d) return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 8 }}>Dashboard unavailable</h3>
      <p style={{ color: 'var(--text-muted)' }}>{error}</p>
    </div>
  )

  const k = d.kpis
  const period = `${d.period.compare.replace(/(\d{4})-(\d{2})/g, (_, y, mo) => new Date(y, mo - 1).toLocaleString('en', { month: 'short' }))}`
  const kpiConfig = [
    { title: 'Total Revenue', value: k.total_revenue.value, change: k.total_revenue.change, icon: PoundSterling, color: '#6366f1', prefix: '£', sparkline: k.total_revenue.trend, period },
    { title: 'Orders', value: k.total_orders.value, change: k.total_orders.change, icon: ShoppingCart, color: '#06b6d4', sparkline: k.total_orders.trend, period },
    { title: 'Active Customers', value: k.active_customers.value, change: k.active_customers.change, icon: Users, color: '#8b5cf6', sparkline: k.active_customers.trend, period },
    { title: 'Avg Order Value', value: k.avg_order_value.value, change: k.avg_order_value.change, icon: Package, color: '#f59e0b', prefix: '£', decimals: 2, sparkline: k.avg_order_value.trend, period },
    { title: 'Repeat Customers', value: k.repeat_rate.value, change: null, icon: Repeat, color: '#10b981', suffix: '%', decimals: 1, period: 'ordered more than once' },
    { title: '90-day Churn', value: d.churn_rate, change: null, icon: AlertCircle, color: '#ef4444', suffix: '%', decimals: 1, period: 'did not return in 90 days' },
  ]

  const monthlyData = monthly.labels.map((l, i) => ({
    month: l.replace(/ (\d{2})(\d{2})$/, " '$2") + (monthly.complete[i] ? '' : '*'),
    Revenue: monthly.revenue[i], Orders: monthly.orders[i],
    New: monthly.new_customers[i], Returning: monthly.returning_customers[i],
  }))
  const pieData = countries.labels.map((l, i) => ({ name: l, value: countries.values[i] }))
  const productData = products.map(p => ({ name: p.name.length > 28 ? p.name.slice(0, 27) + '…' : p.name, Revenue: p.revenue }))

  const hist = forecast.history
  const recent = hist.labels.slice(-20).map((l, i) => ({ week: l.slice(0, 6), Actual: hist.revenue.slice(-20)[i] }))
  const future = forecast.forecast.labels.map((l, i) => ({
    week: l.slice(0, 6), Forecast: forecast.forecast.predicted[i],
    Range: [forecast.forecast.lower[i], forecast.forecast.upper[i]],
  }))
  if (recent.length) future.unshift({ ...recent[recent.length - 1], Forecast: recent[recent.length - 1].Actual })
  const forecastData = [...recent.slice(0, -1), ...future]
  const bestModel = forecast.models.find(m => m.model === forecast.model_used)

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Computed live from {d.dataset.invoices.toLocaleString()} orders · {d.dataset.from} to {d.dataset.to} · amounts in GBP</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="grid-6" style={{ marginBottom: 20 }}>
        {kpiConfig.map((c) => <KPICard key={c.title} {...c} />)}
      </div>

      <div className="glass-card" style={{ padding: '14px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', border: '1px solid rgba(99,102,241,0.2)' }}>
        <Database size={16} color="#818cf8" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Data: <strong>{d.dataset.name}</strong> ({d.dataset.customers.toLocaleString()} customers, {d.dataset.countries} countries, {d.dataset.license}).
          Churn model: <strong>{d.model.name.replace(/_/g, ' ')}</strong>, ROC-AUC <strong style={{ color: '#818cf8' }}>{d.model.roc_auc}</strong> on unseen customers.
        </span>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-container">
          <p className="chart-title">Monthly revenue and orders</p>
          <p className="chart-subtitle">* partial month (data ends {d.dataset.to})</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} />
              <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickFormatter={gbp} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === 'Revenue' ? gbp(v) : v.toLocaleString(), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="l" dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Line yAxisId="r" dataKey="Orders" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <p className="chart-title">New vs returning customers</p>
          <p className="chart-subtitle">Customers ordering each month</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} />
              <YAxis tick={axisTick} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Returning" stackId="c" fill="#6366f1" />
              <Bar dataKey="New" stackId="c" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-container">
          <p className="chart-title">Revenue by country</p>
          <p className="chart-subtitle">{countries.top} = {countries.share_top}% of revenue: high market concentration</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [gbp(v), 'Revenue']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <p className="chart-title">Top products by revenue</p>
          <p className="chart-subtitle">Cancelled orders excluded</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={productData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis type="number" tick={axisTick} axisLine={false} tickFormatter={gbp} />
              <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} width={170} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [gbp(v), 'Revenue']} />
              <Bar dataKey="Revenue" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-container" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p className="chart-title">Weekly revenue forecast: next {forecast.horizon_weeks} weeks</p>
            <p className="chart-subtitle">
              Model: {forecast.model_used.replace(/_/g, ' ')} (picked by {forecast.backtest_weeks}-week backtest) ·
              MAPE {bestModel?.mape}% · {forecast.improvement_vs_naive_pct}% lower error than the naive baseline · band = {forecast.forecast.interval} interval
            </p>
          </div>
          <span className="badge badge-primary">Backtested</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="week" tick={axisTick} axisLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickFormatter={gbp} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [Array.isArray(v) ? `${gbp(v[0])} – ${gbp(v[1])}` : gbp(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area dataKey="Range" stroke="none" fill="#8b5cf6" fillOpacity={0.15} name="80% interval" />
            <Line dataKey="Actual" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line dataKey="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{forecast.note}</p>
      </div>
    </div>
  )
}
