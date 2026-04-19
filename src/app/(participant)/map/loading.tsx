export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-4">
        <div className="w-28 h-5 bg-zinc-100 rounded-full" />
        <div className="w-8 h-8 bg-zinc-100 rounded-full" />
      </div>
      <div className="flex-1 bg-zinc-100" />
      <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-2xl ring-1 ring-zinc-100" />
        ))}
      </div>
    </div>
  )
}
