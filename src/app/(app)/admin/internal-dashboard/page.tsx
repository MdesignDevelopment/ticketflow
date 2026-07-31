import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InternalDashboardClient from './InternalDashboardClient'

const STATUS_LABELS: Record<string, string> = {
  NOT_YET_STARTED: 'Not Yet Started',
  IN_PROGRESS: 'Ongoing',
  ON_HOLD: 'On Hold',
  DONE: 'Done',
  DONE_BY_L2: 'Done by L2',
  ESCALATED_TO_L2: 'Escalated to L2',
}

export default async function InternalDashboardPage() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role !== 'ADMIN' && role !== 'EXTERN_PLUS') redirect('/dashboard')

  const [byStatusRaw, bySubcontractorRaw] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['status'],
      where: { isValidTicket: true, archivedAt: null },
      _count: true,
    }),
    prisma.ticket.groupBy({
      by: ['subcontractor'],
      where: { isValidTicket: true, archivedAt: null, subcontractor: { not: 'Wyre ( OSC UPDATE )' } },
      _count: true,
      orderBy: { _count: { subcontractor: 'desc' } },
    }),
  ])

  const statusMap = Object.fromEntries(byStatusRaw.map(r => [r.status, r._count]))
  const totalTickets = byStatusRaw.reduce((sum, r) => sum + r._count, 0)
  const ticketsDone = (statusMap['DONE'] ?? 0) + (statusMap['DONE_BY_L2'] ?? 0)
  const ticketsOnHold = statusMap['ON_HOLD'] ?? 0
  const ticketsOngoing = statusMap['IN_PROGRESS'] ?? 0
  const ticketsEscalated = statusMap['ESCALATED_TO_L2'] ?? 0

  // Merge DONE and DONE_BY_L2 into a single "Done" slice for the donut
  const mergedStatus: Record<string, number> = {}
  for (const r of byStatusRaw) {
    const label = (r.status === 'DONE' || r.status === 'DONE_BY_L2') ? 'Done' : (STATUS_LABELS[r.status] ?? r.status)
    mergedStatus[label] = (mergedStatus[label] ?? 0) + r._count
  }
  const byStatus = Object.entries(mergedStatus)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const bySubcontractor = bySubcontractorRaw.map(r => ({
    name: r.subcontractor?.trim() || '(Blank)',
    value: r._count,
  }))

  return (
    <InternalDashboardClient
      kpis={{ totalTickets, ticketsDone, ticketsOnHold, ticketsOngoing, ticketsEscalated }}
      byStatus={byStatus}
      bySubcontractor={bySubcontractor}
      role={role}
    />
  )
}
