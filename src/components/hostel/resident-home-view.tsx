'use client'

import { useQuery } from '@tanstack/react-query'
import {
  BedDouble,
  IndianRupee,
  MessageSquareWarning,
  ReceiptText,
  Megaphone,
  DoorOpen,
  CalendarDays,
  Phone,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { Student } from '@/lib/types'
import type { Section } from '@/app/page'
import { formatCurrency, formatDate, monthLabel, currentMonth, roomTypeLabel } from '@/lib/types'
import { apiFetch } from './api-helpers'
import { StatusBadge, EmptyState } from './shared'

export default function ResidentHomeView({
  residentId,
  onNavigate,
}: {
  residentId: string
  onNavigate: (s: Section) => void
}) {
  const { data: me, isLoading, error } = useQuery<Student>({
    queryKey: ['me', 'resident', residentId],
    queryFn: () => apiFetch<Student>(`/api/students/${residentId}`),
  })

  if (error) {
    return (
      <EmptyState
        title="Could not load your dashboard"
        description="Please try again in a moment."
      />
    )
  }

  if (isLoading || !me) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-56" />
      </div>
    )
  }

  const thisMonth = currentMonth()
  const payments = me.payments ?? []
  const currentDue = payments.find((p) => p.month === thisMonth)
  const pendingCount = payments.filter((p) => p.status !== 'PAID').length
  const openComplaints = (me.complaints ?? []).filter(
    (c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS'
  )
  const recentVisitors = (me.visitors ?? []).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <p className="text-xl font-bold">{me.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {me.studentId} · {me.branch?.name ?? 'the hostel'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={me.status} />
            {me.room ? (
              <Badge variant="secondary" className="text-sm">
                <BedDouble className="mr-1.5 h-3.5 w-3.5" />
                Room {me.room.roomNumber}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm">Room not allocated yet</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onNavigate('myPayments')}
          role="button"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month&apos;s Rent
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentDue?.amount ?? me.room?.monthlyFee ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {currentDue ? (
                currentDue.status === 'PAID' ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Paid for {monthLabel(thisMonth)} — thank you!
                  </span>
                ) : (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Payment pending for {monthLabel(thisMonth)}
                  </span>
                )
              ) : (
                'No dues generated yet for this month'
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onNavigate('myPayments')}
          role="button"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Dues
            </CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                payments.filter((p) => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0)
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} pending payment${pendingCount > 1 ? 's' : ''}`
                : 'All payments settled'}
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onNavigate('myComplaints')}
          role="button"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Requests
            </CardTitle>
            <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openComplaints.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {openComplaints.length > 0
                ? 'open maintenance requests'
                : 'No open requests — all clear'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room + contact info */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Room</CardTitle>
            <CardDescription>Allocation details</CardDescription>
          </CardHeader>
          <CardContent>
            {me.room ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Room</p>
                  <p className="font-semibold">{me.room.roomNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Floor</p>
                  <p className="font-semibold">{me.room.floor}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-semibold">
                    {roomTypeLabel(me.room.type)} ({me.room.capacity} bed
                    {me.room.capacity > 1 ? 's' : ''})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly rent</p>
                  <p className="font-semibold">{formatCurrency(me.room.monthlyFee)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Checked in</p>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDate(me.checkInDate)}
                  </p>
                </div>
                {me.guardianName && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Guardian on record</p>
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {me.guardianName}
                      {me.guardianPhone ? ` · ${me.guardianPhone}` : ''}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="Room not allocated yet"
                description="Please contact the hostel office to get a bed allocated."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-muted-foreground" />
                Recent Visitors
              </CardTitle>
              <CardDescription>Guests who came to see you</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recentVisitors.length === 0 ? (
              <EmptyState
                title="No visitors yet"
                description="Visitors are logged at the reception when they arrive."
              />
            ) : (
              <ul className="space-y-2.5">
                {recentVisitors.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(v.checkIn)}</p>
                    </div>
                    <StatusBadge status={v.checkOut ? 'RESOLVED' : 'IN_PROGRESS'} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notices preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              Notices for your branch
            </CardTitle>
            <CardDescription>Announcements from the hostel office</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <NoticesPreview />
        </CardContent>
      </Card>
    </div>
  )
}

function NoticesPreview() {
  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => apiFetch<{ id: string; title: string; content: string; priority: string; createdAt: string }[]>('/api/notices'),
  })
  if (isLoading) return <Skeleton className="h-20" />
  if (!notices || notices.length === 0) {
    return (
      <EmptyState
        title="No notices right now"
        description="Announcements from the office will appear here."
      />
    )
  }
  return (
    <ul className="space-y-2.5">
      {notices.slice(0, 3).map((n) => (
        <li key={n.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{n.title}</p>
            <StatusBadge status={n.priority} />
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{n.content}</p>
        </li>
      ))}
    </ul>
  )
}
