import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import OnHoldBanner from '@/components/layout/OnHoldBanner'

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
        {(isEngineer || isAdmin) && user?.id && <OnHoldBanner userId={user.id} isAdmin={isAdmin} />}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
