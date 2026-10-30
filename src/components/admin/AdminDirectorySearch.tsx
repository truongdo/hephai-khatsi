import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Box, SimpleGrid, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { useAuth } from '#/auth/useAuth'
import type { MemberSearchDoc, TempleSearchDoc } from '#/domain/searchDocs'
import type { RecordStatus } from '#/domain/types'
import { orgUnitsQuery } from '#/query/adminQueries'
import { searchDirectory } from '#/search/searchApiClient'

const SEARCH_DEBOUNCE_MS = 250

function memberStatusLabel(status: string): string | undefined {
  switch (status as RecordStatus) {
    case 'draft':
      return m.admin_members_status_draft()
    case 'locked':
      return m.admin_members_status_locked()
    default:
      return undefined
  }
}

function templeStatusLabel(status: string): string | undefined {
  switch (status as RecordStatus) {
    case 'draft':
      return m.admin_temples_status_draft()
    case 'locked':
      return m.admin_temples_status_locked()
    default:
      return undefined
  }
}

function truncateCccd(cccd: string): string {
  if (!cccd) return ''
  if (cccd.length <= 12) return cccd
  return `${cccd.slice(0, 4)}…${cccd.slice(-4)}`
}

function memberLabel(member: MemberSearchDoc): string {
  return member.phapDanh || member.theDanh || member.id
}

function memberDescription(
  member: MemberSearchDoc,
  orgUnitName?: string,
): string | undefined {
  const parts: string[] = []
  if (member.theDanh && member.phapDanh) {
    parts.push(member.theDanh)
  }
  const cccd = truncateCccd(member.cccd)
  if (cccd) parts.push(cccd)
  const status = memberStatusLabel(member.status)
  if (status) parts.push(status)
  const org = orgUnitName ?? member.orgUnitId
  if (org) parts.push(org)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function templeLabel(temple: TempleSearchDoc): string {
  return temple.danhHieu || temple.id
}

function templeDescription(temple: TempleSearchDoc): string | undefined {
  const parts: string[] = []
  if (temple.truTriPhapDanh) parts.push(temple.truTriPhapDanh)
  const status = templeStatusLabel(temple.status)
  if (status) parts.push(status)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function AdminDirectorySearch({
  forceOpened,
}: {
  forceOpened?: boolean
} = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const orgUnits = useQuery(orgUnitsQuery())
  const orgUnitNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const unit of orgUnits.data ?? []) {
      map.set(unit.id, unit.name)
    }
    return map
  }, [orgUnits.data])
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<MemberSearchDoc[]>([])
  const [temples, setTemples] = useState<TempleSearchDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    const trimmed = query.trim()

    if (!trimmed) {
      setMembers([])
      setTemples([])
      setError(false)
      setLoading(false)
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)
        setError(false)

        try {
          const idToken = await user!.getIdToken()
          if (controller.signal.aborted) return

          const result = await searchDirectory({
            q: trimmed,
            idToken,
            signal: controller.signal,
          })
          if (controller.signal.aborted) return

          setMembers(result.members)
          setTemples(result.temples)
        } catch {
          if (!controller.signal.aborted) {
            setError(true)
            setMembers([])
            setTemples([])
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      abortRef.current?.abort()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, user])

  const trimmedQuery = query.trim()
  const hasResults = members.length > 0 || temples.length > 0
  const showHint = !trimmedQuery
  const showEmpty = Boolean(trimmedQuery) && !loading && !error && !hasResults

  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={m.admin_search_open_aria()}
        onClick={() => spotlight.open()}
      >
        <Search size={20} />
      </ActionIcon>

      <Spotlight.Root
        shortcut={forceOpened ? null : 'mod + K'}
        forceOpened={forceOpened}
        query={query}
        onQueryChange={setQuery}
        styles={{
          content: {
            width: 'min(92vw, 52rem)',
            maxWidth: '52rem',
          },
        }}
      >
        <Spotlight.Search
          placeholder={m.admin_search_placeholder()}
          leftSection={<Search size={16} />}
        />
        <Spotlight.ActionsList>
          {showHint ? (
            <Spotlight.Empty>
              <Text size="sm" c="dimmed">
                {m.admin_search_hint()}
              </Text>
            </Spotlight.Empty>
          ) : null}
          {error ? (
            <Spotlight.Empty>
              <Text size="sm" c="red">
                {m.admin_search_error()}
              </Text>
            </Spotlight.Empty>
          ) : null}
          {showEmpty ? (
            <Spotlight.Empty>{m.admin_search_empty()}</Spotlight.Empty>
          ) : null}
          {hasResults ? (
            <SimpleGrid
              cols={{ base: 1, sm: members.length > 0 && temples.length > 0 ? 2 : 1 }}
              spacing="md"
              verticalSpacing="xs"
              style={{ alignItems: 'start' }}
            >
              {members.length > 0 ? (
                <Box miw={0}>
                  <Spotlight.ActionsGroup label={m.admin_search_group_members()}>
                    {members.map((member) => (
                      <Spotlight.Action
                        key={member.id}
                        label={memberLabel(member)}
                        description={memberDescription(
                          member,
                          orgUnitNameById.get(member.orgUnitId),
                        )}
                        onClick={() => {
                          navigate({
                            to: '/admin/members/$id',
                            params: { id: member.id },
                          })
                          spotlight.close()
                        }}
                      />
                    ))}
                  </Spotlight.ActionsGroup>
                </Box>
              ) : null}
              {temples.length > 0 ? (
                <Box miw={0}>
                  <Spotlight.ActionsGroup label={m.admin_search_group_temples()}>
                    {temples.map((temple) => (
                      <Spotlight.Action
                        key={temple.id}
                        label={templeLabel(temple)}
                        description={templeDescription(temple)}
                        onClick={() => {
                          navigate({
                            to: '/admin/temples/$id',
                            params: { id: temple.id },
                          })
                          spotlight.close()
                        }}
                      />
                    ))}
                  </Spotlight.ActionsGroup>
                </Box>
              ) : null}
            </SimpleGrid>
          ) : null}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  )
}
