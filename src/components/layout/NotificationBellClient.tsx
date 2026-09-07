'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Ticket {
  id: string
  ticketNumber: string
  onHoldAt: string
  engineerName: string
}

export default function NotificationBellClient({
  tickets,
  isAdmin,
}: {
  tickets: Ticket[]
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = tickets.length

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (count === 0) return null

  const days = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

  const scrollable = tickets.length > 5

  return (
    <div ref={ref} style={{ position: 'fixed', top: '14px', right: '20px', zIndex: 50 }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: open ? '#fff7ed' : 'var(--card)',
          border: `1px solid ${open ? '#fdba74' : 'var(--border)'}`,
          borderRadius: '8px',
          padding: '7px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="#ea580c" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {/* Count badge */}
        <span style={{
          position: 'absolute', top: '-7px', right: '-7px',
          background: '#ea580c', color: '#fff',
          fontSize: '10px', fontWeight: 700,
          borderRadius: '999px', minWidth: '17px', height: '17px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', lineHeight: 1,
          boxShadow: '0 0 0 2px var(--card)',
        }}>
          {count}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '310px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '2px' }}>
              On Hold Reminders
            </p>
            <p style={{ fontSize: '12px', color: '#ea580c' }}>
              {count} ticket{count !== 1 ? 's' : ''} on hold for over 7 days
            </p>
          </div>

          {/* Ticket list */}
          <div style={{
            maxHeight: scrollable ? '265px' : undefined,
            overflowY: scrollable ? 'auto' : undefined,
          }}>
            {tickets.map((t, i) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px', padding: '10px 16px', textDecoration: 'none',
                  borderBottom: i < tickets.length - 1 ? '1px solid var(--border)' : undefined,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '13px', fontWeight: 600, fontFamily: 'monospace',
                    color: '#c2410c', marginBottom: isAdmin ? '2px' : 0,
                  }}>
                    {t.ticketNumber}
                  </p>
                  {isAdmin && (
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.engineerName}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 600, flexShrink: 0,
                  color: '#ea580c', background: '#fff7ed',
                  border: '1px solid #fed7aa', borderRadius: '5px',
                  padding: '2px 7px', whiteSpace: 'nowrap',
                }}>
                  {days(t.onHoldAt)}d
                </span>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '9px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--muted)',
          }}>
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', textAlign: 'center' }}>
              Close the ticket or send an email to the user
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
