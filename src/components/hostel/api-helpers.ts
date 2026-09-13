'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'

/**
 * Active branch for API calls (set by the app shell when the admin switches
 * branches; wardens/residents are scoped server-side by their session).
 */
let activeBranchId: string | null = null

export function setActiveBranch(branchId: string | null) {
  activeBranchId = branchId
}

export function getActiveBranchId() {
  return activeBranchId
}

export const UNAUTHORIZED_EVENT = 'hms:unauthorized'

/**
 * Generic mutation helper that shows a toast on success/error
 * and invalidates the affected queries.
 */
export function useApiMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  opts: {
    invalidate: string[]
    successMessage?: string
    onSuccess?: (data: TResult) => void
  }
) {
  const queryClient = useQueryClient()

  return useMutation<TResult, Error, TInput>({
    mutationFn: fn,
    onSuccess: (data) => {
      for (const key of opts.invalidate) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      if (opts.successMessage) {
        toast({ title: opts.successMessage })
      }
      opts.onSuccess?.(data)
    },
    onError: (error: Error) => {
      toast({
        title: 'Something went wrong',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      })
    },
  })
}

/** Small helper for fetch JSON with error surfacing and branch scoping. */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers: Record<string, string> = {
    // FormData bodies must NOT get a manual Content-Type — the browser
    // sets the multipart boundary itself
    ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  }
  if (activeBranchId && !headers['x-branch-id']) {
    headers['x-branch-id'] = activeBranchId
  }
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  if (res.status === 401) {
    // The /me probe is expected to 401 before login — never loop on it.
    if (!url.startsWith('/api/auth/me')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new Error('Your session has expired. Please sign in again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}
