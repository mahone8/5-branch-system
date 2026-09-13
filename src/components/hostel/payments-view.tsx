'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IndianRupee,
  Plus,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch, useApiMutation, getActiveBranchId } from './api-helpers'
import { StatusBadge, EmptyState } from './shared'
import type { Payment, Student } from '@/lib/types'
import { formatCurrency, monthLabel, formatDate, currentMonth, MONTH_LABELS } from '@/lib/types'

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PaymentsView() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(currentMonth())
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordForm, setRecordForm] = useState({ studentId: '', month: currentMonth(), amount: '', method: 'CASH' })
  const queryClient = useQueryClient()

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ['payments', getActiveBranchId()],
    queryFn: () => apiFetch<Payment[]>('/api/payments'),
  })

  const { data: students } = useQuery<Student[]>({
    queryKey: ['students', getActiveBranchId()],
    queryFn: () => apiFetch<Student[]>('/api/students?status=ACTIVE'),
  })

  const months = useMemo(() => {
    const set = new Set<string>((payments ?? []).map((p) => p.month))
    const list = Array.from(set).sort((a, b) => b.localeCompare(a))
    if (list.length === 0) return [currentMonth()]
    return list
  }, [payments])

  const filtered = useMemo(() => {
    if (!payments) return []
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      const statusOk =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
            ? p.status !== 'PAID'
            : p.status === statusFilter
      if (!statusOk) return false
      if (monthFilter !== 'ALL' && p.month !== monthFilter) return false
      if (!q) return true
      return (
        p.student.name.toLowerCase().includes(q) ||
        p.student.studentId.toLowerCase().includes(q) ||
        (p.student.room?.roomNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [payments, search, statusFilter, monthFilter])

  const stats = useMemo(() => {
    const list = payments ?? []
    const collected = list.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
    const pending = list.filter((p) => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0)
    return { collected, pending }
  }, [payments])

  const markPaid = useApiMutation<Payment, Payment>(
    (p) =>
      apiFetch<Payment>(`/api/payments/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PAID', method: 'CASH' }),
      }),
    {
      invalidate: ['payments', 'dashboard'],
      successMessage: 'Payment marked as paid',
    }
  )

  const generateDues = async () => {
    try {
      const result = await apiFetch<{ created: number; total: number; month: string }>(
        '/api/payments',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'generateDues', month: generateMonth }),
        }
      )
      toast({
        title: `Dues generated for ${monthLabel(generateMonth)}`,
        description:
          result.created > 0
            ? `${result.created} new fee record(s) created for active residents with rooms.`
            : 'All records for this month already exist.',
      })
      setGenerateOpen(false)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast({
        title: 'Could not generate dues',
        description: (e as Error).message,
        variant: 'destructive',
      })
    }
  }

  const saveRecord = async () => {
    if (!recordForm.studentId || !recordForm.amount || !recordForm.month) {
      toast({
        title: 'Missing fields',
        description: 'Student, month and amount are required.',
        variant: 'destructive',
      })
      return
    }
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: recordForm.studentId,
          month: recordForm.month,
          amount: Number(recordForm.amount),
          status: 'PAID',
          method: recordForm.method,
        }),
      })
      toast({ title: 'Payment recorded', description: 'The payment has been saved as paid.' })
      setRecordOpen(false)
      setRecordForm({ studentId: '', month: currentMonth(), amount: '', method: 'CASH' })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      toast({
        title: 'Could not record payment',
        description: (e as Error).message,
        variant: 'destructive',
      })
    }
  }

  const selectedStudent = students?.find((s) => s.id === recordForm.studentId)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{formatCurrency(stats.collected)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Outstanding Dues</p>
            <IndianRupee className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(stats.pending)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Records</p>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{payments?.length ?? 0}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student, ID or room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search payments"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="min-h-[44px]" onClick={() => setGenerateOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Generate Monthly Dues
          </Button>
          <Button className="min-h-[44px]" onClick={() => setRecordOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-10 w-10" />}
          title="No payment records"
          description="Generate monthly dues or record a payment to get started."
          action={
            <Button onClick={() => setGenerateOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Generate Monthly Dues
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-auto max-h-[calc(100vh-24rem)]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Paid On</TableHead>
                <TableHead className="hidden sm:table-cell">Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.student.name}</div>
                    <div className="text-xs text-muted-foreground">{p.student.studentId}</div>
                  </TableCell>
                  <TableCell>
                    {p.student.room ? (
                      <Badge variant="secondary">{p.student.room.roomNumber}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{monthLabel(p.month)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {p.status === 'PAID' ? formatDate(p.paidAt) : '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.method ? (
                      <span className="text-xs text-muted-foreground">
                        {p.method === 'CASH' ? 'Cash' : p.method === 'UPI' ? 'UPI' : 'Bank'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status !== 'PAID' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        onClick={() => markPaid.mutate(p)}
                        disabled={markPaid.isPending}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Paid
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
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {payments?.length ?? 0} payment records
      </p>

      {/* Generate dues dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Monthly Dues</DialogTitle>
            <DialogDescription>
              Creates a pending fee record (at the room&apos;s rate) for every active resident with
              a room allocation. Existing records are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={generateMonth} onValueChange={setGenerateMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[generateMonth, nextMonth(generateMonth)].map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateDues}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Log a fee payment received in cash, UPI or bank transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select
                value={recordForm.studentId}
                onValueChange={(v) => {
                  const st = students?.find((s) => s.id === v)
                  setRecordForm({
                    ...recordForm,
                    studentId: v,
                    amount: st?.room ? String(st.room.monthlyFee) : recordForm.amount,
                  })
                }}
              >
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
              {selectedStudent?.room && (
                <p className="text-xs text-muted-foreground">
                  Room fee: {formatCurrency(selectedStudent.room.monthlyFee)}/month
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month *</Label>
                <Select
                  value={recordForm.month}
                  onValueChange={(v) => setRecordForm({ ...recordForm, month: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.slice(0, 3).map((m) => (
                      <SelectItem key={m} value={m}>
                        {monthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Rs) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={recordForm.method}
                onValueChange={(v) => setRecordForm({ ...recordForm, method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRecord}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
