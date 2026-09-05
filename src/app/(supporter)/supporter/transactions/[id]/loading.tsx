export default function TransactionDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-20 bg-danger-bg rounded-lg animate-pulse" />
      </header>
      <main id="main-content" tabIndex={-1} className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-1/2">
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="bg-card rounded-xl ring-1 ring-border min-h-[500px] animate-pulse" />
        </div>
        <div className="w-full lg:w-1/2">
          <div className="h-6 w-40 bg-muted rounded animate-pulse mb-4" />
          <div className="bg-card rounded-xl ring-1 ring-border p-6 flex flex-col gap-5 animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 bg-muted rounded-lg" />
              <div className="h-12 bg-muted rounded-lg" />
            </div>
            <div className="h-12 bg-muted rounded-lg" />
            <div className="flex gap-2 flex-wrap">
              {[0,1,2,3,4].map(i => <div key={i} className="h-8 w-16 bg-muted rounded-md" />)}
            </div>
            <div className="h-px bg-muted" />
            <div className="flex gap-3">
              <div className="flex-1 h-24 bg-success-bg rounded-xl" />
              <div className="flex-1 h-24 bg-warning-bg rounded-xl" />
            </div>
            <div className="h-14 bg-muted rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
