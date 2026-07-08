import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Standard portal-metrics endpoint consumed by the MD portal (EmploLink).
// GET /api/portal-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
// Auth: Authorization: Bearer <PORTAL_METRICS_SECRET>. Only the portal knows
// the secret; every other caller gets a 401. Response shape: contract v1
// (see the portal's docs/METRICS_ENDPOINT_SPEC.md).

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PORTAL_METRICS_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  const candidate = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

// --- Scoring (ported from the portal's previous direct-DB implementation) ---

const SCORE_WEIGHTS = { onTime: 0.4, lowEscalation: 0.25, throughput: 0.2, speed: 0.15 }

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

type MetricRow = {
  email: string
  name: string
  handled: number
  resolved: number
  on_time: number
  resolved_with_est: number
  avg_days: number | null
  escalated: number
  docs_created: number
  open_backlog: number
}

function scoreEngineers(rows: MetricRow[]) {
  const maxResolved = Math.max(1, ...rows.map(r => r.resolved))
  const maxAvgDays = Math.max(0, ...rows.map(r => (r.avg_days == null ? 0 : r.avg_days)))

  return rows.map(r => {
    const onTimeRate = r.resolved_with_est > 0 ? r.on_time / r.resolved_with_est : null
    const escalationBase = r.resolved + r.escalated
    const escalationRate = escalationBase > 0 ? r.escalated / escalationBase : 0
    const throughputNorm = clamp01(r.resolved / maxResolved)
    const speedNorm =
      r.avg_days == null || maxAvgDays === 0 ? 0 : clamp01(1 - r.avg_days / maxAvgDays)

    const score = Math.round(
      100 *
        (SCORE_WEIGHTS.onTime * (onTimeRate ?? 0) +
          SCORE_WEIGHTS.lowEscalation * (1 - escalationRate) +
          SCORE_WEIGHTS.throughput * throughputNorm +
          SCORE_WEIGHTS.speed * speedNorm)
    )

    return { ...r, onTimeRate, escalationRate, score }
  })
}

// Status labels/colors as the portal used to render them.
const STATUS_META: Record<string, { label: string; color: string }> = {
  DONE: { label: 'Done', color: '#10b981' },
  DONE_BY_L2: { label: 'Done (L2)', color: '#14b8a6' },
  ESCALATED_TO_L2: { label: 'Escalated', color: '#ef4444' },
  ON_HOLD: { label: 'On hold', color: '#f59e0b' },
  IN_PROGRESS: { label: 'In progress', color: '#0ea5e9' },
  NOT_YET_STARTED: { label: 'Not started', color: '#94a3b8' },
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: 'from and to (YYYY-MM-DD) are required' },
      { status: 400 }
    )
  }
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T23:59:59.999Z`)

  // One pass over Ticket, per active engineer (same queries the portal
  // previously ran directly against this database).
  const [metricsRaw, statusRaw, timelineRaw] = await Promise.all([
    prisma.$queryRaw<MetricRow[]>`
      SELECT u.email, u.name,
        count(*) FILTER (WHERE t."startDate" BETWEEN ${fromDate} AND ${toDate})::int AS handled,
        count(*) FILTER (WHERE t."actualEnd" BETWEEN ${fromDate} AND ${toDate} AND t.status IN ('DONE','DONE_BY_L2'))::int AS resolved,
        count(*) FILTER (WHERE t."actualEnd" BETWEEN ${fromDate} AND ${toDate} AND t.status IN ('DONE','DONE_BY_L2')
          AND t."estimatedEnd" IS NOT NULL AND t."actualEnd" <= t."estimatedEnd")::int AS on_time,
        count(*) FILTER (WHERE t."actualEnd" BETWEEN ${fromDate} AND ${toDate} AND t.status IN ('DONE','DONE_BY_L2')
          AND t."estimatedEnd" IS NOT NULL)::int AS resolved_with_est,
        (avg(EXTRACT(EPOCH FROM (t."actualEnd" - t."startDate")) / 86400.0)
          FILTER (WHERE t."actualEnd" BETWEEN ${fromDate} AND ${toDate} AND t.status IN ('DONE','DONE_BY_L2')))::float AS avg_days,
        count(*) FILTER (WHERE t."updatedAt" BETWEEN ${fromDate} AND ${toDate} AND t.status = 'ESCALATED_TO_L2')::int AS escalated,
        count(*) FILTER (WHERE t."actualEnd" BETWEEN ${fromDate} AND ${toDate} AND t."documentationStatus" = 'CREATED')::int AS docs_created,
        count(*) FILTER (WHERE t.status IN ('NOT_YET_STARTED','IN_PROGRESS','ON_HOLD'))::int AS open_backlog
      FROM "User" u
      LEFT JOIN "Ticket" t ON t."engineerId" = u.id
      WHERE u.role = 'ENGINEER' AND u.active
      GROUP BY u.id, u.email, u.name
      ORDER BY resolved DESC
    `,
    prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status::text AS status, count(*)::int AS count
      FROM "Ticket"
      WHERE "startDate" BETWEEN ${fromDate} AND ${toDate}
      GROUP BY status
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ date: string; count: number }[]>`
      SELECT to_char("actualEnd" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*)::int AS count
      FROM "Ticket"
      WHERE "actualEnd" BETWEEN ${fromDate} AND ${toDate} AND status IN ('DONE','DONE_BY_L2')
      GROUP BY 1
      ORDER BY 1
    `,
  ])

  const scored = scoreEngineers(
    metricsRaw.map(r => ({
      ...r,
      avg_days: r.avg_days == null ? null : Math.round(Number(r.avg_days) * 100) / 100,
    }))
  ).sort((a, b) => b.score - a.score)

  // Team-level rollups (same formulas the portal used).
  const sum = (fn: (r: (typeof scored)[number]) => number) =>
    scored.reduce((acc, r) => acc + fn(r), 0)
  const resolved = sum(r => r.resolved)
  const onTimeNum = sum(r => r.on_time)
  const onTimeDen = sum(r => r.resolved_with_est)
  const escalated = sum(r => r.escalated)
  const daysWeighted = sum(r => (r.avg_days == null ? 0 : r.avg_days * r.resolved))
  const teamScore = scored.length
    ? Math.round(sum(r => r.score) / scored.length)
    : 0

  return NextResponse.json({
    version: 1,
    kpis: [
      { label: 'Resolved', value: resolved, format: 'number' },
      {
        label: 'On-time rate',
        value: onTimeDen > 0 ? onTimeNum / onTimeDen : null,
        format: 'percent',
      },
      {
        label: 'Avg days',
        value: resolved > 0 ? Math.round((daysWeighted / resolved) * 100) / 100 : null,
        format: 'days',
      },
      {
        label: 'Escalation rate',
        value: resolved + escalated > 0 ? escalated / (resolved + escalated) : 0,
        format: 'percent',
      },
      { label: 'Open backlog', value: sum(r => r.open_backlog), format: 'number' },
      { label: 'Docs created', value: sum(r => r.docs_created), format: 'number' },
      { label: 'Team score', value: teamScore, format: 'score' },
    ],
    statusBreakdown: statusRaw.map(s => ({
      status: s.status,
      label: STATUS_META[s.status]?.label,
      count: Number(s.count),
      color: STATUS_META[s.status]?.color,
    })),
    timelineLabel: 'Tickets resolved',
    timeline: timelineRaw.map(t => ({ date: t.date, count: Number(t.count) })),
    people: scored.map(r => ({
      email: r.email,
      name: r.name,
      metrics: [
        { label: 'Handled', value: r.handled, format: 'number' },
        { label: 'Resolved', value: r.resolved, format: 'number' },
        { label: 'On-time', value: r.onTimeRate, format: 'percent' },
        { label: 'Avg days', value: r.avg_days, format: 'days' },
        { label: 'Escalated', value: r.escalated, format: 'number' },
        { label: 'Docs', value: r.docs_created, format: 'number' },
        { label: 'Open', value: r.open_backlog, format: 'number' },
      ],
      score: r.score,
    })),
  })
}
