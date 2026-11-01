'use client'

import dynamic from 'next/dynamic'
import { Atom } from 'lucide-react'

const GameShell = dynamic(
  () => import('@/components/game/shell').then((m) => m.GameShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading فیزیک‌دهم">
        <Atom className="h-10 w-10 animate-spin text-amber-500 [animation-duration:2.5s]" aria-hidden />
      </div>
    ),
  },
)

export default function Page() {
  return <GameShell />
}
