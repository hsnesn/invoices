export default function FreelancerInvoicesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-56 rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 w-28 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((g) => (
          <div key={g} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 h-6 w-44 rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-100/80 dark:bg-slate-700/80" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
