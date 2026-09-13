'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  UtensilsCrossed,
  Upload,
  Trash2,
  FileText,
  ImageIcon,
  FileDown,
  History,
  Users,
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch, useApiMutation } from './api-helpers'
import { EmptyState } from './shared'
import type { MessMenu } from '@/lib/types'
import { formatDateTime } from '@/lib/types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string) {
  return mime.startsWith('image/')
}

function isPdf(mime: string) {
  return mime === 'application/pdf'
}

function isText(mime: string) {
  return mime.startsWith('text/')
}

/** Renders the menu file inline: image / PDF / plain text. */
function MenuPreview({ menu }: { menu: MessMenu }) {
  const [text, setText] = useState<string | null>(null)
  const isTxt = isText(menu.mimeType)

  useEffect(() => {
    if (!isTxt) return
    let cancelled = false
    fetch(`/api/mess-menu/${menu.id}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Could not load file'))))
      .then((t) => {
        if (!cancelled) setText(t)
      })
      .catch(() => {
        if (!cancelled) setText('Could not load the menu text.')
      })
    return () => {
      cancelled = true
    }
  }, [menu.id, isTxt])

  if (isImage(menu.mimeType)) {
    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        { }
        <img
          src={`/api/mess-menu/${menu.id}`}
          alt={menu.title}
          className="max-h-[70vh] w-full object-contain"
        />
      </div>
    )
  }

  if (isPdf(menu.mimeType)) {
    return (
      <div className="space-y-2">
        <iframe
          src={`/api/mess-menu/${menu.id}`}
          title={menu.title}
          className="h-[70vh] w-full rounded-lg border bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Can&apos;t see the PDF?{' '}
          <a
            href={`/api/mess-menu/${menu.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            Open it in a new tab
          </a>
        </p>
      </div>
    )
  }

  if (isTxt) {
    return (
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
        {text ?? 'Loading menu…'}
      </pre>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      <FileText className="h-8 w-8" />
      <p>
        {menu.fileName} ({formatSize(menu.size)})
      </p>
      <a
        href={`/api/mess-menu/${menu.id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 font-medium underline"
      >
        <FileDown className="h-4 w-4" /> Open file
      </a>
    </div>
  )
}

export default function MessMenuView({ canManage }: { canManage: boolean }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: menus, isLoading } = useQuery<MessMenu[]>({
    queryKey: ['messMenu'],
    queryFn: () => apiFetch<MessMenu[]>('/api/mess-menu'),
  })

  const current = menus?.[0] ?? null
  const history = useMemo(() => (menus ?? []).slice(1), [menus])

  const upload = async () => {
    if (!file) {
      toast({
        title: 'Choose a menu file',
        description: 'Pick an image, PDF or text file from your device.',
        variant: 'destructive',
      })
      return
    }
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'E.g. “Weekly Menu — September”.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', title.trim())
      form.append('note', note.trim())
      await apiFetch('/api/mess-menu', { method: 'POST', body: form })
      toast({ title: 'Menu uploaded', description: 'Residents of all branches can now see it.' })
      setUploadOpen(false)
      setTitle('')
      setNote('')
      setFile(null)
    } catch (e) {
      toast({
        title: 'Could not upload menu',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeMenu = useApiMutation<MessMenu, unknown>(
    (m) => apiFetch(`/api/mess-menu/${m.id}`, { method: 'DELETE' }),
    {
      invalidate: ['messMenu'],
      successMessage: 'Menu removed',
    }
  )

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Common mess for all hostels</p>
            <p className="text-xs text-muted-foreground">
              Nazzal · Nooroxotel · Ayesha · Aqsa · Velvetrose share the same menu.
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setUploadOpen(true)} className="min-h-[44px]">
            <Upload className="mr-2 h-4 w-4" /> Upload New Menu
          </Button>
        )}
      </div>

      {/* Current menu */}
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : current ? (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{current.title}</h2>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Current</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploaded {formatDateTime(current.createdAt)} by{' '}
                {current.uploader.name ?? current.uploader.username} · {current.fileName} (
                {formatSize(current.size)})
              </p>
              {current.note && <p className="mt-2 text-sm">{current.note}</p>}
            </div>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-destructive hover:text-destructive"
                onClick={() => removeMenu.mutate(current)}
                disabled={removeMenu.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
          <MenuPreview menu={current} />
        </section>
      ) : (
        <EmptyState
          icon={<UtensilsCrossed className="h-10 w-10" />}
          title="No mess menu uploaded yet"
          description={
            canManage
              ? 'Upload the weekly menu as an image, PDF or text file from your device — it becomes visible to residents of every branch.'
              : 'The hostel staff will upload the menu soon. Check back later.'
          }
          action={
            canManage ? (
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Upload New Menu
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Previous menus */}
      {history.length > 0 && (
        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" /> Previous menus
          </h3>
          <ul className="mt-3 divide-y">
            {history.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {isImage(m.mimeType) ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.createdAt)} · {m.uploader.name ?? m.uploader.username}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-9" asChild>
                    <a href={`/api/mess-menu/${m.id}`} target="_blank" rel="noreferrer">
                      <FileDown className="mr-1.5 h-3.5 w-3.5" /> View
                    </a>
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeMenu.mutate(m)}
                      disabled={removeMenu.isPending}
                      aria-label={`Delete menu ${m.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload mess menu</DialogTitle>
            <DialogDescription>
              Pick the menu file from your device (image, PDF or text, max 5 MB). It replaces the
              current menu for all hostels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-title">Title *</Label>
              <Input
                id="menu-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly Menu — September"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-note">Note (optional)</Label>
              <Textarea
                id="menu-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="E.g. Timings: breakfast 7–9 AM, lunch 12–2 PM, dinner 7–10 PM"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-file">Menu file *</Label>
              <Input
                id="menu-file"
                type="file"
                accept="image/*,application/pdf,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} · {formatSize(file.size)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={saving}>
              {saving ? 'Uploading…' : 'Upload Menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
