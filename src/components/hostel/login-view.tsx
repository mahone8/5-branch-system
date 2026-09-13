'use client'

import { useState } from 'react'
import { Building2, LogIn, Lock, User, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'

export default function LoginView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [role, setRole] = useState('admin')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fillFor = (r: string) => {
    setRole(r)
    if (r === 'admin') {
      setUsername('admin')
      setPassword('')
    } else if (r === 'warden') {
      setUsername('warden.nazzal')
      setPassword('')
    } else {
      setUsername('')
      setPassword('')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      toast({ title: `Welcome back, ${data.name || data.username}` })
      onLoggedIn()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-950 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hostel Management</h1>
            <p className="text-sm text-muted-foreground">
              Nazzal · Nooroxotel · Ayesha · Aqsa · Velvetrose
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border bg-card p-6 shadow-xl sm:p-8"
        >
          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Staff and residents use the accounts issued by the hostel office.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-role">Account type</Label>
              <Select value={role} onValueChange={fillFor}>
                <SelectTrigger id="login-role" className="w-full">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Super Admin</SelectItem>
                  <SelectItem value="warden">Branch Warden</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-username"
                  className="pl-9"
                  placeholder="e.g. admin or NZL-0001"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  className="pl-9 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              <LogIn className="mr-2 h-4 w-4" />
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>

          <div className="mt-6 rounded-lg border border-dashed bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">First-run accounts (change passwords after setup):</p>
            <p className="mt-1">Super admin — <code className="font-mono">admin</code> / <code className="font-mono">admin123</code></p>
            <p>
              Branch wardens — <code className="font-mono">warden.nazzal</code>,{' '}
              <code className="font-mono">warden.nooroxotel</code>, <code className="font-mono">warden.ayesha</code>,{' '}
              <code className="font-mono">warden.aqsa</code>, <code className="font-mono">warden.velvetrose</code> /{' '}
              <code className="font-mono">warden123</code>
            </p>
            <p className="mt-1">Resident accounts are generated automatically at check-in.</p>
          </div>
        </form>
      </div>
    </div>
  )
}
