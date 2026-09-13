'use client'

import { useState } from 'react'
import { Copy, KeyRound, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import type { ResidentAccount } from '@/lib/types'

/**
 * Dialog that reveals a resident's login credentials exactly once
 * (after check-in or after an account password reset).
 */
export default function CredentialsDialog({
  open,
  onClose,
  account,
  residentName,
}: {
  open: boolean
  onClose: () => void
  account: ResidentAccount | null
  residentName?: string
}) {
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null)

  const copy = async (value: string, which: 'user' | 'pass') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast({ title: 'Could not copy — please select the text manually' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Resident account created
          </DialogTitle>
          <DialogDescription>
            {residentName ? `${residentName} can now sign in` : 'The resident can now sign in'} with
            the credentials below. This password is shown only once — share it securely and ask the
            resident to change it after first login.
          </DialogDescription>
        </DialogHeader>

        {account && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Username
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="font-mono text-sm font-semibold">{account.username}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(account.username, 'user')}
                  aria-label="Copy username"
                >
                  {copied === 'user' ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Password
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="font-mono text-sm font-semibold">{account.password}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(account.password, 'pass')}
                  aria-label="Copy password"
                >
                  {copied === 'pass' ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The resident sees their room, monthly payments, complaints and branch notices after
              signing in.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
