'use client'

import { useState, useEffect, useRef } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LabelList,
  ComposedChart, Line, CartesianGrid, Legend,
} from 'recharts'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  gold:    '#5C7CA6',
  mid:     '#6B9080',
  deep:    '#C9A66B',
  dark:    '#C23A2B',
  darker:  '#94A3B8',
  darkest: '#3E5C7E',
  pale:    '#A7BED6',
  lightest:'#D5E0EC',
}
const BROWN_SCALE = [C.gold, C.mid, C.deep, C.dark, C.darker, C.darkest, C.pale, C.lightest, '#7C93AD', '#C0D2E2']
const STATUS_COLORS: Record<string, string> = {
  'Done': '#6B9080', 'Escalated to L2': '#C23A2B',
  'On Hold': '#94A3B8', 'Ongoing': '#5C7CA6', 'Not Yet Started': '#CBD5E1',
}
const CAT_COLORS = ['#5C7CA6', '#6B9080', '#C9A66B']

const TABS = ['General', 'Performance', 'Escalations', 'Partners', 'Engineers']
const QUICK_FILTERS = [
  { key: 'all',    label: 'All Time'   },
  { key: 'year',   label: 'This Year'  },
  { key: 'last6m', label: 'Last 6M'    },
  { key: 'last3m', label: 'Last 3M'    },
  { key: 'month',  label: 'This Month' },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface Kpis {
  totalTickets: number; ticketsDone: number; ticketsOnHold: number
  ticketsOngoing: number; ticketsEscalated: number
}
interface PerfKpis {
  totalTickets: number; avgTicketsPerWeek: number; avgDaysToClose: number
  cat1Count: number; cat2Count: number; cat3Count: number
  cat1AvgDays: number; cat2AvgDays: number; cat3AvgDays: number
}
interface WeekPoint { label: string; week: number; year: number; cat1: number; cat2: number; cat3: number; total: number }
interface PerfData { kpis: PerfKpis; byWeek: WeekPoint[] }

interface EscKpis {
  totalEscalated: number; stillOpen: number; resolvedByL2: number
  avgDaysToClose: number; escalationRate: number; totalInPeriod: number
}
interface EscSubco { name: string; escalated: number; total: number; pct: number }
interface EscData {
  kpis: EscKpis
  monthly: { month: string; escalated: number; resolved: number }[]
  bySubcontractor: EscSubco[]
  resolutionBuckets: { range: string; count: number; sort: number }[]
}

interface SubcoStat {
  name: string; total: number; done: number; donePct: number
  escalated: number; escalationPct: number; avgDays: number
}
interface PartnerStat { name: string; total: number; done: number; donePct: number; avgDays: number }
interface PartnerKpis {
  totalSubcos: number; totalDesignPartners: number
  topSubco: string; topSubcoCount: number; avgTicketsPerSubco: number
}
interface PartnerData {
  kpis: PartnerKpis
  bySubcontractor: SubcoStat[]
  byDesignPartner: PartnerStat[]
  matrix: { subco: string; designPartner: string; count: number }[]
}

interface EngineerStat {
  id: string; name: string; total: number; done: number; donePct: number
  escalated: number; escalationPct: number; avgDays: number
  cat1: number; cat2: number; cat3: number
  onHold: number; ongoing: number; notStarted: number; waitingL2: number
}
interface EngineerKpis {
  activeEngineers: number; avgTicketsPerEngineer: number
  topByVolume: string; topByVolumeCount: number
  topByCompletion: string; topCompletionPct: number
  teamAvgDays: number; teamAvgDonePct: number; teamAvgEscPct: number
}
interface EngineerData { kpis: EngineerKpis; byEngineer: EngineerStat[] }
interface GenSummary { perf: PerfKpis; esc: EscKpis; partner: PartnerKpis; eng: EngineerKpis }

interface Props {
  kpis: Kpis
  byStatus: { name: string; value: number }[]
  bySubcontractor: { name: string; value: number }[]
  role: string
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function getQuickRange(key: string) {
  const now = new Date()
  const to = fmtDate(now)
  if (key === 'month')  return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to }
  if (key === 'year')   return { from: `${now.getFullYear()}-01-01`, to }
  if (key === 'last3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: fmtDate(d), to } }
  if (key === 'last6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return { from: fmtDate(d), to } }
  if (key === 'all')    return { from: '2004-01-01', to }
  return { from: `${now.getFullYear()}-01-01`, to }
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, border }: {
  label: string; value: string | number; sub?: string; accent?: string; border?: string
}) {
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${border ?? 'var(--border)'}`, borderRadius: '12px', padding: '20px 24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 700, color: accent ?? 'var(--foreground)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px' }}>{sub}</p>}
    </div>
  )
}

function CompactKpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '6px' }}>{label}</p>
      <p style={{ fontSize: '28px', fontWeight: 700, color: accent ?? 'var(--foreground)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' as string }

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
      <p style={{ fontWeight: 600, marginBottom: '2px' }}>{payload[0].name}</p>
      <p style={{ color: C.gold }}>{payload[0].value.toLocaleString()} tickets</p>
    </div>
  )
}

const SubcoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
      <p style={{ fontWeight: 600, marginBottom: '2px' }}>{label}</p>
      <p style={{ color: C.gold }}>{payload[0].value.toLocaleString()} tickets</p>
    </div>
  )
}

const WeeklyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const get = (k: string) => payload.find((p: any) => p.dataKey === k)?.value ?? 0
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', minWidth: '170px' }}>
      <p style={{ fontWeight: 700, marginBottom: '8px' }}>{label}</p>
      {([['cat1', 'Category 1', C.gold], ['cat2', 'Category 2', C.mid], ['cat3', 'Category 3', C.dark]] as [string,string,string][]).map(([k, n, c]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
          <span style={{ color: c }}>● {n}</span>
          <span style={{ fontWeight: 600 }}>{get(k)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #555', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Total</span>
        <span style={{ fontWeight: 700 }}>{get('total')}</span>
      </div>
    </div>
  )
}

const AvgDaysTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
      <p style={{ fontWeight: 600, marginBottom: '2px' }}>{label}</p>
      <p style={{ color: C.gold }}>{payload[0].value} days avg</p>
    </div>
  )
}

const EscMonthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const esc = payload.find((p: any) => p.dataKey === 'escalated')?.value ?? 0
  const res = payload.find((p: any) => p.dataKey === 'resolved')?.value ?? 0
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', minWidth: '160px' }}>
      <p style={{ fontWeight: 700, marginBottom: '8px' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <span style={{ color: '#BF1F1F' }}>● Escalated</span>
        <span style={{ fontWeight: 600 }}>{esc}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <span style={{ color: C.gold }}>● Resolved L2</span>
        <span style={{ fontWeight: 600 }}>{res}</span>
      </div>
    </div>
  )
}

const EscSubcoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d: EscSubco = payload[0]?.payload
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
      <p style={{ fontWeight: 700, marginBottom: '6px' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '3px' }}>
        <span style={{ color: '#BF1F1F' }}>Escalated</span>
        <span style={{ fontWeight: 600 }}>{d?.escalated}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '3px' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Total tickets</span>
        <span style={{ fontWeight: 600 }}>{d?.total}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <span style={{ color: C.gold }}>Esc. rate</span>
        <span style={{ fontWeight: 600 }}>{d?.pct}%</span>
      </div>
    </div>
  )
}

const BucketTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
      <p style={{ fontWeight: 600, marginBottom: '2px' }}>{label}</p>
      <p style={{ color: C.gold }}>{payload[0].value} tickets</p>
    </div>
  )
}

// Resolution-time colour scale: gold (fast) → dark red (slow)
const BUCKET_COLORS = ['#6B9080', '#5C7CA6', '#C9A66B', '#3E5C7E', '#C23A2B']

const EngCompareTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const done  = payload.find((p: any) => p.dataKey === 'done')?.value ?? 0
  const rem   = payload.find((p: any) => p.dataKey === 'remaining')?.value ?? 0
  const total = done + rem
  const pct   = total ? Math.round(done / total * 100) : 0
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', minWidth: '160px' }}>
      <p style={{ fontWeight: 700, marginBottom: '8px' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <span style={{ color: C.gold }}>Done</span>
        <span style={{ fontWeight: 600 }}>{done}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Remaining</span>
        <span style={{ fontWeight: 600 }}>{rem}</span>
      </div>
      <div style={{ borderTop: '1px solid #555', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Done %</span>
        <span style={{ fontWeight: 700, color: C.gold }}>{pct}%</span>
      </div>
    </div>
  )
}

const PartnerBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d: PartnerStat = payload[0]?.payload
  return (
    <div style={{ background: '#fff', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(15,23,42,0.10)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
      <p style={{ fontWeight: 700, marginBottom: '6px' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '3px' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Total tickets</span>
        <span style={{ fontWeight: 600 }}>{d?.total?.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '3px' }}>
        <span style={{ color: C.gold }}>Done</span>
        <span style={{ fontWeight: 600 }}>{d?.done?.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <span style={{ color: C.pale }}>Done %</span>
        <span style={{ fontWeight: 600 }}>{d?.donePct}%</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InternalDashboardClient({ kpis, byStatus, bySubcontractor, role }: Props) {
  const visibleTabs = role === 'EXTERN_PLUS' ? TABS.filter(t => t !== 'Engineers') : TABS
  const [activeTab, setActiveTab] = useState('General')
  const { totalTickets, ticketsDone, ticketsOnHold, ticketsOngoing, ticketsEscalated } = kpis
  const resolvedPct   = totalTickets ? Math.round(ticketsDone / totalTickets * 100) : 0
  const escalationPct = totalTickets ? (ticketsEscalated / totalTickets * 100).toFixed(1) : '0'

  // ── Performance tab state ──────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')
  const [quickFilter, setQuickFilter] = useState('year')
  const [perfData,    setPerfData]    = useState<PerfData | null>(null)
  const [perfLoading, setPerfLoading] = useState(false)

  // Initialise dates on client only (avoids SSR / hydration mismatch)
  useEffect(() => {
    const { from, to } = getQuickRange('year')
    setFromDate(from)
    setToDate(to)
  }, [])

  // Fetch when tab is active and dates are ready
  useEffect(() => {
    if (activeTab !== 'Performance' || !fromDate || !toDate) return
    setPerfLoading(true)
    fetch(`/api/admin/performance?from=${fromDate}&to=${toDate}`)
      .then(r => r.json())
      .then(data => { setPerfData(data); setPerfLoading(false) })
      .catch(() => setPerfLoading(false))
  }, [activeTab, fromDate, toDate])

  function applyQuick(key: string) {
    setQuickFilter(key)
    const { from, to } = getQuickRange(key)
    setFromDate(from)
    setToDate(to)
  }

  // ── Escalations tab state ──────────────────────────────────────────────────
  const [escFrom,    setEscFrom]    = useState('')
  const [escTo,      setEscTo]      = useState('')
  const [escQuick,   setEscQuick]   = useState('year')
  const [escData,    setEscData]    = useState<EscData | null>(null)
  const [escLoading, setEscLoading] = useState(false)

  useEffect(() => {
    const { from, to } = getQuickRange('year')
    setEscFrom(from)
    setEscTo(to)
  }, [])

  useEffect(() => {
    if (activeTab !== 'Escalations' || !escFrom || !escTo) return
    setEscLoading(true)
    fetch(`/api/admin/escalations?from=${escFrom}&to=${escTo}`)
      .then(r => r.json())
      .then(data => { setEscData(data); setEscLoading(false) })
      .catch(() => setEscLoading(false))
  }, [activeTab, escFrom, escTo])

  function applyEscQuick(key: string) {
    setEscQuick(key)
    const { from, to } = getQuickRange(key)
    setEscFrom(from)
    setEscTo(to)
  }

  // ── Partners tab state ─────────────────────────────────────────────────────
  const [ptnFrom,    setPtnFrom]    = useState('')
  const [ptnTo,      setPtnTo]      = useState('')
  const [ptnQuick,   setPtnQuick]   = useState('all')
  const [ptnData,    setPtnData]    = useState<PartnerData | null>(null)
  const [ptnLoading, setPtnLoading] = useState(false)

  useEffect(() => {
    const { from, to } = getQuickRange('all')
    setPtnFrom(from)
    setPtnTo(to)
  }, [])

  useEffect(() => {
    if (activeTab !== 'Partners' || !ptnFrom || !ptnTo) return
    setPtnLoading(true)
    setMatrixScroll(0)
    setMatrixMaxScroll(0)
    fetch(`/api/admin/partners?from=${ptnFrom}&to=${ptnTo}`)
      .then(r => r.json())
      .then(data => { setPtnData(data); setPtnLoading(false) })
      .catch(() => setPtnLoading(false))
  }, [activeTab, ptnFrom, ptnTo])

  useEffect(() => {
    if (!matrixScrollRef.current) return
    const el = matrixScrollRef.current
    const measure = () => setMatrixMaxScroll(el.scrollWidth - el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ptnData])

  function applyPtnQuick(key: string) {
    setPtnQuick(key)
    const { from, to } = getQuickRange(key)
    setPtnFrom(from)
    setPtnTo(to)
  }

  const matrixScrollRef = useRef<HTMLDivElement>(null)
  const [matrixScroll, setMatrixScroll] = useState(0)
  const [matrixMaxScroll, setMatrixMaxScroll] = useState(0)

  // ── Engineers tab state ────────────────────────────────────────────────────
  const [engFrom,     setEngFrom]     = useState('')
  const [engTo,       setEngTo]       = useState('')
  const [engQuick,    setEngQuick]    = useState('year')
  const [engData,     setEngData]     = useState<EngineerData | null>(null)
  const [engLoading,  setEngLoading]  = useState(false)
  const [selectedEng, setSelectedEng] = useState<EngineerStat | null>(null)

  useEffect(() => {
    const { from, to } = getQuickRange('year')
    setEngFrom(from)
    setEngTo(to)
  }, [])

  useEffect(() => {
    if (activeTab !== 'Engineers' || !engFrom || !engTo) return
    setEngLoading(true)
    setSelectedEng(null)
    fetch(`/api/admin/engineers?from=${engFrom}&to=${engTo}`)
      .then(r => r.json())
      .then(data => { setEngData(data); setEngLoading(false) })
      .catch(() => setEngLoading(false))
  }, [activeTab, engFrom, engTo])

  function applyEngQuick(key: string) {
    setEngQuick(key)
    const { from, to } = getQuickRange(key)
    setEngFrom(from)
    setEngTo(to)
  }

  // Derived data for Performance charts
  const catPieData = perfData ? [
    { name: 'Category 1', value: perfData.kpis.cat1Count },
    { name: 'Category 2', value: perfData.kpis.cat2Count },
    { name: 'Category 3', value: perfData.kpis.cat3Count },
  ].filter(d => d.value > 0) : []

  const avgDaysData = perfData ? [
    { name: 'Cat 1', value: perfData.kpis.cat1AvgDays, color: C.gold },
    { name: 'Cat 2', value: perfData.kpis.cat2AvgDays, color: C.mid  },
    { name: 'Cat 3', value: perfData.kpis.cat3AvgDays, color: C.dark },
  ] : []

  // Show ~12 X-axis ticks max on the combo chart
  const xInterval = perfData ? Math.max(0, Math.floor(perfData.byWeek.length / 12) - 1) : 0

  // Partners tab derived values (computed before render to keep JSX clean)
  const ptnMaxTotal     = ptnData ? Math.max(...ptnData.bySubcontractor.map(s => s.total), 1) : 1
  const ptnMatrixSubcos = ptnData ? ptnData.bySubcontractor.map(s => s.name) : []
  const ptnMatrixPtrs   = ptnData ? ptnData.byDesignPartner.map(p => p.name) : []
  const ptnMatrixLookup: Record<string, number> = {}
  if (ptnData) { for (const m of ptnData.matrix) ptnMatrixLookup[`${m.subco}|||${m.designPartner}`] = m.count }
  const ptnMatrixMax = ptnMatrixSubcos.length
    ? Math.max(...ptnMatrixSubcos.flatMap(s => ptnMatrixPtrs.map(p => ptnMatrixLookup[`${s}|||${p}`] ?? 0)), 1)
    : 1

  const engMaxTotal = engData ? Math.max(...engData.byEngineer.map(e => e.total), 1) : 1

  // ── General tab KPI summary ────────────────────────────────────────────────
  const [genSummary,        setGenSummary]        = useState<GenSummary | null>(null)
  const [genSummaryLoading, setGenSummaryLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'General' || genSummary !== null) return
    setGenSummaryLoading(true)
    const { from, to } = getQuickRange('year')
    Promise.all([
      fetch(`/api/admin/performance?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/admin/escalations?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/admin/partners?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/admin/engineers?from=${from}&to=${to}`).then(r => r.json()),
    ])
      .then(([perf, esc, partner, eng]) => {
        setGenSummary({ perf: perf.kpis, esc: esc.kpis, partner: partner.kpis, eng: eng.kpis })
        setGenSummaryLoading(false)
      })
      .catch(() => setGenSummaryLoading(false))
  }, [activeTab, genSummary])

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>Internal Dashboard</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>Operational metrics overview — admin access only</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', marginBottom: '28px', borderBottom: '2px solid var(--border)' }}>
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 20px', fontSize: '14px', fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === tab ? C.gold : 'var(--muted-foreground)',
            borderBottom: activeTab === tab ? `2px solid ${C.gold}` : '2px solid transparent',
            marginBottom: '-2px', transition: 'color 0.15s',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          GENERAL TAB  — Executive Overview
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'General' && (
        <>
          {/* ─── Row 1 · Headline KPIs ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>

            {/* Completion Rate */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '10px' }}>Completion Rate</p>
              <p style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1, marginBottom: '12px', color: resolvedPct >= 70 ? C.mid : resolvedPct >= 40 ? C.deep : C.dark }}>
                {resolvedPct}%
              </p>
              <div style={{ height: '6px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${resolvedPct}%`, background: resolvedPct >= 70 ? C.mid : resolvedPct >= 40 ? C.deep : C.dark, borderRadius: '3px', transition: 'width 0.4s' }} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{ticketsDone.toLocaleString()} of {totalTickets.toLocaleString()} closed</p>
            </div>

            {/* Weekly Throughput */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '10px' }}>Weekly Throughput</p>
              <p style={{ fontSize: '38px', fontWeight: 700, color: C.gold, lineHeight: 1, marginBottom: '12px' }}>
                {genSummary ? genSummary.perf.avgTicketsPerWeek : '—'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                {genSummary ? 'avg tickets / week (YTD)' : genSummaryLoading ? 'Loading…' : '—'}
              </p>
              {genSummary && (
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{genSummary.perf.totalTickets.toLocaleString()} processed this year</p>
              )}
            </div>

            {/* Avg Resolution Time */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '10px' }}>Avg Resolution</p>
              <p style={{ fontSize: '38px', fontWeight: 700, color: C.mid, lineHeight: 1, marginBottom: '12px' }}>
                {genSummary ? `${genSummary.perf.avgDaysToClose}d` : '—'}
              </p>
              {genSummary ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: C.gold }}>Cat1 · {genSummary.perf.cat1AvgDays}d</span>
                  <span style={{ fontSize: '11px', color: C.mid }}>Cat2 · {genSummary.perf.cat2AvgDays}d</span>
                  <span style={{ fontSize: '11px', color: C.dark }}>Cat3 · {genSummary.perf.cat3AvgDays}d</span>
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{genSummaryLoading ? 'Loading…' : '—'}</p>
              )}
            </div>

            {/* Escalation Risk */}
            <div style={{ background: 'var(--card)', border: `1px solid ${parseFloat(escalationPct) >= 10 ? '#dc262644' : parseFloat(escalationPct) >= 5 ? '#d9770644' : 'var(--border)'}`, borderRadius: '12px', padding: '20px 24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '10px' }}>Escalation Risk</p>
              <p style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1, marginBottom: '12px', color: parseFloat(escalationPct) >= 10 ? '#dc2626' : parseFloat(escalationPct) >= 5 ? '#d97706' : C.darkest }}>
                {escalationPct}%
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>{ticketsEscalated.toLocaleString()} escalated tickets</p>
              {genSummary && genSummary.esc.stillOpen > 0 && (
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>{genSummary.esc.stillOpen} still open (L2)</p>
              )}
            </div>
          </div>

          {/* ─── Row 2 · Status donut + Workload breakdown ────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '16px', alignItems: 'stretch', marginBottom: '20px' }}>

            {/* Status donut */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Status Distribution</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '20px' }}>All active tickets by current status</p>
              <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ flexShrink: 0, width: '190px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={byStatus} cx="50%" cy="50%" innerRadius={56} outerRadius={88}
                        dataKey="value" startAngle={90} endAngle={-270} strokeWidth={2} stroke="var(--card)">
                        {byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name] ?? BROWN_SCALE[i % BROWN_SCALE.length]} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{totalTickets.toLocaleString()}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>Total</p>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {byStatus.map((d, i) => {
                    const color = STATUS_COLORS[d.name] ?? BROWN_SCALE[i % BROWN_SCALE.length]
                    const pct = totalTickets ? (d.value / totalTickets * 100).toFixed(1) : '0'
                    return (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--muted-foreground)', minWidth: 0 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                          {d.value.toLocaleString()} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>({pct}%)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Workload breakdown */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Active Workload</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Current in-progress and blocked tickets</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}33`, borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.gold, marginBottom: '6px' }}>Ongoing</p>
                  <p style={{ fontSize: '26px', fontWeight: 700, color: C.gold, lineHeight: 1, marginBottom: '4px' }}>{ticketsOngoing.toLocaleString()}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{totalTickets ? (ticketsOngoing / totalTickets * 100).toFixed(1) : 0}% of total</p>
                </div>
                <div style={{ background: `${'#DE9521'}14`, border: `1px solid ${'#DE9521'}33`, borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#DE9521', marginBottom: '6px' }}>On Hold</p>
                  <p style={{ fontSize: '26px', fontWeight: 700, color: '#DE9521', lineHeight: 1, marginBottom: '4px' }}>{ticketsOnHold.toLocaleString()}</p>
                  <p style={{ fontSize: '11px', color: '#DE9521' }}>{totalTickets ? (ticketsOnHold / totalTickets * 100).toFixed(1) : 0}% of total</p>
                </div>
                <div style={{ background: '#C23A2B14', border: '1px solid #C23A2B33', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#C23A2B', marginBottom: '6px' }}>Escalated</p>
                  <p style={{ fontSize: '26px', fontWeight: 700, color: '#C23A2B', lineHeight: 1, marginBottom: '4px' }}>{ticketsEscalated.toLocaleString()}</p>
                  <p style={{ fontSize: '11px', color: genSummary && genSummary.esc.stillOpen > 0 ? '#dc2626' : 'var(--muted-foreground)' }}>
                    {genSummary ? `${genSummary.esc.stillOpen} still open (L2)` : `${escalationPct}% rate`}
                  </p>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '6px' }}>Not Started</p>
                  <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1, marginBottom: '4px' }}>
                    {(byStatus.find(s => s.name === 'Not Yet Started')?.value ?? 0).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    {totalTickets ? ((byStatus.find(s => s.name === 'Not Yet Started')?.value ?? 0) / totalTickets * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>Overall Progress</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.darkest }}>{ticketsDone.toLocaleString()} done / {totalTickets.toLocaleString()} total</span>
                </div>
                <div style={{ height: '8px', background: 'var(--muted)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${resolvedPct}%`, background: C.darkest, borderRadius: '4px', transition: 'width 0.4s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Row 3 · YTD deep-dive (loads async) ─────────────────── */}
          {genSummaryLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>
              Loading year-to-date summaries…
            </div>
          )}
          {genSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>

              {/* Operations */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Operations · YTD</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Throughput and resolution speed</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Tickets / week</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.gold }}>{genSummary.perf.avgTicketsPerWeek}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Avg close time</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.mid }}>{genSummary.perf.avgDaysToClose}d</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Total processed</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)' }}>{genSummary.perf.totalTickets.toLocaleString()}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>By Category</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: C.gold }}>● Cat 1</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{genSummary.perf.cat1Count.toLocaleString()} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>· {genSummary.perf.cat1AvgDays}d avg</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: C.mid }}>● Cat 2</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{genSummary.perf.cat2Count.toLocaleString()} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>· {genSummary.perf.cat2AvgDays}d avg</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: C.dark }}>● Cat 3</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{genSummary.perf.cat3Count.toLocaleString()} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>· {genSummary.perf.cat3AvgDays}d avg</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partners */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Partners · YTD</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Subcontractor and design partner activity</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Active subcos</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.dark }}>{genSummary.partner.totalSubcos}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Design partners</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.mid }}>{genSummary.partner.totalDesignPartners}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Avg tickets / subco</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)' }}>{genSummary.partner.avgTicketsPerSubco}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Top Subcontractors</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {bySubcontractor.slice(0, 5).map((s, i) => (
                        <div key={s.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{s.name.length > 22 ? s.name.slice(0, 21) + '…' : s.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)' }}>{s.value.toLocaleString()}</span>
                          </div>
                          <div style={{ height: '3px', background: 'var(--muted)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${bySubcontractor[0]?.value ? Math.round(s.value / bySubcontractor[0].value * 100) : 0}%`, background: BROWN_SCALE[i % BROWN_SCALE.length], borderRadius: '2px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Team */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Team · YTD</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Engineer performance overview</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Active engineers</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.deep }}>{genSummary.eng.activeEngineers}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Avg tickets / eng</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)' }}>{genSummary.eng.avgTicketsPerEngineer}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Team avg close</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: C.mid }}>{genSummary.eng.teamAvgDays}d</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Team done rate</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: genSummary.eng.teamAvgDonePct >= 70 ? C.darkest : genSummary.eng.teamAvgDonePct >= 40 ? C.gold : '#dc2626' }}>
                        {genSummary.eng.teamAvgDonePct}%
                      </span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${genSummary.eng.teamAvgDonePct}%`, background: genSummary.eng.teamAvgDonePct >= 70 ? C.darkest : genSummary.eng.teamAvgDonePct >= 40 ? C.gold : '#dc2626', borderRadius: '3px' }} />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Highlights</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Top volume</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.gold }}>{genSummary.eng.topByVolume} ({genSummary.eng.topByVolumeCount})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Best completion</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.darkest }}>{genSummary.eng.topByCompletion} ({genSummary.eng.topCompletionPct}%)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Team esc. rate</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: genSummary.eng.teamAvgEscPct >= 10 ? '#dc2626' : C.darkest }}>{genSummary.eng.teamAvgEscPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PERFORMANCE TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Performance' && (
        <>
          {/* Filter bar */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            {/* Quick filters — left */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUICK_FILTERS.map(f => (
                <button key={f.key} onClick={() => applyQuick(f.key)} style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background: quickFilter === f.key ? C.gold : 'transparent',
                  color: quickFilter === f.key ? '#fff' : 'var(--muted-foreground)',
                  borderColor: quickFilter === f.key ? C.gold : 'var(--border)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Custom date range — right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>From</span>
              <input type="date" value={fromDate}
                onChange={e => { setFromDate(e.target.value); setQuickFilter('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>to</span>
              <input type="date" value={toDate}
                onChange={e => { setToDate(e.target.value); setQuickFilter('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Loading state */}
          {perfLoading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              Loading performance data…
            </div>
          )}

          {/* Content */}
          {!perfLoading && perfData && (
            <>
              {/* ─── Row 1 · Main KPIs ─────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <KpiCard label="Avg Tickets / Week" value={perfData.kpis.avgTicketsPerWeek}
                  sub={`${perfData.byWeek.length} weeks in range`} accent={C.darkest} />
                <KpiCard label="Avg Days to Close" value={perfData.kpis.avgDaysToClose}
                  sub="all closed tickets" accent={C.dark} />
                <KpiCard label="Total in Period" value={perfData.kpis.totalTickets.toLocaleString()}
                  sub={`${fromDate} → ${toDate}`} />
              </div>

              {/* ─── Row 2 · Weekly combo chart + per-category KPIs ─────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 172px', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>

                {/* Combo chart */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Weekly Volume by Category</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    Stacked bars = category split · Dashed line = weekly total
                  </p>
                  {perfData.byWeek.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>
                      No data for selected period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={perfData.byWeek} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={xInterval} />
                        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
                        <Tooltip content={<WeeklyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                          formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />
                        <Bar dataKey="cat1" name="Category 1" stackId="a" fill={C.gold} />
                        <Bar dataKey="cat2" name="Category 2" stackId="a" fill={C.mid} />
                        <Bar dataKey="cat3" name="Category 3" stackId="a" fill={C.dark} radius={[3, 3, 0, 0]} />
                        <Line type="monotone" dataKey="total" name="Total" stroke={C.darkest}
                          strokeWidth={2} dot={false} strokeDasharray="5 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Per-category avg-days KPIs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <CompactKpiCard label="Category 1" value={perfData.kpis.cat1AvgDays} sub="avg days to close" accent={C.gold} />
                  <CompactKpiCard label="Category 2" value={perfData.kpis.cat2AvgDays} sub="avg days to close" accent={C.mid}  />
                  <CompactKpiCard label="Category 3" value={perfData.kpis.cat3AvgDays} sub="avg days to close" accent={C.dark} />
                </div>
              </div>

              {/* ─── Row 3 · Category distribution + resolution time ─────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Category distribution donut */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Category Distribution</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    Share of tickets received per category
                  </p>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {/* Donut */}
                    <div style={{ flexShrink: 0, width: '170px', position: 'relative' }}>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={catPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                            dataKey="value" startAngle={90} endAngle={-270} strokeWidth={2} stroke="var(--card)">
                            {catPieData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                          {perfData.kpis.totalTickets.toLocaleString()}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '2px' }}>Total</p>
                      </div>
                    </div>

                    {/* Legend with progress bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {catPieData.map((d, i) => {
                        const color = CAT_COLORS[i % CAT_COLORS.length]
                        const pct = perfData.kpis.totalTickets ? (d.value / perfData.kpis.totalTickets * 100).toFixed(1) : '0'
                        return (
                          <div key={d.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                                {d.name}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                                {pct}% <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: '11px' }}>({d.value.toLocaleString()})</span>
                              </span>
                            </div>
                            <div style={{ height: '5px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Avg resolution time by category */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Avg Resolution Time by Category</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    Average calendar days from ticket open to close
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={avgDaysData} margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<AvgDaysTooltip />} cursor={{ fill: 'var(--muted)' }} />
                      <Bar dataKey="value" name="Avg Days" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="value" position="top"
                          style={{ fontSize: 12, fontWeight: 700, fill: 'var(--muted-foreground)' }} />
                        {avgDaysData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Numeric summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    {avgDaysData.map(d => (
                      <div key={d.name} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '22px', fontWeight: 700, color: d.color, lineHeight: 1 }}>{d.value}</p>
                        <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '3px' }}>{d.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* No data / error state */}
          {!perfLoading && !perfData && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              No data available. Adjust the date range and try again.
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ESCALATIONS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Escalations' && (
        <>
          {/* Filter bar */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUICK_FILTERS.map(f => (
                <button key={f.key} onClick={() => applyEscQuick(f.key)} style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background: escQuick === f.key ? C.gold : 'transparent',
                  color:      escQuick === f.key ? '#fff'    : 'var(--muted-foreground)',
                  borderColor:escQuick === f.key ? C.gold : 'var(--border)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>From</span>
              <input type="date" value={escFrom} onChange={e => { setEscFrom(e.target.value); setEscQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>to</span>
              <input type="date" value={escTo} onChange={e => { setEscTo(e.target.value); setEscQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
            </div>
          </div>

          {escLoading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              Loading escalation data…
            </div>
          )}

          {!escLoading && escData && (
            <>
              {/* ─── Row 1 · KPIs ─────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <KpiCard
                  label="Total Escalated"
                  value={escData.kpis.totalEscalated.toLocaleString()}
                  sub={`of ${escData.kpis.totalInPeriod.toLocaleString()} total tickets`}
                  accent={C.darkest}
                />
                <KpiCard
                  label="Still Open"
                  value={escData.kpis.stillOpen.toLocaleString()}
                  sub="waiting on L2"
                  accent={escData.kpis.stillOpen > 0 ? '#BF1F1F' : C.darkest}
                />
                <KpiCard
                  label="Resolved by L2"
                  value={escData.kpis.resolvedByL2.toLocaleString()}
                  sub={escData.kpis.totalEscalated ? `${Math.round(escData.kpis.resolvedByL2 / escData.kpis.totalEscalated * 100)}% closure rate` : undefined}
                  accent={C.darkest}
                />
                <KpiCard
                  label="Avg Days to Close"
                  value={escData.kpis.avgDaysToClose || '—'}
                  sub="from open to L2 resolution"
                  accent={C.dark}
                />
                <KpiCard
                  label="Escalation Rate"
                  value={`${escData.kpis.escalationRate}%`}
                  sub="of all tickets in period"
                  accent={C.darkest}
                />
              </div>

              {/* ─── Row 2 · Monthly trend (full width) ───────────────────── */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>
                  Monthly Escalation Trend
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                  Bars = new escalations per month · Line = tickets resolved by L2
                </p>
                {escData.monthly.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={escData.monthly} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.floor(escData.monthly.length / 12) - 1)} />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<EscMonthTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />
                      <Bar dataKey="escalated" name="Escalated" fill="#BF1F1F" radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Line type="monotone" dataKey="resolved" name="Resolved by L2"
                        stroke={C.lightest} strokeWidth={2.5} dot={{ fill: C.gold, r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ─── Row 3 · Subcontractor + resolution time ──────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* By subcontractor */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>
                    Escalations by Subcontractor
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    Count of escalated tickets — hover for % of subco total
                  </p>
                  {escData.bySubcontractor.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No escalations found</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(escData.bySubcontractor.length * 34 + 20, 180)}>
                      <BarChart layout="vertical" data={escData.bySubcontractor} margin={{ left: 4, right: 52, top: 4, bottom: 4 }}>
                        <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={axisStyle} width={110} axisLine={false} tickLine={false}
                          tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + '…' : v} />
                        <Tooltip content={<EscSubcoTooltip />} cursor={{ fill: 'var(--muted)' }} />
                        <Bar dataKey="escalated" radius={[0, 4, 4, 0]} fill="#BF1F1F" opacity={0.85}>
                          <LabelList dataKey="escalated" position="right"
                            style={{ fontSize: 11, fontWeight: 600, fill: 'var(--muted-foreground)' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Escalation rate per subco table */}
                  {escData.bySubcontractor.length > 0 && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)', marginBottom: '10px' }}>
                        Escalation rate per subco
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {escData.bySubcontractor.slice(0, 8).map(d => (
                          <div key={d.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{d.name}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: d.pct >= 10 ? '#dc2626' : d.pct >= 5 ? '#d97706' : C.darkest }}>
                                {d.pct}%
                              </span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--muted)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(d.pct * 2, 100)}%`, background: d.pct >= 10 ? '#dc2626' : d.pct >= 5 ? '#d97706' : C.gold, borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resolution time distribution */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>
                    Time to Resolution
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    How long L2 takes to close escalated tickets — gold = fast, red = slow
                  </p>
                  {escData.resolutionBuckets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No closed escalations yet</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart layout="vertical" data={escData.resolutionBuckets} margin={{ left: 4, right: 52, top: 4, bottom: 4 }}>
                          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="range" tick={axisStyle} width={80} axisLine={false} tickLine={false} />
                          <Tooltip content={<BucketTooltip />} cursor={{ fill: 'var(--muted)' }} />
                          <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="count" position="right"
                              style={{ fontSize: 11, fontWeight: 600, fill: 'var(--muted-foreground)' }} />
                            {escData.resolutionBuckets.map((d, i) => (
                              <Cell key={i} fill={BUCKET_COLORS[Math.min(d.sort - 1, BUCKET_COLORS.length - 1)]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Summary row */}
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {escData.resolutionBuckets.map((d, i) => {
                          const total = escData.resolutionBuckets.reduce((s, r) => s + r.count, 0)
                          const pct = total ? Math.round(d.count / total * 100) : 0
                          return (
                            <div key={d.range} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: BUCKET_COLORS[Math.min(d.sort - 1, BUCKET_COLORS.length - 1)], flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', flex: 1 }}>{d.range}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                                {d.count} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>({pct}%)</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {!escLoading && !escData && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              No data available. Adjust the date range and try again.
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PARTNERS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Partners' && (
        <>
          {/* Filter bar */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUICK_FILTERS.map(f => (
                <button key={f.key} onClick={() => applyPtnQuick(f.key)} style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background:  ptnQuick === f.key ? C.gold : 'transparent',
                  color:       ptnQuick === f.key ? '#fff' : 'var(--muted-foreground)',
                  borderColor: ptnQuick === f.key ? C.gold : 'var(--border)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>From</span>
              <input type="date" value={ptnFrom} onChange={e => { setPtnFrom(e.target.value); setPtnQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>to</span>
              <input type="date" value={ptnTo} onChange={e => { setPtnTo(e.target.value); setPtnQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
            </div>
          </div>

          {ptnLoading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              Loading partner data…
            </div>
          )}

          {!ptnLoading && ptnData && (
            <>
              {/* ─── Row 1 · KPI cards ───────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <KpiCard label="Active Subcontractors"  value={ptnData.kpis.totalSubcos}         accent={C.dark} />
                <KpiCard label="Design Partners"        value={ptnData.kpis.totalDesignPartners} accent={C.mid} />
                <KpiCard label="Top Subcontractor"      value={ptnData.kpis.topSubco}
                  sub={`${ptnData.kpis.topSubcoCount.toLocaleString()} tickets`} accent={C.gold} />
                <KpiCard label="Avg Tickets / Subco"    value={ptnData.kpis.avgTicketsPerSubco}
                  sub="across all subcontractors" />
              </div>

              {/* ─── Row 2 · Subco × Partner matrix (full width) ─────────── */}
              <div style={{ marginBottom: '16px' }}>

                {/* Subco × Design Partner matrix */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Subcontractor × Design Partner</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                    Ticket count per combination — darker cell = higher volume · all subcos and partners shown
                  </p>
                  {ptnMatrixSubcos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No data</div>
                  ) : (
                    <>
                    <div
                      ref={matrixScrollRef}
                      style={{ overflowX: 'auto' }}
                      onScroll={e => {
                        const el = e.currentTarget
                        setMatrixScroll(el.scrollLeft)
                        setMatrixMaxScroll(el.scrollWidth - el.clientWidth)
                      }}
                    >
                      <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: 'max-content', minWidth: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: 'var(--muted-foreground)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--card)', zIndex: 2 }}>
                              Subco ╲ Partner
                            </th>
                            {ptnMatrixPtrs.map(p => (
                              <th key={p} style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, fontSize: '10px', color: 'var(--muted-foreground)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>
                                {p.length > 9 ? p.slice(0, 8) + '…' : p}
                              </th>
                            ))}
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--muted-foreground)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ptnMatrixSubcos.map((subco, si) => {
                            const subcoTotal = ptnData.bySubcontractor.find(s => s.name === subco)?.total ?? 0
                            return (
                              <tr key={subco} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 8px', fontWeight: 600, fontSize: '11px', color: 'var(--foreground)', whiteSpace: 'nowrap', background: si % 2 !== 0 ? 'var(--muted)' : 'var(--card)', position: 'sticky', left: 0, zIndex: 1 }}>
                                  {subco.length > 14 ? subco.slice(0, 13) + '…' : subco}
                                </td>
                                {ptnMatrixPtrs.map(partner => {
                                  const count = ptnMatrixLookup[`${subco}|||${partner}`] ?? 0
                                  const intensity = count ? 0.12 + (count / ptnMatrixMax) * 0.78 : 0
                                  return (
                                    <td key={partner}
                                      title={count ? `${subco} + ${partner}: ${count} tickets` : undefined}
                                      style={{
                                        padding: '7px 6px', textAlign: 'center', fontWeight: count ? 700 : 400, fontSize: '11px',
                                        background: count ? `rgba(92,124,166,${intensity.toFixed(2)})` : 'transparent',
                                        color: intensity > 0.55 ? '#fff' : count ? 'var(--foreground)' : 'var(--muted-foreground)',
                                      }}>
                                      {count || ''}
                                    </td>
                                  )
                                })}
                                <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: C.gold }}>
                                  {subcoTotal.toLocaleString()}
                                </td>
                              </tr>
                            )
                          })}
                          {/* Column totals */}
                          <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
                            <td style={{ padding: '7px 8px', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', background: 'rgba(0,0,0,0.02)', position: 'sticky', left: 0, zIndex: 1 }}>Total</td>
                            {ptnMatrixPtrs.map(partner => {
                              const colTotal = ptnMatrixSubcos.reduce((s, subco) => s + (ptnMatrixLookup[`${subco}|||${partner}`] ?? 0), 0)
                              return (
                                <td key={partner} style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: C.gold }}>
                                  {colTotal || ''}
                                </td>
                              )
                            })}
                            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: C.gold }}>
                              {ptnMatrixSubcos.reduce((s, subco) => s + (ptnData.bySubcontractor.find(x => x.name === subco)?.total ?? 0), 0).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>

              </div>

              {/* ─── Row 3 · Subcontractor Scorecard (full width) ─────────── */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Subcontractor Scorecard</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '20px' }}>
                  Performance per subcontractor — volume, completion rate, avg resolution time, and escalation rate
                </p>
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '44px' }} />
                      <col style={{ width: '140px' }} />
                      <col />
                      <col style={{ width: '72px' }} />
                      <col />
                      <col style={{ width: '88px' }} />
                      <col style={{ width: '88px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {[
                          { label: '#',              align: 'center' },
                          { label: 'Subcontractor',  align: 'left'   },
                          { label: 'Volume',         align: 'left'   },
                          { label: 'Done',           align: 'center' },
                          { label: 'Done %',         align: 'left'   },
                          { label: 'Avg Days',       align: 'center' },
                          { label: 'Esc Rate',       align: 'center' },
                        ].map(h => (
                          <th key={h.label} style={{
                            padding: '8px 12px', fontWeight: 700, fontSize: '10px',
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                            color: 'var(--muted-foreground)', whiteSpace: 'nowrap',
                            textAlign: h.align as any,
                          }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ptnData.bySubcontractor.map((s, idx) => {
                        const doneColor = s.donePct >= 80 ? C.darkest : s.donePct >= 60 ? C.gold : '#dc2626'
                        const escColor  = s.escalationPct >= 10 ? '#dc2626' : s.escalationPct >= 5 ? '#d97706' : C.darkest
                        return (
                          <tr key={s.name} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 !== 0 ? 'rgba(0,0,0,0.018)' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '11px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ flex: 1, height: '6px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${s.total / ptnMaxTotal * 100}%`, background: C.gold, borderRadius: '3px' }} />
                                </div>
                                <span style={{ fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', minWidth: '28px', textAlign: 'right' }}>{s.total.toLocaleString()}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--foreground)' }}>{s.done.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ flex: 1, height: '6px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${s.donePct}%`, background: doneColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontWeight: 700, color: doneColor, whiteSpace: 'nowrap', minWidth: '34px', textAlign: 'right' }}>{s.donePct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--foreground)' }}>
                              {s.avgDays > 0 ? `${s.avgDays}d` : <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: escColor }}>
                              {s.escalationPct}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Row 3 · Design Partner volume + Completion rate ──────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

                {/* Tickets by Design Partner - volume bar chart */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Tickets by Design Partner</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Volume per design partner</p>
                  {ptnData.byDesignPartner.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(ptnData.byDesignPartner.length * 36 + 20, 160)}>
                      <BarChart layout="vertical" data={ptnData.byDesignPartner} margin={{ left: 4, right: 52, top: 4, bottom: 4 }}>
                        <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={axisStyle} width={100} axisLine={false} tickLine={false}
                          tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                        <Tooltip content={<PartnerBarTooltip />} cursor={{ fill: 'var(--muted)' }} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          <LabelList dataKey="total" position="right"
                            style={{ fontSize: 11, fontWeight: 600, fill: 'var(--muted-foreground)' }} />
                          {ptnData.byDesignPartner.map((_e, i) => (
                            <Cell key={i} fill={BROWN_SCALE[i % BROWN_SCALE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Completion rate by design partner */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Completion Rate by Partner</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Done % per design partner</p>
                  {ptnData.byDesignPartner.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No data</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ptnData.byDesignPartner.map(p => {
                        const c = p.donePct >= 80 ? C.darkest : p.donePct >= 60 ? C.gold : '#dc2626'
                        return (
                          <div key={p.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{p.name}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: c }}>{p.donePct}%</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--muted)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.donePct}%`, background: c, borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!ptnLoading && !ptnData && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              No data available. Adjust the date range and try again.
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ENGINEERS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Engineers' && (
        <>
          {/* Filter bar */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUICK_FILTERS.map(f => (
                <button key={f.key} onClick={() => applyEngQuick(f.key)} style={{
                  padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background:  engQuick === f.key ? C.gold : 'transparent',
                  color:       engQuick === f.key ? '#fff' : 'var(--muted-foreground)',
                  borderColor: engQuick === f.key ? C.gold : 'var(--border)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>From</span>
              <input type="date" value={engFrom} onChange={e => { setEngFrom(e.target.value); setEngQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>to</span>
              <input type="date" value={engTo} onChange={e => { setEngTo(e.target.value); setEngQuick('custom') }}
                style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', cursor: 'pointer' }} />
            </div>
          </div>

          {engLoading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              Loading engineer data…
            </div>
          )}

          {!engLoading && engData && (
            <>
              {/* ─── Row 1 · KPIs ─────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <KpiCard label="Active Engineers"       value={engData.kpis.activeEngineers}        accent={C.gold} />
                <KpiCard label="Avg Tickets / Engineer" value={engData.kpis.avgTicketsPerEngineer} sub="across all engineers" accent={C.gold}/>
                <KpiCard label="Top by Volume"          value={engData.kpis.topByVolume}
                  sub={`${engData.kpis.topByVolumeCount.toLocaleString()} tickets`} accent={C.gold} />
                <KpiCard label="Best Completion Rate"   value={engData.kpis.topByCompletion}
                  sub={`${engData.kpis.topCompletionPct}% done (min 5 tickets)`} accent={C.darkest} />
              </div>

              {/* ─── Row 2 · Volume & Completion comparison chart ─────────── */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>
                  Volume & Completion by Engineer
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
                  Dark = Done · Light = Remaining · Label = done %
                </p>
                {engData.byEngineer.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(engData.byEngineer.length * 36 + 20, 180)}>
                    <BarChart
                      layout="vertical"
                      data={engData.byEngineer.map(e => ({
                        name:      e.name.length > 18 ? e.name.slice(0, 17) + '…' : e.name,
                        done:      e.done,
                        remaining: e.total - e.done,
                        donePct:   e.donePct,
                      }))}
                      margin={{ left: 4, right: 56, top: 4, bottom: 4 }}
                    >
                      <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={axisStyle} width={110} axisLine={false} tickLine={false} />
                      <Tooltip content={<EngCompareTooltip />} cursor={{ fill: 'var(--muted)' }} />
                      <Bar dataKey="done"      name="Done"      fill={C.darkest}         stackId="a" />
                      <Bar dataKey="remaining" name="Remaining" fill={`${C.lightest}88`} stackId="a" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="donePct" position="right"
                          formatter={(v: unknown) => `${v}%`}
                          style={{ fontSize: 11, fontWeight: 700, fill: 'var(--muted-foreground)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ─── Row 3 · Engineer Scorecard ───────────────────────────── */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: selectedEng ? '16px' : '0' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>Engineer Scorecard</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '20px' }}>
                  Click a row to drill into individual performance · volume, completion rate, avg resolution time, escalation rate
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['#', 'Engineer', 'Volume', 'Done', 'Done %', 'Avg Days', 'Esc Rate'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px', fontWeight: 700, fontSize: '10px',
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                            color: 'var(--muted-foreground)', whiteSpace: 'nowrap',
                            textAlign: ['#', 'Done', 'Avg Days', 'Esc Rate'].includes(h) ? 'center' : 'left',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {engData.byEngineer.map((e, idx) => {
                        const isSel     = selectedEng?.id === e.id
                        const doneColor = e.donePct >= 80 ? C.darkest : e.donePct >= 60 ? C.gold : '#dc2626'
                        const escColor  = e.escalationPct >= 10 ? '#dc2626' : e.escalationPct >= 5 ? '#d97706' : C.darkest
                        return (
                          <tr key={e.id}
                            onClick={() => setSelectedEng(isSel ? null : e)}
                            style={{
                              borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s',
                              background: isSel ? `${C.gold}18` : idx % 2 !== 0 ? 'rgba(0,0,0,0.018)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '11px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: isSel ? C.gold : 'var(--foreground)', whiteSpace: 'nowrap' }}>{e.name}</td>
                            <td style={{ padding: '10px 12px', minWidth: '150px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '5px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden', minWidth: '70px' }}>
                                  <div style={{ height: '100%', width: `${e.total / engMaxTotal * 100}%`, background: C.gold, borderRadius: '3px' }} />
                                </div>
                                <span style={{ fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{e.total.toLocaleString()}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--foreground)' }}>{e.done.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '5px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                  <div style={{ height: '100%', width: `${e.donePct}%`, background: doneColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontWeight: 700, color: doneColor, whiteSpace: 'nowrap' }}>{e.donePct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--foreground)' }}>
                              {e.avgDays > 0 ? `${e.avgDays}d` : <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: escColor }}>{e.escalationPct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Selected engineer detail panel ───────────────────────── */}
              {selectedEng && (() => {
                const catData = [
                  { name: 'Category 1', value: selectedEng.cat1, color: C.gold },
                  { name: 'Category 2', value: selectedEng.cat2, color: C.mid  },
                  { name: 'Category 3', value: selectedEng.cat3, color: C.dark },
                ].filter(d => d.value > 0)
                return (
                  <div style={{ background: 'var(--card)', border: `1px solid ${C.gold}55`, borderRadius: '12px', padding: '24px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: C.gold, marginBottom: '4px' }}>{selectedEng.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                          {selectedEng.total.toLocaleString()} tickets ·{' '}
                          Rank #{engData.byEngineer.findIndex(x => x.id === selectedEng.id) + 1} of {engData.byEngineer.length} by volume ·{' '}
                          {engFrom} → {engTo}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedEng(null)}
                        style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}
                      >
                        ✕ Close
                      </button>
                    </div>

                    {/* 3-column grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>

                      {/* Column 1: Performance vs Team */}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
                          Performance vs Team
                        </p>
                        {([
                          { label: 'Done %',   val: selectedEng.donePct,       avg: engData.kpis.teamAvgDonePct, fmt: (v: number) => `${v}%`                },
                          { label: 'Avg Days', val: selectedEng.avgDays,       avg: engData.kpis.teamAvgDays,    fmt: (v: number) => v > 0 ? `${v}d` : '—' },
                          { label: 'Esc Rate', val: selectedEng.escalationPct, avg: engData.kpis.teamAvgEscPct,  fmt: (v: number) => `${v}%`                },
                        ] as { label: string; val: number; avg: number; fmt: (v: number) => string }[]).map(m => {
                          const above = m.val > m.avg
                          const arrow = m.val > m.avg ? '↑' : m.val < m.avg ? '↓' : '='
                          const color = above ? '#16a34a' : 'var(--foreground)'
                          return (
                            <div key={m.label} style={{
                              background: above ? '#16a34a12' : 'var(--card)',
                              border: `1px solid ${above ? '#16a34a44' : 'var(--border)'}`,
                              borderRadius: '10px', padding: '14px 16px', marginBottom: '10px',
                            }}>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '6px' }}>{m.label}</p>
                              <p style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{m.fmt(m.val)}</p>
                              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '5px' }}>{arrow} vs {m.fmt(m.avg)} team avg</p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Column 2: Status Breakdown */}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
                          Status Breakdown
                        </p>
                        {([
                          { label: 'Done',       count: selectedEng.done,       color: C.darkest  },
                          { label: 'Ongoing',    count: selectedEng.ongoing,    color: C.gold     },
                          { label: 'On Hold',    count: selectedEng.onHold,     color: C.mid      },
                          { label: 'Not Started',count: selectedEng.notStarted, color: C.lightest },
                          { label: 'Waiting L2', count: selectedEng.waitingL2,  color: '#C23A2B'  },
                        ] as { label: string; count: number; color: string }[]).filter(d => d.count > 0).map(d => {
                          const pct = selectedEng.total ? Math.round(d.count / selectedEng.total * 100) : 0
                          return (
                            <div key={d.label} style={{ marginBottom: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                                  {d.label}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                                  {d.count} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>({pct}%)</span>
                                </span>
                              </div>
                              <div style={{ height: '6px', background: 'var(--muted)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: d.color, borderRadius: '3px', transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Column 3: Category Breakdown */}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
                          Category Breakdown
                        </p>
                        <div style={{ position: 'relative', width: '160px', margin: '0 auto 16px' }}>
                          <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                              <Pie data={catData} cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                                dataKey="value" startAngle={90} endAngle={-270} strokeWidth={2} stroke="var(--card)">
                                {catData.map((d, ci) => <Cell key={ci} fill={d.color} />)}
                              </Pie>
                              <Tooltip content={<PieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{selectedEng.total}</p>
                            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '3px' }}>Total</p>
                          </div>
                        </div>
                        {catData.map(c => {
                          const pct = selectedEng.total ? Math.round(c.value / selectedEng.total * 100) : 0
                          return (
                            <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                                {c.name}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                                {c.value} <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>({pct}%)</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {!engLoading && !engData && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-foreground)', fontSize: '14px' }}>
              No data available. Adjust the date range and try again.
            </div>
          )}
        </>
      )}
    </div>
  )
}
