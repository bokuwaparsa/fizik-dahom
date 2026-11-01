// ─── Physics Quest · Hash router (keeps the whole game on the / route) ────────
'use client'

import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string }
  | { name: 'playground' }
  | { name: 'progress' }
  | { name: 'bookmap' }
  | { name: 'licenses' }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '')
  const path = h.split('?')[0] || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'lesson' && parts[1]) return { name: 'lesson', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'playground') return { name: 'playground' }
  if (parts[0] === 'progress') return { name: 'progress' }
  if (parts[0] === 'bookmap') return { name: 'bookmap' }
  if (parts[0] === 'licenses') return { name: 'licenses' }
  return { name: 'home' }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'lesson': return `#/lesson/${r.id}`
    case 'playground': return '#/playground'
    case 'progress': return '#/progress'
    case 'bookmap': return '#/bookmap'
    case 'licenses': return '#/licenses'
    default: return '#/'
  }
}

export function navigate(route: Route) {
  if (typeof window === 'undefined') return
  const target = routeToHash(route)
  if (window.location.hash === target) return
  window.location.hash = target
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'home' } : parseHash(window.location.hash),
  )

  const onChange = useCallback(() => {
    setRoute(parseHash(window.location.hash))
  }, [])

  useEffect(() => {
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [onChange])

  return route
}
