export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <span className="text-lg font-bold text-slate-900">Trailhead Prep</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
