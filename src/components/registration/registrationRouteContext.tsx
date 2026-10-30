import { createContext, useContext, type ReactNode } from 'react'
import type { Retreat } from '#/domain/retreat'
import type { Invite } from '#/domain/types'

export type RegistrationRouteContextValue = {
  token: string
  invite: Invite
  retreat: Retreat
}

const RegistrationContext =
  createContext<RegistrationRouteContextValue | null>(null)

export function RegistrationRouteProvider({
  value,
  children,
}: {
  value: RegistrationRouteContextValue
  children: ReactNode
}) {
  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  )
}

export function useRegistrationRouteContext(): RegistrationRouteContextValue {
  const ctx = useContext(RegistrationContext)
  if (!ctx) {
    throw new Error('useRegistrationRouteContext must be used within /r/$token layout')
  }
  return ctx
}
