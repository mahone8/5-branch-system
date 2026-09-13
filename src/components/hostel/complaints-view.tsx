'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquareWarning,
  Plus,
  Search,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { toast } from '@/hooks/use-toast'
import { apiFetch, useApiMutation, getActiveBranchId } from './api-helpers'
import { StatusBadge, PriorityBadge, EmptyState } from './shared'
import type { Complaint, Student } from '@/lib/types'
import { formatDateTime, CATEGORIES } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<string, string> = {
  ELECTRICAL: '⚡',
  PLUMBING: '🚿',
  CLEANLINESS: '🧹',
  FURNITURE: '🪑',
  INTERNET: '📶',
  OTHER: '📋',
}

const STATUS_FLOW: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED', 'OPEN'],
  RESOLVED: ['OPEN'],
}

export default function ComplaintsView() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    studentId: '',
    title: '',
    description: '',
    category: 'ELECTRICAL',
    priority: 'MEDIUM',
  })
  const [saving, setSaving] = useState(false)

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ['complaints', getActiveBranchId()],
    queryFn: () => apiFetch<Complaint[]>('/api/complaints'),
  })

  const { data: students } = useQuery<Student[]>({
    queryKey: ['students', getActiveBranchId()],
    queryFn: () => apiFetch<Student[]>('/api/students?status=ACTIVE'),
  })

  const filtered = useMemo(() => {
    if (!complaints) return []
    const q = search.trim().toLowerCase()
    return complaints.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.student.name.toLowerCase().includes(q)
      )
    })
  }, [complaints, search, statusFilter])

  const stats = useMemo(() => {
    const list = complaints ?? []
    return {
      open: list.filter((c) => c.status === 'OPEN').length,
      inProgress: list.filter((c) => c.status === 'IN_PROGRESS').length,
      resolved: list.filter((c) => c.status === 'RESOLVED').length,
    }
  }, [complaints])

  const updateStatus = useApiMutation<{ complaint: Complaint; status: string }, Complaint>(
    ({ complaint, status }) =>
      apiFetch<Complaint>(`/api/complaints/${complaint.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    { invalidate: ['complaints', 'dashboard'] }
  )

  const removeComplaint = useApiMutation<Complaint, unknown>(
    (c) => apiFetch(`/api/complaints/${c.id}`, { method: 'DELETE' }),
    {
      invalidate: ['complaints', 'dashboard'],
      successMessage: 'Complaint deleted',
    }
  )

  const submit = async () => {
    if (!form.studentId || !form.title || !form.description) {
      toast({
        title: 'Missing required fields',
        description: 'Student, title and description are required.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/complaints', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast({ title: 'Complaint filed', description: 'The maintenance team has been notified.' })
      setDialogOpen(false)
      setForm({ studentId: '', title: '', description: '', category: 'ELECTRICAL', priority: 'MEDIUM' })
    } catch (e) {
      toast({
        title: 'Could not file complaint',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.open}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">In Progress</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Resolved</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.resolved}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search complaints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search complaints"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> File Complaint
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="h-10 w-10" />}
          title="No complaints found"
          description={
            search || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filters.'
              : 'File a complaint to track maintenance issues.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => {
            const isOpen = expanded === c.id
            const nextStatuses = STATUS_FLOW[c.status] ?? []
            return (
              <li key={c.id} className="rounded-xl border bg-card">
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  aria-expanded={isOpen}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                    {CATEGORY_ICONS[c.category] ?? '📋'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.student.name} · {c.category.toLowerCase()} · {formatDateTime(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    <ChevronRight
                      className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-4">
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextStatuses.map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant={next === 'RESOLVED' ? 'default' : 'outline'}
                          className="h-9"
                          onClick={() => updateStatus.mutate({ complaint: c, status: next })}
                          disabled={updateStatus.isPending}
                        >
                          Mark {next === 'IN_PROGRESS' ? 'In Progress' : next === 'RESOLVED' ? 'Resolved' : 'Reopen'}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 text-destructive hover:text-destructive"
                        onClick={() => removeComplaint.mutate(c)}
                        disabled={removeComplaint.isPending}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* File complaint dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>File a Complaint</DialogTitle>
            <DialogDescription>
              Report a maintenance issue on behalf of a resident.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
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
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ceiling fan making noise"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {CATEGORY_ICONS[c.value]} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the issue in detail…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Submitting…' : 'File Complaint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
