export default function GuestContactsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 animate-pulse sm:p-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
        <div className="h-8 w-24 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="h-10 flex-1 min-w-[200px] rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="flex gap-4 border-b border-slate-200 py-3 dark:border-slate-700">
              <div className="h-5 w-36 rounded bg-slate-200/80 dark:bg-slate-700/80" />
              <div className="h-5 w-24 rounded bg-slate-200/80 dark:bg-slate-700/80" />
              <div className="h-5 w-32 rounded bg-slate-200/80 dark:bg-slate-700/80" />
              <div className="h-5 w-28 rounded bg-slate-200/80 dark:bg-slate-700/80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
