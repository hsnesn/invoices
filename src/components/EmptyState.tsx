import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16 px-6 dark:border-gray-600 dark:bg-gray-800/30">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-200/80 text-gray-500 dark:bg-gray-700/80 dark:text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-center text-base font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
