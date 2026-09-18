'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Wallet,
  CalendarDays,
  ListOrdered,
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
import { EmptyState } from './shared'
import type { Expense } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  currentMonth,
  monthLabel,
  EXPENSE_CATEGORIES,
  expenseCategoryIcon,
  expenseCategoryLabel,
} from '@/lib/types'

function localMonthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesView() {
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState(currentMonth())
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'OTHER',
    amount: '',
    paidTo: '',
    spentAt: new Date().toISOString().slice(0, 10),
    note: '',
  })

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', getActiveBranchId()],
    queryFn: () => apiFetch<Expense[]>('/api/expenses'),
  })

  const months = useMemo(() => {
    const set = new Set<string>((expenses ?? []).map((e) => localMonthKey(e.spentAt)))
    set.add(currentMonth())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [expenses])

  const filtered = useMemo(() => {
    if (!expenses) return []
    const q = search.trim().toLowerCase()
    return expenses.filter((e) => {
      if (monthFilter !== 'ALL' && localMonthKey(e.spentAt) !== monthFilter) return false
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false
      if (!q) return true
      return (
        e.title.toLowerCase().includes(q) ||
        (e.paidTo ?? '').toLowerCase().includes(q) ||
        (e.note ?? '').toLowerCase().includes(q)
      )
    })
  }, [expenses, search, monthFilter, categoryFilter])

  const stats = useMemo(() => {
    const list = expenses ?? []
    const monthList = list.filter((e) => localMonthKey(e.spentAt) === currentMonth())
    const byCategory = new Map<string, number>()
    for (const e of monthFilter === 'ALL'
      ? monthList
      : list.filter((e) => localMonthKey(e.spentAt) === monthFilter)) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    }
    return {
      monthTotal: monthList.reduce((s, e) => s + e.amount, 0),
      monthCount: monthList.length,
      allTimeTotal: list.reduce((s, e) => s + e.amount, 0),
      byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [expenses, monthFilter])

  const addExpense = useApiMutation<typeof form, Expense>(
    (data) =>
      apiFetch<Expense>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    { invalidate: ['expenses', 'dashboard'], successMessage: 'Expense recorded' }
  )

  const removeExpense = useApiMutation<Expense, unknown>(
    (e) => apiFetch(`/api/expenses/${e.id}`, { method: 'DELETE' }),
    { invalidate: ['expenses', 'dashboard'], successMessage: 'Expense deleted' }
  )

  const submit = async () => {
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) {
      toast({
        title: 'Missing required fields',
        description: 'Title and a positive amount are required.',
        variant: 'destructive',
      })
      return
    }
    addExpense.mutate({
      ...form,
      title: form.title.trim(),
      paidTo: form.paidTo.trim(),
      note: form.note.trim(),
      spentAt: form.spentAt ? new Date(`${form.spentAt}T12:00:00`).toISOString() : undefined,
    } as typeof form)
    setDialogOpen(false)
    setForm({
      title: '',
      category: 'OTHER',
      amount: '',
      paidTo: '',
      spentAt: new Date().toISOString().slice(0, 10),
      note: '',
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Spent This Month</p>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(stats.monthTotal)}
          </p>
          <p className="text-xs text-muted-foreground">{monthLabel(currentMonth())}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Entries This Month</p>
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{stats.monthCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">All-Time Total</p>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{formatCurrency(stats.allTimeTotal)}</p>
        </div>
      </div>

      {/* Category breakdown for the selected month */}
      {stats.byCategory.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {monthFilter === 'ALL' ? `${monthLabel(currentMonth())} by category:` : `${monthLabel(monthFilter)} by category:`}
          </span>
          {stats.byCategory.map(([cat, amount]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs"
            >
              {expenseCategoryIcon(cat)} {expenseCategoryLabel(cat)}
              <span className="font-medium">{formatCurrency(amount)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, vendor or note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search expenses"
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="min-h-[44px]" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
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
          icon={<TrendingDown className="h-10 w-10" />}
          title="No expenses recorded"
          description={
            search || monthFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'Try adjusting your search or filters.'
              : 'Record what the branch spends — bills, salaries, repairs — to track monthly costs.'
          }
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-auto max-h-[calc(100vh-24rem)]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Paid To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Recorded By</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    {formatDate(e.spentAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{e.title}</div>
                    {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs">
                      {expenseCategoryIcon(e.category)} {expenseCategoryLabel(e.category)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{e.paidTo ?? '—'}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {e.recorder?.name ?? e.recorder?.username ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 text-destructive hover:text-destructive"
                      onClick={() => removeExpense.mutate(e)}
                      disabled={removeExpense.isPending}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {expenses?.length ?? 0} expense records · total shown:{' '}
        <span className="font-medium text-foreground">{formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}</span>
      </p>

      {/* Add expense dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Branch Expense</DialogTitle>
            <DialogDescription>
              Record money spent on this branch — utilities, salaries, repairs, supplies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exp-title">Title *</Label>
              <Input
                id="exp-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Electricity bill — August"
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
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Amount (Rs) *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-paidto">Paid To</Label>
                <Input
                  id="exp-paidto"
                  value={form.paidTo}
                  onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
                  placeholder="Vendor / person"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.spentAt}
                  onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-note">Note</Label>
              <Textarea
                id="exp-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Optional details…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={addExpense.isPending}>
              {addExpense.isPending ? 'Saving…' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
