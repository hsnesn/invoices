export default function InvoicesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-56 rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-11 w-28 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 h-5 w-32 rounded bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-11 flex-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
              <div className="h-11 w-36 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
              <div className="h-11 w-24 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
