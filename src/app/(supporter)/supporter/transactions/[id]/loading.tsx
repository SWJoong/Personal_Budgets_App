export default function TransactionDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-zinc-200 rounded animate-pulse" />
          <div className="h-8 w-48 bg-zinc-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-20 bg-red-100 rounded-lg animate-pulse" />
      </header>
      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-1/2">
          <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse mb-4" />
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 min-h-[500px] animate-pulse" />
        </div>
        <div className="w-full lg:w-1/2">
          <div className="h-6 w-40 bg-zinc-200 rounded animate-pulse mb-4" />
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 p-6 flex flex-col gap-5 animate-pulse">
            <div className="h-16 bg-zinc-50 rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 bg-zinc-100 rounded-lg" />
              <div className="h-12 bg-zinc-100 rounded-lg" />
            </div>
            <div className="h-12 bg-zinc-100 rounded-lg" />
            <div className="flex gap-2 flex-wrap">
              {[0,1,2,3,4].map(i => <div key={i} className="h-8 w-16 bg-zinc-100 rounded-md" />)}
            </div>
            <div className="h-px bg-zinc-200" />
            <div className="flex gap-3">
              <div className="flex-1 h-24 bg-green-50 rounded-xl" />
              <div className="flex-1 h-24 bg-orange-50 rounded-xl" />
            </div>
            <div className="h-14 bg-zinc-200 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
