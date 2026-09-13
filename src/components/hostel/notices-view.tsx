'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2, Pin } from 'lucide-react'
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
import { StatusBadge, EmptyState } from './shared'
import type { Notice } from '@/lib/types'
import { formatDate } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  NORMAL: 'border-l-muted',
  IMPORTANT: 'border-l-amber-400',
  URGENT: 'border-l-red-500',
}

export default function NoticesView() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', priority: 'NORMAL' })
  const [saving, setSaving] = useState(false)

  const { data: notices, isLoading } = useQuery<Notice[]>({
    queryKey: ['notices', getActiveBranchId()],
    queryFn: () => apiFetch<Notice[]>('/api/notices'),
  })

  const removeNotice = useApiMutation<Notice, unknown>(
    (n) => apiFetch(`/api/notices/${n.id}`, { method: 'DELETE' }),
    {
      invalidate: ['notices', 'dashboard'],
      successMessage: 'Notice removed',
    }
  )

  const submit = async () => {
    if (!form.title || !form.content) {
      toast({
        title: 'Missing required fields',
        description: 'Title and content are required.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/notices', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast({ title: 'Notice published', description: 'Residents can now see the announcement.' })
      setDialogOpen(false)
      setForm({ title: '', content: '', priority: 'NORMAL' })
    } catch (e) {
      toast({
        title: 'Could not publish notice',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Publish Notice
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !notices || notices.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No notices published"
          description="Publish an announcement to keep residents informed."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Publish Notice
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {notices.map((n) => (
            <li
              key={n.id}
              className={cn(
                'flex flex-col rounded-xl border border-l-4 bg-card p-4',
                PRIORITY_STYLES[n.priority] ?? 'border-l-muted'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {n.priority !== 'NORMAL' && (
                      <Pin className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <h3 className="truncate text-sm font-semibold">{n.title}</h3>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
                <StatusBadge status={n.priority} />
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {n.content}
              </p>
              <div className="mt-3 flex justify-end border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={() => removeNotice.mutate(n)}
                  disabled={removeNotice.isPending}
                  aria-label={`Delete notice ${n.title}`}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Publish dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish Notice</DialogTitle>
            <DialogDescription>
              Announcements appear on the dashboard for all residents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="noticeTitle">Title *</Label>
              <Input
                id="noticeTitle"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Water supply maintenance on Sunday"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="IMPORTANT">Important</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noticeContent">Content *</Label>
              <Textarea
                id="noticeContent"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Write the announcement details…"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
