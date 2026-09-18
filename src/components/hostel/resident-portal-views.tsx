'use client'

/**
 * Resident self-service views: payments, complaints, notices.
 * All data is scoped to the signed-in resident by the API.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IndianRupee,
  MessageSquareWarning,
  Plus,
  Megaphone,
  ReceiptText,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import type { Payment, Complaint, Notice } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  monthLabel,
  CATEGORIES,
  complaintWhatsAppUrl,
} from '@/lib/types'
import { apiFetch, useApiMutation } from './api-helpers'
import { StatusBadge, PriorityBadge, EmptyState, WhatsAppShareButton } from './shared'
import { openPaymentReceipt } from './receipt'

// ---------------------------------------------------------------- payments

export function ResidentPaymentsView() {
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ['myPayments'],
    queryFn: () => apiFetch<Payment[]>('/api/payments'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  if (!payments || payments.length === 0) {
    return (
      <EmptyState
        icon={<IndianRupee className="h-10 w-10" />}
        title="No payment records yet"
        description="Your monthly rent dues will appear here once the office generates them."
      />
    )
  }

  const pending = payments.filter((p) => p.status !== 'PAID')

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card className="border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="text-sm">
              <span className="font-semibold">
                {formatCurrency(pending.reduce((s, p) => s + p.amount, 0))}
              </span>{' '}
              outstanding across {pending.length} month{pending.length > 1 ? 's' : ''}. Please pay
              at the hostel office (cash / UPI / bank transfer).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card max-h-[calc(100vh-14rem)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Method</TableHead>
              <TableHead className="hidden sm:table-cell">Paid on</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{monthLabel(p.month)}</TableCell>
                <TableCell>{formatCurrency(p.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {p.method ? p.method.replace('_', ' ') : '—'}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {formatDate(p.paidAt)}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === 'PAID' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        try {
                          openPaymentReceipt(p)
                        } catch (e) {
                          toast({ title: 'Could not open receipt', description: (e as Error).message, variant: 'destructive' })
                        }
                      }}
                    >
                      <ReceiptText className="mr-1.5 h-3.5 w-3.5" /> Receipt
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- complaints

export function ResidentComplaintsView() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ['myComplaints'],
    queryFn: () => apiFetch<Complaint[]>('/api/complaints'),
  })

  const submit = async () => {
    if (!title.trim() || !description.trim() || !category) {
      toast({
        title: 'Please fill in all fields',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const created = await apiFetch<Complaint>('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      })
      await queryClient.invalidateQueries({ queryKey: ['myComplaints'] })
      toast({
        title: 'Request submitted',
        description: 'The hostel office has been notified.',
        action: (
          <ToastAction
            altText="Send complaint via WhatsApp"
            onClick={() => window.open(complaintWhatsAppUrl(created), '_blank', 'noopener')}
          >
            Send via WhatsApp
          </ToastAction>
        ),
      })
      setDialogOpen(false)
      setTitle('')
      setDescription('')
      setCategory('')
    } catch (e) {
      toast({
        title: 'Could not submit request',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !complaints || complaints.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="h-10 w-10" />}
          title="No requests yet"
          description="Found something broken? Submit a maintenance request and the office will handle it."
        />
      ) : (
        <ul className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
          {complaints.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.category} · {formatDate(c.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  <PriorityBadge priority={c.priority} />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-3 flex justify-end">
                <WhatsAppShareButton complaint={c} label="Forward via WhatsApp" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New maintenance request</DialogTitle>
            <DialogDescription>
              Describe the issue — it will be filed under your name and room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-title">Title *</Label>
              <Input
                id="c-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ceiling fan making noise"
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Description *</Label>
              <Textarea
                id="c-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the issue in a sentence or two…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------- notices

export function ResidentNoticesView() {
  const { data: notices, isLoading } = useQuery<Notice[]>({
    queryKey: ['notices'],
    queryFn: () => apiFetch<Notice[]>('/api/notices'),
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  if (!notices || notices.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="h-10 w-10" />}
        title="No notices right now"
        description="Announcements from your branch office will appear here."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {notices.map((n) => (
        <Card key={n.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{n.title}</CardTitle>
              <StatusBadge status={n.priority} />
            </div>
            <CardDescription>{formatDate(n.createdAt)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{n.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
