import { AdminSidebar } from "@/components/layout/AdminSidebar"

export default function SupporterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 w-full pl-64">
      {/* 
        pc sidebar takes 64 tailwind units (256px).
        pl-64 shifts the main content to the right.
      */}
      <AdminSidebar />
      <main className="flex-1 w-full relative">
        {children}
      </main>
    </div>
  )
}
