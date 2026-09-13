'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Search,
  BedDouble,
  Pencil,
  Trash2,
  Wrench,
  CircleCheck,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch, useApiMutation, getActiveBranchId } from './api-helpers'
import { StatusBadge, EmptyState } from './shared'
import type { Room } from '@/lib/types'
import { formatCurrency, ROOM_TYPES, roomTypeLabel } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RoomForm {
  roomNumber: string
  floor: string
  type: string
  monthlyFee: string
}

const EMPTY_FORM: RoomForm = {
  roomNumber: '',
  floor: '1',
  type: 'SINGLE',
  monthlyFee: '30000',
}

// Default monthly fee per room type (Rs) — prefilled when the type changes
const FEE_BY_TYPE: Record<string, number> = {
  SINGLE: 30000,
  DOUBLE: 22000,
  TRIPLE: 15000,
}

function RoomCard({
  room,
  onEdit,
  onDelete,
  onToggleMaintenance,
}: {
  room: Room
  onEdit: () => void
  onDelete: () => void
  onToggleMaintenance: () => void
}) {
  const typeLabel = roomTypeLabel(room.type)
  const occupantsByBed = new Map<number, string>()
  for (const s of room.students ?? []) {
    if (s.bedNumber) occupantsByBed.set(s.bedNumber, s.name)
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold">{room.roomNumber}</p>
            <Badge variant="secondary">{typeLabel}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Floor {room.floor} · {formatCurrency(room.monthlyFee)}/mo
          </p>
        </div>
        <StatusBadge status={room.status} />
      </div>

      {/* Bed list — beds are labelled plainly: Bed 1, Bed 2, Bed 3 */}
      <div className="mt-3 space-y-1.5">
        {Array.from({ length: room.capacity }).map((_, i) => {
          const bed = i + 1
          const occupant = occupantsByBed.get(bed)
          return occupant ? (
            <div
              key={bed}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium">Bed {bed}</span>
              <span className="truncate text-muted-foreground" title={occupant}>
                {occupant}
              </span>
            </div>
          ) : (
            <div
              key={bed}
              className={cn(
                'flex items-center justify-between rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground',
                room.status === 'MAINTENANCE' && 'opacity-40'
              )}
            >
              <span>Bed {bed}</span>
              <span className="text-emerald-600 dark:text-emerald-400">Available</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1"
          onClick={onToggleMaintenance}
          disabled={room.occupied > 0 && room.status !== 'MAINTENANCE'}
          title={
            room.occupied > 0 && room.status !== 'MAINTENANCE'
              ? 'Room must be empty to go into maintenance'
              : undefined
          }
        >
          {room.status === 'MAINTENANCE' ? (
            <>
              <CircleCheck className="mr-1.5 h-3.5 w-3.5" /> Back in service
            </>
          ) : (
            <>
              <Wrench className="mr-1.5 h-3.5 w-3.5" /> Maintenance
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onEdit} aria-label={`Edit room ${room.roomNumber}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete room ${room.roomNumber}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function RoomsView() {
  const [search, setSearch] = useState('')
  const [blockFilter, setBlockFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ['rooms', getActiveBranchId()],
    queryFn: () => apiFetch<Room[]>('/api/rooms'),
  })

  const blocks = useMemo(
    () => Array.from(new Set((rooms ?? []).map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  )

  const filtered = useMemo(() => {
    if (!rooms) return []
    const q = search.trim().toLowerCase()
    return rooms.filter((r) => {
      if (blockFilter !== 'ALL' && r.floor !== Number(blockFilter)) return false
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.roomNumber.toLowerCase().includes(q) ||
        (r.students ?? []).some(
          (s) => s.name.toLowerCase().includes(q) || `bed ${s.bedNumber}`.includes(q)
        )
      )
    })
  }, [rooms, search, blockFilter, typeFilter, statusFilter])

  const stats = useMemo(() => {
    const totalBeds = (rooms ?? []).reduce((s, r) => s + r.capacity, 0)
    const occupied = (rooms ?? []).reduce((s, r) => s + r.occupied, 0)
    return { totalBeds, occupied, free: totalBeds - occupied }
  }, [rooms])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (r: Room) => {
    setEditing(r)
    setForm({
      // Strip the branch prefix when editing (the server re-adds it)
      roomNumber: r.roomNumber.includes('-')
        ? r.roomNumber.split('-').slice(1).join('-')
        : r.roomNumber,
      floor: String(r.floor),
      type: r.type,
      monthlyFee: String(r.monthlyFee),
    })
    setDialogOpen(true)
  }

  const saveRoom = async () => {
    if (!form.roomNumber || !form.floor || !form.type) {
      toast({
        title: 'Missing required fields',
        description: 'Room number, floor and room type are required.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload = {
        roomNumber: form.roomNumber,
        floor: Number(form.floor),
        type: form.type,
        monthlyFee: Number(form.monthlyFee) || 0,
      }
      if (editing) {
        await apiFetch(`/api/rooms/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast({ title: 'Room updated', description: `Room ${form.roomNumber} was saved.` })
      } else {
        await apiFetch('/api/rooms', { method: 'POST', body: JSON.stringify(payload) })
        toast({ title: 'Room added', description: `Room ${form.roomNumber} is ready for allocation.` })
      }
      setDialogOpen(false)
    } catch (e) {
      toast({
        title: 'Could not save room',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleMaintenance = useApiMutation<Room, Room>(
    (r) =>
      apiFetch<Room>(`/api/rooms/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: r.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE',
        }),
      }),
    {
      invalidate: ['rooms', 'dashboard'],
      successMessage: 'Room status updated',
    }
  )

  const removeRoom = useApiMutation<Room, unknown>(
    (r) => apiFetch(`/api/rooms/${r.id}`, { method: 'DELETE' }),
    {
      invalidate: ['rooms', 'students', 'dashboard'],
      successMessage: 'Room deleted',
      onSuccess: () => setDeleteTarget(null),
    }
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rooms or residents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search rooms"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={blockFilter} onValueChange={setBlockFilter}>
            <SelectTrigger className="w-full lg:w-36" aria-label="Filter by floor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All floors</SelectItem>
              {blocks.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  Floor {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-40" aria-label="Filter by room type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All room types</SelectItem>
              {ROOM_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openAdd} className="min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" /> Add Room
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Beds</p>
          <p className="text-xl font-bold">{stats.totalBeds}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Occupied</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.occupied}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="text-xl font-bold">{stats.free}</p>
        </div>
      </div>

      {/* Room grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="h-10 w-10" />}
          title={search || blockFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No matching rooms' : 'No rooms yet'}
          description={
            search || blockFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your filters.'
              : 'Create your first room to start allocating beds.'
          }
          action={
            !search && blockFilter === 'ALL' && typeFilter === 'ALL' && statusFilter === 'ALL' ? (
              <Button onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" /> Add Room
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              onEdit={() => openEdit(r)}
              onDelete={() => setDeleteTarget(r)}
              onToggleMaintenance={() => toggleMaintenance.mutate(r)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Room ${editing.roomNumber}` : 'Add New Room'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update room configuration. The room type sets the bed count.'
                : 'The hostel offers 1-seater, 2-seater and 3-seater rooms.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roomNumber">Room Number *</Label>
              <Input
                id="roomNumber"
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value.toUpperCase() })}
                placeholder="106"
              />
              <p className="text-[11px] text-muted-foreground">
                Saved with the branch prefix automatically (e.g. NZL-106).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor">Floor *</Label>
              <Input
                id="floor"
                type="number"
                min={0}
                max={10}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Room Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  // The type decides the number of beds; suggest its default fee
                  setForm({ ...form, type: v, monthlyFee: String(FEE_BY_TYPE[v] ?? form.monthlyFee) })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} · {t.capacity} bed{t.capacity > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyFee">Monthly Fee (Rs) *</Label>
              <Input
                id="monthlyFee"
                type="number"
                min={0}
                step={500}
                value={form.monthlyFee}
                onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRoom} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room {deleteTarget?.roomNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Historical resident records will be kept but detached from this room. Rooms with
              active residents cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && removeRoom.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
