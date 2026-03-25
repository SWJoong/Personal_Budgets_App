'use client'

import { AdminSidebar } from '@/components/layout/AdminSidebar'

export function SupporterLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      
      <main className="flex-1 w-full md:ml-64 relative min-h-screen">
        {children}
      </main>
    </div>
  )
}
