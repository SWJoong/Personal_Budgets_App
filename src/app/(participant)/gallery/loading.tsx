export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-border flex items-center justify-between px-4">
        <div className="w-24 h-5 bg-muted rounded-full" />
        <div className="w-8 h-8 bg-muted rounded-full" />
      </div>
      <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
