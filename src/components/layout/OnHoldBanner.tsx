import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function OnHoldBanner({ userId }: { userId: string }) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const tickets = await prisma.ticket.findMany({
    where: {
      engineerId: userId,
      status: 'ON_HOLD',
      onHoldAt: { lte: sevenDaysAgo },
      archivedAt: null,
    },
    select: { id: true, ticketNumber: true, onHoldAt: true },
    orderBy: { onHoldAt: 'asc' },
  })

  if (tickets.length === 0) return null

  const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000)

  return (
    <div style={{
      background: '#fff7ed',
      borderBottom: '1px solid #fed7aa',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
    }}>
      {/* Icon */}
      <svg style={{ color: '#ea580c', flexShrink: 0, marginTop: '1px' }} width="16" height="16"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#9a3412', marginBottom: '4px' }}>
          {tickets.length === 1
            ? 'A ticket has been on hold for over 7 days'
            : `${tickets.length} tickets have been on hold for over 7 days`}
          {' '}— please close {tickets.length === 1 ? 'it' : 'them'} or send an email to the user.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tickets.map(t => (
            <Link key={t.id} href={`/tickets/${t.id}`}
              style={{
                fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
                color: '#c2410c', background: '#ffedd5',
                border: '1px solid #fdba74', borderRadius: '5px',
                padding: '2px 8px', whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}>
              {t.ticketNumber}
              <span style={{ fontWeight: 400, marginLeft: '4px', fontFamily: 'inherit' }}>
                ({daysSince(t.onHoldAt!)}d)
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
