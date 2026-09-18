'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Users,
  BedDouble,
  ReceiptText,
  TrendingDown,
  MessageSquareWarning,
  DoorOpen,
  Megaphone,
  UtensilsCrossed,
  Menu,
  Building2,
  Sun,
  Moon,
  Home as HomeIcon,
  LogOut,
  KeyRound,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { AuthUser, Branch } from '@/lib/types'
import { apiFetch, setActiveBranch, getActiveBranchId, UNAUTHORIZED_EVENT } from '@/components/hostel/api-helpers'
import LoginView from '@/components/hostel/login-view'
import DashboardView from '@/components/hostel/dashboard-view'
import StudentsView from '@/components/hostel/students-view'
import RoomsView from '@/components/hostel/rooms-view'
import PaymentsView from '@/components/hostel/payments-view'
import ExpensesView from '@/components/hostel/expenses-view'
import ComplaintsView from '@/components/hostel/complaints-view'
import VisitorsView from '@/components/hostel/visitors-view'
import NoticesView from '@/components/hostel/notices-view'
import MessMenuView from '@/components/hostel/mess-menu-view'
import ResidentHomeView from '@/components/hostel/resident-home-view'
import {
  ResidentPaymentsView,
  ResidentComplaintsView,
  ResidentNoticesView,
} from '@/components/hostel/resident-portal-views'

export type Section =
  | 'dashboard'
  | 'students'
  | 'rooms'
  | 'payments'
  | 'expenses'
  | 'complaints'
  | 'visitors'
  | 'notices'
  | 'messMenu'
  | 'myHome'
  | 'myPayments'
  | 'myComplaints'

type NavItem = {
  key: Section
  label: string
  icon: React.ComponentType<{ className?: string }>
  subtitle: string
}

const STAFF_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, subtitle: 'Branch overview, occupancy and earnings' },
  { key: 'students', label: 'Residents', icon: Users, subtitle: 'Check-ins, allocation and check-outs' },
  { key: 'rooms', label: 'Rooms', icon: BedDouble, subtitle: '1/2/3-seater rooms, beds and occupancy' },
  { key: 'payments', label: 'Fees & Payments', icon: ReceiptText, subtitle: 'Monthly rent collection and dues' },
  { key: 'expenses', label: 'Branch Expenses', icon: TrendingDown, subtitle: "This month's spending for the branch" },
  { key: 'complaints', label: 'Complaints', icon: MessageSquareWarning, subtitle: 'Maintenance requests from residents' },
  { key: 'visitors', label: 'Visitor Logs', icon: DoorOpen, subtitle: 'Track guests entering the hostel' },
  { key: 'notices', label: 'Notices', icon: Megaphone, subtitle: 'Announcements for this branch' },
  { key: 'messMenu', label: 'Mess Menu', icon: UtensilsCrossed, subtitle: 'Common dining menu for all hostels' },
]

const RESIDENT_NAV: NavItem[] = [
  { key: 'myHome', label: 'My Home', icon: HomeIcon, subtitle: 'Your room, rent and requests' },
  { key: 'myPayments', label: 'My Payments', icon: ReceiptText, subtitle: 'Monthly rent history and dues' },
  { key: 'myComplaints', label: 'My Requests', icon: MessageSquareWarning, subtitle: 'Submit and track maintenance requests' },
  { key: 'notices', label: 'Notices', icon: Megaphone, subtitle: 'Announcements from your branch' },
  { key: 'messMenu', label: 'Mess Menu', icon: UtensilsCrossed, subtitle: 'This week’s dining menu' },
]

function SidebarNav({
  items,
  active,
  onSelect,
}: {
  items: NavItem[]
  active: Section
  onSelect: (s: Section) => void
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function HostelLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold text-sidebar-foreground">Hostel Management</p>
          <p className="text-[11px] text-sidebar-foreground/60">
            Nazzal · Nooroxotel · Ayesha · Aqsa · Velvetrose
          </p>
        </div>
      )}
    </div>
  )
}

function initials(name: string | null, fallback: string) {
  const source = name?.trim() || fallback
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export default function Home() {
  const queryClient = useQueryClient()
  const [section, setSection] = useState<Section>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [pwDialogOpen, setPwDialogOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // ---------------------------------------------------------------- session
  const { data: user, isLoading: authLoading, refetch: refetchMe } = useQuery<AuthUser>({
    queryKey: ['me'],
    queryFn: () => apiFetch<AuthUser>('/api/auth/me'),
    retry: false,
    staleTime: 60_000,
  })

  // Kick the user back to the login screen when any API call returns 401
  // (only meaningful while signed in — the login screen itself is a 401 state)
  useEffect(() => {
    const handler = () => {
      if (!user) return
      queryClient.clear()
      refetchMe()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [queryClient, refetchMe, user])

  // Branches (admin gets all 5; warden gets their own)
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches', user?.id],
    queryFn: () => apiFetch<Branch[]>('/api/branches'),
    enabled: !!user,
  })

  // Resolve the active branch once
  useEffect(() => {
    if (!user || !branches) return
    if (user.role === 'ADMIN') {
      const stored = localStorage.getItem('hms.branch')
      const valid = branches.find((b) => b.id === stored)
      const next = (valid ?? branches[0])?.id ?? null
      setBranchId(next)
      setActiveBranch(next)
    } else if (user.role === 'WARDEN' && user.branchId) {
      setBranchId(user.branchId)
      setActiveBranch(user.branchId)
    } else if (user.role === 'RESIDENT' && user.resident) {
      setBranchId(user.resident.branchId)
      setActiveBranch(user.resident.branchId)
    }
  }, [user, branches])

  // ---------------------------------------------------------------- actions
  const isStaff = user?.role === 'ADMIN' || user?.role === 'WARDEN'
  const isResident = user?.role === 'RESIDENT'

  // Reset the section only when the role changes and the current section
  // doesn't belong to the new role's menu (e.g. staff section right after
  // signing in as a resident)
  useEffect(() => {
    if (!user) return
    if (isResident && !RESIDENT_NAV.some((n) => n.key === section)) {
      setSection('myHome')
    } else if (isStaff && !STAFF_NAV.some((n) => n.key === section)) {
      setSection('dashboard')
    }
  }, [user, isResident, isStaff, section])

  const switchBranch = useCallback(
    (id: string) => {
      if (id === branchId) return
      setBranchId(id)
      setActiveBranch(id)
      localStorage.setItem('hms.branch', id)
      // Refetch everything for the new branch
      queryClient.invalidateQueries()
    },
    [branchId, queryClient]
  )

  const toggleTheme = useCallback(() => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }, [dark])

  const logout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore — clearing client state anyway
    }
    queryClient.clear()
    setActiveBranch(null)
    setBranchId(null)
    refetchMe()
  }, [queryClient, refetchMe])

  const changePassword = useCallback(async () => {
    if (!pwCurrent || !pwNext) {
      toast({ title: 'Fill in both password fields', variant: 'destructive' })
      return
    }
    if (pwNext.length < 6) {
      toast({ title: 'New password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setPwSaving(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNext }),
      })
      toast({ title: 'Password changed', description: 'Use the new password next time you sign in.' })
      setPwDialogOpen(false)
      setPwCurrent('')
      setPwNext('')
    } catch (e) {
      toast({ title: 'Could not change password', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setPwSaving(false)
    }
  }, [pwCurrent, pwNext])

  const goTo = useCallback((s: Section) => {
    setSection(s)
    setMobileOpen(false)
  }, [])

  const activeBranch = useMemo(
    () => branches?.find((b) => b.id === branchId) ?? null,
    [branches, branchId]
  )
  const navItems = isResident ? RESIDENT_NAV : STAFF_NAV
  const currentNav =
    navItems.find((n) => n.key === section) ?? navItems[0]

  // ---------------------------------------------------------------- render
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <LoginView
        onLoggedIn={() => {
          queryClient.clear()
          refetchMe()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col lg:flex-row min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <HostelLogo />
          <SidebarNav items={navItems} active={section} onSelect={goTo} />
          <div className="mt-auto px-5 py-5 space-y-2 border-t border-sidebar-border/50">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                  {initials(user.name, user.username)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">
                  {user.name ?? user.username}
                </p>
                <p className="truncate text-[10px] uppercase tracking-wide text-sidebar-foreground/60">
                  {user.role === 'ADMIN' ? 'Super Admin' : user.role === 'WARDEN' ? 'Warden' : 'Resident'}
                  {activeBranch && user.role !== 'RESIDENT' ? ` · ${activeBranch.code}` : ''}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-sidebar-foreground/40">v3.0 · Hostel Management System</p>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-3 border-b bg-background/95 px-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <HostelLogo />
                <SidebarNav items={navItems} active={section} onSelect={goTo} />
                <div className="mt-auto px-5 py-5 border-t border-sidebar-border/50 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-sidebar-border/50 bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={logout}
                    disabled={loggingOut}
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold leading-tight">{currentNav.label}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {currentNav.subtitle}
              </p>
            </div>

            {/* Branch selector (admin only) */}
            {user.role === 'ADMIN' && branches && branches.length > 0 && (
              <Select value={branchId ?? undefined} onValueChange={switchBranch}>
                <SelectTrigger
                  className="hidden sm:flex w-[15rem] ml-auto"
                  aria-label="Switch branch"
                >
                  <MapPin className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Warden badge */}
            {user.role === 'WARDEN' && activeBranch && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground ml-auto">
                <MapPin className="h-3 w-3" />
                {activeBranch.code} — {activeBranch.name}
              </span>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {initials(user.name, user.username)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name ?? user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    @{user.username}
                    {user.resident ? ` · ${user.resident.studentId}` : ''}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPwDialogOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} disabled={loggingOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-4 sm:p-6">
            {isStaff && (
              <>
                {section === 'dashboard' && <DashboardView onNavigate={goTo} />}
                {section === 'students' && <StudentsView />}
                {section === 'rooms' && <RoomsView />}
                {section === 'payments' && <PaymentsView />}
                {section === 'expenses' && <ExpensesView />}
                {section === 'complaints' && <ComplaintsView />}
                {section === 'visitors' && <VisitorsView />}
                {section === 'notices' && <NoticesView />}
                {section === 'messMenu' && <MessMenuView canManage />}
              </>
            )}
            {isResident && user.resident && (
              <>
                {section === 'myHome' && (
                  <ResidentHomeView residentId={user.resident.id} onNavigate={goTo} />
                )}
                {section === 'myPayments' && <ResidentPaymentsView />}
                {section === 'myComplaints' && <ResidentComplaintsView />}
                {section === 'notices' && <ResidentNoticesView />}
                {section === 'messMenu' && <MessMenuView canManage={false} />}
              </>
            )}
          </main>

          <footer className="mt-auto border-t px-6 py-4 text-center text-xs text-muted-foreground">
            Hostel Management System · Nazzal · Nooroxotel · Ayesha · Aqsa · Velvetrose · Next.js,
            Prisma &amp; Neon PostgreSQL
          </footer>
        </div>
      </div>

      {/* Change password dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Choose a new password for your account ({user.username}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-next">New password</Label>
              <Input
                id="pw-next"
                type="password"
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={changePassword} disabled={pwSaving}>
              {pwSaving ? 'Saving…' : 'Update password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
