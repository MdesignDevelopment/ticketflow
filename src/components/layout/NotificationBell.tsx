import { prisma } from '@/lib/prisma'
import NotificationBellClient from './NotificationBellClient'

export default async function NotificationBell({
  userId,
  isAdmin,
}: {
  userId: string
  isAdmin: boolean
}) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(isAdmin ? {} : { engineerId: userId }),
      status: 'ON_HOLD',
      onHoldAt: { lte: sevenDaysAgo },
      archivedAt: null,
    },
    select: {
      id: true,
      ticketNumber: true,
      onHoldAt: true,
      engineer: { select: { name: true } },
    },
    orderBy: { onHoldAt: 'asc' },
  })

  const serialized = tickets.map(t => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    onHoldAt: t.onHoldAt!.toISOString(),
    engineerName: t.engineer.name,
  }))

  return <NotificationBellClient tickets={serialized} isAdmin={isAdmin} />
}
