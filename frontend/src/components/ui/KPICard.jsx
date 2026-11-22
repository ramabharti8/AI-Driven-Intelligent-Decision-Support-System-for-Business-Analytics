// components/ui/KPICard.jsx — Animated KPI stat card

import { TrendingUp, TrendingDown } from 'lucide-react'
import { useState, useEffect } from 'react'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return value
}

export default function KPICard({ title, value, change, prefix = '', suffix = '', icon: Icon, color = '#6366f1', sparkline = [], period = 'vs last month', decimals = 0 }) {
  const hasChange  = change !== null && change !== undefined
  const isPositive = change >= 0
  const numericVal = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0
  const animated   = useCountUp(numericVal)
  const shown      = animated === numericVal ? numericVal : animated

  const displayVal = typeof value === 'number'
    ? `${prefix}${shown.toLocaleString(undefined, { minimumFractionDigits: animated === numericVal ? decimals : 0, maximumFractionDigits: decimals })}${suffix}`
    : value

  return (
    <div className="kpi-card glass-card animate-fade-in">
      <div className="kpi-top">
        <div>
          <p className="kpi-label">{title}</p>
          <h3 className="kpi-value">{displayVal}</h3>
        </div>
        <div className="kpi-icon" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon size={22} color={color} />
        </div>
      </div>

      <div className="kpi-bottom">
        {hasChange && (
          <span className={`kpi-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
        <span className="kpi-period">{period}</span>
      </div>

      {/* Mini sparkline */}
      {sparkline.length > 0 && (
        <div className="kpi-sparkline">
          <svg width="100%" height="36" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`sg-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const min = Math.min(...sparkline)
              const max = Math.max(...sparkline)
              const range = max - min || 1
              const pts = sparkline.map((v, i) => {
                const x = (i / (sparkline.length - 1)) * 100
                const y = 36 - ((v - min) / range) * 30
                return `${x},${y}`
              })
              const polyline = pts.join(' ')
              const areaPath = `M${pts[0]} L${pts.join(' L')} L100,36 L0,36 Z`
              return (
                <>
                  <path d={areaPath} fill={`url(#sg-${title})`} />
                  <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" />
                </>
              )
            })()}
          </svg>
        </div>
      )}

      <style>{`
        .kpi-card { padding: 22px; cursor: default; }
        .kpi-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .kpi-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .kpi-value { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: var(--text-primary); }
        .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-bottom { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .kpi-change { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; padding: 3px 8px; border-radius: 99px; }
        .kpi-change.positive { color: #34d399; background: rgba(16,185,129,0.12); }
        .kpi-change.negative { color: #f87171; background: rgba(239,68,68,0.12); }
        .kpi-period { font-size: 12px; color: var(--text-muted); }
        .kpi-sparkline { height: 36px; margin: -4px -22px -22px; overflow: hidden; border-radius: 0 0 20px 20px; }
      `}</style>
    </div>
  )
}
