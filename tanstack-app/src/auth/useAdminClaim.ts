import { useEffect, useState } from 'react'
import { useAuth } from '#/auth/useAuth'

export type AdminClaimState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'denied' }
  | { status: 'admin'; uid: string }

export function useAdminClaim(): AdminClaimState {
  const { user, loading } = useAuth()
  const [state, setState] = useState<AdminClaimState>({ status: 'loading' })

  useEffect(() => {
    if (loading) {
      setState((prev) =>
        prev.status === 'loading' ? prev : { status: 'loading' },
      )
      return
    }
    if (!user) {
      setState((prev) =>
        prev.status === 'signed_out' ? prev : { status: 'signed_out' },
      )
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const result = await user.getIdTokenResult(true)
        if (cancelled) return
        if (result.claims.admin === true) {
          setState({
            status: 'admin',
            uid: user.uid,
          })
        } else {
          setState({ status: 'denied' })
        }
      } catch {
        if (cancelled) return
        setState({ status: 'denied' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, loading])

  return state
}
