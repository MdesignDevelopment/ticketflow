'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import TicketsNavLink from '@/components/layout/TicketsNavLink'

const nav = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: 'Tickets',
    href: '/tickets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/history',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="12 8 12 12 14 14" />
        <path d="M3.05 11a9 9 0 1 0 .5-4.5" /><polyline points="3 3 3 7 7 7" />
      </svg>
    ),
  },
  {
    label: 'Documentation',
    href: '/documentation',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Archive',
    href: '/tickets/archive',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

const adminNav = [
  {
    label: 'Internal Dashboard',
    href: '/admin/internal-dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string }
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = user.role === 'ADMIN'
  const isExtern = user.role === 'EXTERN'
  const isExternInternal = user.role === 'EXTERN_PLUS'
  const isExternLike = isExtern || isExternInternal

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen sticky top-0" style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-accent)' }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-accent)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--sidebar-fg)' }}>TicketFlow</p>
            <p className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>L1 Support</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.filter(item => !isExternLike || item.href === '/dashboard').map(item => {
          // Tickets link uses smart component that restores last filter
          if (item.href === '/tickets') {
            return <TicketsNavLink key="/tickets" icon={item.icon} isExtern={isExternLike} />
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? '' : 'hover:bg-[#f5f5f5]'}`}
              style={{
                color: active ? 'var(--sidebar-active)' : 'var(--sidebar-muted)',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}

        {(isAdmin || isExternInternal) && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a3a3a3' }}>Admin</p>
            </div>
            {adminNav.filter(item => isAdmin || item.href === '/admin/internal-dashboard').map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? '' : 'hover:bg-[#f5f5f5]'}`}
                  style={{
                    color: active ? 'var(--sidebar-active)' : 'var(--sidebar-muted)',
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--sidebar-accent)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-fg)' }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--sidebar-muted)' }}>{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: 'var(--sidebar-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-muted)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
