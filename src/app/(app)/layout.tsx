import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import NotificationBell from '@/components/layout/NotificationBell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  const isEngineer = user?.role === 'ENGINEER'
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{ name: session.user?.name, email: session.user?.email, role: user?.role }} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {(isEngineer || isAdmin) && user?.id && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            padding: '8px 20px', flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
          }}>
            <NotificationBell userId={user.id} isAdmin={isAdmin} />
          </div>
        )}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
