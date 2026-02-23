export default function FreelancerInvoicesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((g) => (
          <div key={g} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 h-6 w-40 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded bg-slate-100 dark:bg-slate-700" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
