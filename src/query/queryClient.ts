import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error('[query error]', query.queryKey, error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        console.error('[mutation error]', mutation.options.mutationKey, error)
      },
    }),
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  })
}
