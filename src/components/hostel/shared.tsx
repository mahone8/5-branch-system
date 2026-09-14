'use client'

import { ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { complaintWhatsAppUrl } from '@/lib/types'
import type { Complaint } from '@/lib/types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | null

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant; className?: string }> = {
  // Student
  ACTIVE: { label: 'Active', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  CHECKED_OUT: { label: 'Checked Out', variant: 'secondary' },
  // Room
  AVAILABLE: { label: 'Available', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  FULL: { label: 'Full', variant: 'secondary' },
  MAINTENANCE: { label: 'Maintenance', variant: 'destructive' },
  // Payment
  PAID: { label: 'Paid', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  PENDING: { label: 'Pending', variant: 'outline', className: 'border-amber-500 text-amber-600 dark:text-amber-400' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
  // Complaint
  OPEN: { label: 'Open', variant: 'destructive' },
  IN_PROGRESS: { label: 'In Progress', variant: 'outline', className: 'border-amber-500 text-amber-600 dark:text-amber-400' },
  RESOLVED: { label: 'Resolved', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-600' },
  // Notice priority
  NORMAL: { label: 'Normal', variant: 'secondary' },
  IMPORTANT: { label: 'Important', variant: 'outline', className: 'border-amber-500 text-amber-600 dark:text-amber-400' },
  URGENT: { label: 'Urgent', variant: 'destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' }
  return (
    <Badge variant={config.variant ?? 'secondary'} className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  HIGH: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] ?? { label: priority, className: '' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      {icon && <div className="text-muted-foreground/50">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// Opens WhatsApp with the complaint pre-filled; the sender picks the chat.
export function WhatsAppShareButton({
  complaint,
  label = 'Send via WhatsApp',
  className,
}: {
  complaint: Complaint
  label?: string
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'h-9 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400',
        className
      )}
      onClick={() => window.open(complaintWhatsAppUrl(complaint), '_blank', 'noopener')}
    >
      <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
