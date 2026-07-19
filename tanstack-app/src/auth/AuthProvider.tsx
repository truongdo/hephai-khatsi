import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { readFirebaseWebConfig } from '#/firebase/client'
import { signOutUser, subscribeAuth } from '#/repositories/authRepo'

function initialAuthLoading(): boolean {
  return readFirebaseWebConfig() !== null
}

export type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(initialAuthLoading)

  useEffect(() => {
    const unsub = subscribeAuth((next) => {
      setUser(next)
      setLoading(false)
    })
    return unsub
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signOut: () => signOutUser(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
