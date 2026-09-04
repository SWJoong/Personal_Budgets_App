export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-border flex items-center px-4">
        <div className="w-20 h-5 bg-muted rounded-full" />
      </div>
      <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
        <div className="h-24 bg-card rounded-2xl ring-1 ring-border" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-card rounded-2xl ring-1 ring-border" />
        ))}
      </div>
    </div>
  )
}
