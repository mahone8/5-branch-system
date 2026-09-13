'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Users,
  Pencil,
  LogOut,
  Trash2,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import CredentialsDialog from './credentials-dialog'
import type { Student, Room, ResidentAccount } from '@/lib/types'
import { formatDate, ROOM_TYPES } from '@/lib/types'

interface StudentForm {
  name: string
  email: string
  phone: string
  gender: string
  cnic: string
  university: string
  course: string
  department: string
  guardianName: string
  guardianPhone: string
  address: string
  roomId: string
  bedNumber: string
}

const EMPTY_FORM: StudentForm = {
  name: '',
  email: '',
  phone: '',
  gender: '',
  cnic: '',
  university: '',
  course: '',
  department: '',
  guardianName: '',
  guardianPhone: '',
  address: '',
  roomId: '',
  bedNumber: '',
}

export default function StudentsView() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState<ResidentAccount | null>(null)
  const [credentialsFor, setCredentialsFor] = useState<string | undefined>(undefined)

  const { data: students, isLoading } = useQuery<Student[]>({
    queryKey: ['students', getActiveBranchId()],
    queryFn: () => apiFetch<Student[]>('/api/students'),
  })

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ['rooms', getActiveBranchId()],
    queryFn: () => apiFetch<Room[]>('/api/rooms'),
  })

  const filtered = useMemo(() => {
    if (!students) return []
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      const statusOk =
        statusFilter === 'ALL' ||
        (statusFilter === 'UNALLOCATED' ? s.status === 'ACTIVE' && !s.roomId : s.status === statusFilter)
      if (!statusOk) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.room?.roomNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [students, search, statusFilter])

  // Rooms selectable for allocation. In edit mode the resident's current room
  // stays selectable (their own bed remains available to them).
  const roomOptions = useMemo(() => {
    if (!rooms) return []
    return rooms.filter(
      (r) =>
        r.status !== 'MAINTENANCE' &&
        (r.occupied < r.capacity || (editing && r.id === editing.roomId))
    )
  }, [rooms, editing])

  const selectedRoom = useMemo(
    () => roomOptions.find((r) => r.id === form.roomId) ?? null,
    [roomOptions, form.roomId]
  )

  // Beds in the selected room that are free — labelled plainly as Bed 1, Bed 2, …
  const availableBeds = useMemo(() => {
    if (!selectedRoom) return []
    const taken = new Set(
      (selectedRoom.students ?? []).map((s) => s.bedNumber ?? 0).filter((n) => n > 0)
    )
    // In edit mode the resident keeps their own bed as an option
    if (editing && editing.roomId === selectedRoom.id && editing.bedNumber) {
      taken.delete(editing.bedNumber)
    }
    const beds: number[] = []
    for (let i = 1; i <= selectedRoom.capacity; i++) {
      if (!taken.has(i)) beds.push(i)
    }
    return beds
  }, [selectedRoom, editing])

  // Keep the chosen bed valid whenever the room changes
  const onRoomChange = (roomId: string) => {
    const room = roomOptions.find((r) => r.id === roomId)
    let bed = form.bedNumber
    if (room) {
      const taken = new Set((room.students ?? []).map((s) => s.bedNumber ?? 0).filter((n) => n > 0))
      if (editing && editing.roomId === room.id && editing.bedNumber) taken.delete(editing.bedNumber)
      const free: number[] = []
      for (let i = 1; i <= room.capacity; i++) if (!taken.has(i)) free.push(i)
      bed = free.includes(Number(form.bedNumber)) ? form.bedNumber : String(free[0] ?? '')
    } else {
      bed = ''
    }
    setForm({ ...form, roomId, bedNumber: bed })
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone,
      gender: s.gender,
      cnic: s.cnic ?? '',
      university: s.university ?? '',
      course: s.course ?? '',
      department: s.department ?? '',
      guardianName: s.guardianName ?? '',
      guardianPhone: s.guardianPhone ?? '',
      address: s.address ?? '',
      roomId: s.roomId ?? 'none',
      bedNumber: s.bedNumber ? String(s.bedNumber) : '',
    })
    setDialogOpen(true)
  }

  const saveStudent = async () => {
    if (!form.name || !form.phone || !form.gender) {
      toast({
        title: 'Missing required fields',
        description: 'Name, phone and gender are required.',
        variant: 'destructive',
      })
      return
    }
    if (!form.university.trim()) {
      toast({
        title: 'University required',
        description: 'Enter the resident’s university name.',
        variant: 'destructive',
      })
      return
    }
    const cnicDigits = form.cnic.replace(/[^0-9]/g, '')
    if (cnicDigits.length !== 13) {
      toast({
        title: 'Invalid CNIC',
        description: 'CNIC must have 13 digits, e.g. 35202-1234567-1.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        roomId: form.roomId === 'none' || form.roomId === '' ? null : form.roomId,
        bedNumber: form.bedNumber ? Number(form.bedNumber) : undefined,
      }
      if (editing) {
        // Room/bed change is handled through a separate re-allocation PATCH
        const { roomId: _ignored, bedNumber: _bed, ...rest } = payload
        void _ignored
        void _bed
        await apiFetch(`/api/students/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(rest),
        })
        // Handle room / bed re-allocation if changed
        const desiredRoom = form.roomId === 'none' ? null : form.roomId
        const desiredBed = form.bedNumber ? Number(form.bedNumber) : null
        const roomChanged = desiredRoom !== (editing.roomId ?? null)
        const bedChanged = desiredBed !== (editing.bedNumber ?? null)
        if (roomChanged || (desiredRoom && bedChanged)) {
          await apiFetch(`/api/students/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              roomId: desiredRoom,
              ...(desiredRoom ? { bedNumber: desiredBed } : {}),
            }),
          })
        }
        toast({ title: 'Student updated', description: `${form.name}'s details were saved.` })
      } else {
        const res = await apiFetch<{ student: Student; account: ResidentAccount }>(
          '/api/students',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
        toast({
          title: 'Student checked in',
          description: `${res.student.name} registered as ${res.student.studentId}.`,
        })
        setCredentials(res.account)
        setCredentialsFor(res.student.name)
      }
      setDialogOpen(false)
    } catch (e) {
      toast({
        title: 'Could not save student',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const checkOut = useApiMutation<Student, Student>(
    (s) =>
      apiFetch<Student>(`/api/students/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'checkOut' }),
      }),
    {
      invalidate: ['students', 'rooms', 'dashboard'],
      successMessage: 'Checked out — bed released',
    }
  )

  const removeStudent = useApiMutation<Student, unknown>(
    (s) => apiFetch(`/api/students/${s.id}`, { method: 'DELETE' }),
    {
      invalidate: ['students', 'rooms', 'dashboard', 'payments', 'complaints', 'visitors'],
      successMessage: 'Student record deleted',
      onSuccess: () => setDeleteTarget(null),
    }
  )

  const resetPassword = useApiMutation<Student, { account: ResidentAccount }>(
    (s) =>
      apiFetch<{ account: ResidentAccount }>(`/api/students/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'resetPassword' }),
      }),
    {
      invalidate: ['students'],
      onSuccess: (data) => {
        setCredentials(data.account)
        setCredentialsFor(undefined)
      },
    }
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, phone or room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search students"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="UNALLOCATED">Active, no room</SelectItem>
            <SelectItem value="CHECKED_OUT">Checked out</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Check In Student
        </Button>
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
          icon={<Users className="h-10 w-10" />}
          title={search || statusFilter !== 'ALL' ? 'No matching students' : 'No students yet'}
          description={
            search || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filters.'
              : 'Check in your first resident to get started.'
          }
          action={
            !search && statusFilter === 'ALL' ? (
              <Button onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" /> Check In Student
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border bg-card max-h-[calc(100vh-16rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead className="hidden md:table-cell">University</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
                <TableHead className="hidden xl:table-cell">Phone</TableHead>
                <TableHead className="hidden sm:table-cell">Since</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.studentId}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">{s.university ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{s.course ?? ''}</div>
                  </TableCell>
                  <TableCell>
                    {s.room ? (
                      <div className="flex flex-col">
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {s.room.roomNumber}
                        </Badge>
                        {s.bedNumber ? (
                          <span className="mt-0.5 text-xs text-muted-foreground">
                            Bed {s.bedNumber}
                          </span>
                        ) : null}
                      </div>
                    ) : s.status === 'ACTIVE' ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Unallocated</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {s.account ? (
                      <div className="text-sm">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {s.account.username}
                        </code>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">{s.phone}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(s.checkInDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resetPassword.mutate(s)}
                        disabled={resetPassword.isPending}
                        aria-label={`Reset account password for ${s.name}`}
                        title="Reset account password"
                        className="h-9 w-9 text-emerald-700 hover:text-emerald-800 dark:text-emerald-500"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        aria-label={`Edit ${s.name}`}
                        className="h-9 w-9"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {s.status === 'ACTIVE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => checkOut.mutate(s)}
                          disabled={checkOut.isPending}
                          aria-label={`Check out ${s.name}`}
                          title="Check out"
                          className="h-9 w-9 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(s)}
                        aria-label={`Delete ${s.name}`}
                        className="h-9 w-9 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {students?.length ?? 0} students
      </p>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Check In New Student'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update resident details. Use the room field to re-allocate.'
                : 'Fill in the resident details to register them into the hostel.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {!editing && (
              <div className="space-y-2 sm:col-span-2">
                <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  The resident ID and login account are generated automatically on check-in —
                  you&apos;ll see the credentials once the form is saved.
                </p>
              </div>
            )}
            {editing && (
              <div className="space-y-2">
                <Label>Resident ID</Label>
                <Input value={editing.studentId} disabled />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Hamza Tariq"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0300 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnic">CNIC *</Label>
              <Input
                id="cnic"
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                placeholder="35202-1234567-1"
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground">
                13-digit national ID card number, with or without dashes.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="university">University *</Label>
              <Input
                id="university"
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                placeholder="COMSATS University Islamabad"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@university.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course / Program</Label>
              <Input
                id="course"
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                placeholder="BS Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label>Room &amp; Bed</Label>
              <Select value={form.roomId || 'none'} onValueChange={onRoomChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room (unallocated)</SelectItem>
                  {roomOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.roomNumber} · {ROOM_TYPES.find((t) => t.value === r.type)?.label ?? r.type} ·
                      Rs {r.monthlyFee.toLocaleString()}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRoom && (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="bed">Bed</Label>
                  <Select
                    value={form.bedNumber || String(availableBeds[0] ?? '')}
                    onValueChange={(v) => setForm({ ...form, bedNumber: v })}
                  >
                    <SelectTrigger id="bed">
                      <SelectValue placeholder="Choose a bed" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBeds.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Bed {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianName">Guardian Name</Label>
              <Input
                id="guardianName"
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                placeholder="Tariq Mehmood"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianPhone">Guardian Phone</Label>
              <Input
                id="guardianPhone"
                value={form.guardianPhone}
                onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                placeholder="0301 7654321"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Home Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="House 21, Street 4, Model Town, Lahore"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveStudent} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Check In Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal generated / reset credentials */}
      <CredentialsDialog
        open={!!credentials}
        onClose={() => {
          setCredentials(null)
          setCredentialsFor(undefined)
        }}
        account={credentials}
        residentName={credentialsFor}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.name} ({deleteTarget?.studentId}) along with
              their payment records, complaints and visitor logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && removeStudent.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
