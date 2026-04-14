'use client'

import { useState } from 'react'
import AdminHelpModal from './AdminHelpModal'
import { ADMIN_HELP } from '@/data/adminHelpContent'

interface Props {
  pageKey: string
  className?: string
}

export default function AdminHelpButton({ pageKey, className }: Props) {
  const [open, setOpen] = useState(false)
  const page = ADMIN_HELP[pageKey]
  if (!page) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors'
        }
        aria-label="도움말"
        title={`${page.pageTitle} 도움말`}
      >
        <span className="text-base leading-none">?</span>
        <span className="hidden sm:inline">도움말</span>
      </button>
      {open && <AdminHelpModal page={page} onClose={() => setOpen(false)} />}
    </>
  )
}
