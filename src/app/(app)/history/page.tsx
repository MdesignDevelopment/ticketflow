import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const FIELD_LABELS: Record<string, string> = {
  status:       'Status',
  engineerId:   'Assigned Engineer',
  designPartner:'Design Partner',
  subcontractor:'Subcontractor',
  actualEnd:    'Actual End Date',
  estimatedEnd: 'Estimated End Date',
  archivedAt:   'Archived',
  startDate:    'Start Date',
  category:     'Category',
  ticketNumber: 'Ticket Number',
}

const VALUE_MAP: Record<string, Record<string, string>> = {
  status: {
    NOT_YET_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold',
    DONE: 'Done', DONE_BY_L2: 'Done (L2)', ESCALATED_TO_L2: 'Escalated',
  },
  category: { CATEGORY_1: 'Category 1', CATEGORY_2: 'Category 2', CATEGORY_3: 'Category 3' },
}

function fmtValue(field: string, raw: string | null, engineerMap: Record<string, string>): string {
  if (raw == null || raw === '') return '—'
  if (field === 'engineerId') return engineerMap[raw] ?? raw
  if (VALUE_MAP[field]?.[raw]) return VALUE_MAP[field][raw]
  if (field === 'actualEnd' || field === 'estimatedEnd' || field === 'archivedAt') {
    try { return new Date(raw).toLocaleDateString('en-GB') } catch { return raw }
  }
  return raw
}

function fmtDateTime(d: Date) {
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; engineer?: string; page?: string }>
}) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role !== 'ADMIN' && role !== 'ENGINEER') redirect('/dashboard')

  const isAdmin = role === 'ADMIN'
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const perPage = 40
  const skip = (page - 1) * perPage

  const where: any = {}
  if (params.q) where.ticket = { ticketNumber: { contains: params.q, mode: 'insensitive' } }
  if (params.from) where.createdAt = { ...where.createdAt, gte: new Date(params.from) }
  if (params.to) where.createdAt = { ...where.createdAt, lte: new Date(params.to + 'T23:59:59') }
  if (params.engineer && isAdmin) where.userId = params.engineer

  const [rows, total, engineers] = await Promise.all([
    prisma.ticketHistory.findMany({
      where,
      include: {
        ticket: { select: { id: true, ticketNumber: true } },
        user:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
    }),
    prisma.ticketHistory.count({ where }),
    isAdmin
      ? prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
      : [],
  ])

  // Build engineer lookup for resolving engineerId old/new values
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } })
  const engineerMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]))

  const totalPages = Math.ceil(total / perPage)
  const hasFilter = !!(params.q || params.from || params.to || params.engineer)

  const buildHref = (extra: Record<string, string>) => {
    const p = new URLSearchParams(
      Object.entries({ ...params, ...extra }).filter(([, v]) => v) as [string, string][]
    )
    return `/history?${p}`
  }

  return (
    <div className="p-8 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>History</h1>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-5 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted-foreground)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" defaultValue={params.q} placeholder="Ticket number…"
            className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', width: 180 }} />
        </div>
        <input type="date" name="from" defaultValue={params.from}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', colorScheme: 'light' }} />
        <input type="date" name="to" defaultValue={params.to}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', colorScheme: 'light' }} />
        {isAdmin && (
          <select name="engineer" defaultValue={params.engineer ?? ''}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)', colorScheme: 'light' }}>
            <option value="">All engineers</option>
            {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          Filter
        </button>
        {hasFilter && (
          <Link href="/history" className="px-3 py-2 rounded-lg text-sm"
            style={{ color: 'var(--muted-foreground)' }}>
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Ticket', 'Changed By', 'Field', 'From', 'To'].map(label => (
                <th key={label} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--muted-foreground)', background: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}
                className="hover:bg-[#fafafa] transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {fmtDateTime(r.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/tickets/${r.ticket.id}`} className="font-medium hover:underline"
                    style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {r.ticket.ticketNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                  {r.user?.name ?? '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                    {FIELD_LABELS[r.field] ?? r.field}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm max-w-[160px] truncate" style={{ color: '#ef4444' }}>
                  {fmtValue(r.field, r.oldValue, engineerMap)}
                </td>
                <td className="px-4 py-3 text-sm max-w-[160px] truncate" style={{ color: '#16a34a' }}>
                  {fmtValue(r.field, r.newValue, engineerMap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--muted-foreground)' }}>
            No history found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: String(page + 1) })}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}