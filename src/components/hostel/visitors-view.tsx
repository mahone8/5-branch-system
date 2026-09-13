'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DoorOpen, DoorClosed, Plus, Search, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { apiFetch, useApiMutation, getActiveBranchId } from './api-helpers'
import { EmptyState } from './shared'
import type { Visitor, Student } from '@/lib/types'
import { formatDateTime } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function VisitorsView() {
  const [search, setSearch] = useState('')
  const [onlyInside, setOnlyInside] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', studentId: '', purpose: '' })
  const [saving, setSaving] = useState(false)

  const { data: visitors, isLoading } = useQuery<Visitor[]>({
    queryKey: ['visitors', getActiveBranchId()],
    queryFn: () => apiFetch<Visitor[]>('/api/visitors'),
  })

  const { data: students } = useQuery<Student[]>({
    queryKey: ['students', getActiveBranchId()],
    queryFn: () => apiFetch<Student[]>('/api/students?status=ACTIVE'),
  })

  const filtered = useMemo(() => {
    if (!visitors) return []
    const q = search.trim().toLowerCase()
    return visitors.filter((v) => {
      if (onlyInside && v.checkOut) return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) ||
        v.student.name.toLowerCase().includes(q) ||
        (v.phone ?? '').includes(q)
      )
    })
  }, [visitors, search, onlyInside])

  const insideCount = (visitors ?? []).filter((v) => !v.checkOut).length

  const checkOutVisitor = useApiMutation<Visitor, Visitor>(
    (v) =>
      apiFetch<Visitor>(`/api/visitors/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'checkOut' }),
      }),
    {
      invalidate: ['visitors', 'dashboard'],
      successMessage: 'Visitor checked out',
    }
  )

  const submit = async () => {
    if (!form.name || !form.studentId) {
      toast({
        title: 'Missing required fields',
        description: 'Visitor name and host student are required.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/visitors', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast({ title: 'Visitor logged', description: `${form.name} has checked in.` })
      setDialogOpen(false)
      setForm({ name: '', phone: '', studentId: '', purpose: '' })
    } catch (e) {
      toast({
        title: 'Could not log visitor',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search visitors or hosts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search visitors"
          />
        </div>
        <Button
          variant={onlyInside ? 'default' : 'outline'}
          className="min-h-[44px]"
          onClick={() => setOnlyInside(!onlyInside)}
        >
          <DoorOpen className="mr-2 h-4 w-4" />
          Currently inside ({insideCount})
        </Button>
        <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Log Visitor
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-10 w-10" />}
          title="No visitor logs"
          description={
            onlyInside
              ? 'No visitors are currently inside the hostel.'
              : 'Log a visitor check-in to start the register.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => {
            const inside = !v.checkOut
            return (
              <li
                key={v.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4',
                  inside && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    inside
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {inside ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    {inside && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Inside</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Visiting {v.student.name}
                    {v.student.room?.roomNumber ? ` · ${v.student.room.roomNumber}` : ''}
                    {v.phone ? ` · ${v.phone}` : ''}
                  </p>
                  {v.purpose && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80 italic">
                      {v.purpose}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-xs text-muted-foreground">
                    <p>In: {formatDateTime(v.checkIn)}</p>
                    <p>Out: {v.checkOut ? formatDateTime(v.checkOut) : '—'}</p>
                  </div>
                  {inside && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => checkOutVisitor.mutate(v)}
                      disabled={checkOutVisitor.isPending}
                    >
                      <LogOut className="mr-1.5 h-3.5 w-3.5" /> Check Out
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {visitors?.length ?? 0} entries
      </p>

      {/* Log visitor dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Visitor Check-In</DialogTitle>
            <DialogDescription>
              Record a guest entering the hostel to meet a resident.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitorName">Visitor Name *</Label>
              <Input
                id="visitorName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Rajesh Sharma"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitorPhone">Phone</Label>
              <Input
                id="visitorPhone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="98765 00001"
              />
            </div>
            <div className="space-y-2">
              <Label>Visiting (Host Student) *</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {(students ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.studentId}
                      {s.room ? ` · ${s.room.roomNumber}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of Visit</Label>
              <Input
                id="purpose"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="Parent visiting — brought medicines"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Check In Visitor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
