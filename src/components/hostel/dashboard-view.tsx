'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users,
  BedDouble,
  IndianRupee,
  MessageSquareWarning,
  TrendingUp,
  ArrowUpRight,
  Megaphone,
  DoorOpen,
  Building2,
  MapPin,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardData } from '@/lib/types'
import { formatCurrency, monthLabel, formatDate } from '@/lib/types'
import { apiFetch, getActiveBranchId } from './api-helpers'
import { StatusBadge, PriorityBadge, EmptyState } from './shared'
import type { Section } from '@/app/page'

function StatCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export default function DashboardView({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', getActiveBranchId()],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
  })

  if (error) {
    return (
      <EmptyState
        title="Could not load dashboard"
        description="There was a problem fetching statistics. Please try again."
      />
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  const { students, rooms, finance, complaints, visitors, notices, charts } = data
  const occupancyPercent = rooms.occupancyRate
  const collectionRate =
    finance.paidCount + finance.pendingCount > 0
      ? Math.round((finance.paidCount / (finance.paidCount + finance.pendingCount)) * 100)
      : 0
  const monthCollectionRate =
    finance.monthPaidCount + finance.monthPendingCount > 0
      ? Math.round(
          (finance.monthPaidCount / (finance.monthPaidCount + finance.monthPendingCount)) * 100
        )
      : 0

  return (
    <div className="space-y-6">
      {/* Branch banner */}
      {data.branch && (
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/30">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{data.branch.name}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {data.branch.city ?? '—'} · code {data.branch.code}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <p className="text-xs text-muted-foreground">
              Earnings shown are for <span className="font-medium text-foreground">{monthLabel(data.month)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          label="Active Residents"
          value={String(students.active)}
          hint={`${students.total} total · ${students.checkedOut} checked out`}
          onClick={() => onNavigate('students')}
        />
        <StatCard
          icon={<BedDouble className="h-4 w-4 text-muted-foreground" />}
          label="Occupancy"
          value={`${occupancyPercent}%`}
          hint={`${rooms.occupiedBeds} of ${rooms.totalBeds} beds · ${rooms.maintenance} under maintenance`}
          onClick={() => onNavigate('rooms')}
        />
        <StatCard
          icon={<IndianRupee className="h-4 w-4 text-muted-foreground" />}
          label={`Earnings — ${monthLabel(data.month)}`}
          value={formatCurrency(finance.monthCollected)}
          hint={`${formatCurrency(finance.monthPendingAmount)} still pending · ${monthCollectionRate}% collected`}
          onClick={() => onNavigate('payments')}
        />
        <StatCard
          icon={<MessageSquareWarning className="h-4 w-4 text-muted-foreground" />}
          label="Open Complaints"
          value={String(complaints.open + complaints.inProgress)}
          hint={`${complaints.open} open · ${complaints.inProgress} in progress`}
          onClick={() => onNavigate('complaints')}
        />
      </div>

      {/* Admin: branch comparison */}
      {data.branchesOverview && data.branchesOverview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Branches — {monthLabel(data.month)}</CardTitle>
            <CardDescription>
              Monthly earnings and occupancy across all 5 hostels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {data.branchesOverview.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-xl border p-4 ${
                    b.id === data.branch?.id
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{b.code}</Badge>
                    {b.id === data.branch?.id && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        viewing
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.city ?? '—'}</p>
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Earnings this month</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(b.earningsThisMonth)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Occupancy</span>
                        <span className="font-medium">
                          {b.occupiedBeds}/{b.totalBeds}
                        </span>
                      </div>
                      <Progress
                        value={b.occupancyRate}
                        className="mt-1 h-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.activeResidents} active residents
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee Collection Trend</CardTitle>
            <CardDescription>Monthly rent collected — this branch (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.revenueTrend.length === 0 ? (
              <EmptyState title="No payment records yet" description="Fee data will appear here once payments are recorded." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.revenueTrend.map((d) => ({ ...d, label: monthLabel(d.month) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Collected']}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by Floor</CardTitle>
            <CardDescription>Beds occupied vs. capacity per floor</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.occupancyByFloor.length === 0 ? (
              <EmptyState title="No rooms yet" description="Rooms are pre-created for every branch." />
            ) : (
              <div className="space-y-5 pt-2">
                {charts.occupancyByFloor.map((f) => {
                  const pct = f.capacity > 0 ? Math.round((f.occupied / f.capacity) * 100) : 0
                  return (
                    <div key={f.floor} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Floor {f.floor}</span>
                        <span className="text-muted-foreground">
                          {f.occupied}/{f.capacity} beds · {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-2.5" />
                    </div>
                  )
                })}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Rooms in this branch</p>
                    <p className="mt-1 text-lg font-bold">
                      {rooms.total}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {rooms.available} available · {rooms.full} full
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Visitors on premises</p>
                    <p className="mt-1 text-lg font-bold flex items-center gap-1.5">
                      <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      {visitors.active}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: complaints + notices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Recent Complaints</CardTitle>
              <CardDescription>Latest maintenance requests</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('complaints')}>
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {complaints.recent.length === 0 ? (
              <EmptyState title="No complaints filed" description="All quiet — nothing to resolve right now." />
            ) : (
              <ul className="space-y-3">
                {complaints.recent.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.studentName} · {formatDate(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={c.status} />
                      <PriorityBadge priority={c.priority} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                Notices
              </CardTitle>
              <CardDescription>Latest announcements for this branch</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('notices')}>
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {notices.length === 0 ? (
              <EmptyState title="No notices published" description="Announcements will appear here." />
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {notices.map((n) => (
                  <li key={n.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <StatusBadge status={n.priority} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground/70">{formatDate(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick insights strip */}
      <Card className="border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{collectionRate}%</span>
            <span className="text-muted-foreground">of all fee records collected</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BedDouble className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{rooms.available}</span>
            <span className="text-muted-foreground">rooms accepting allocation</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{rooms.totalBeds - rooms.occupiedBeds}</span>
            <span className="text-muted-foreground">beds still open in this branch</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
