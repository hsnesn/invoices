"use client";

export function FooterShortcutTrigger() {
  const openShortcuts = () => {
    window.dispatchEvent(new CustomEvent("openKeyboardShortcuts"));
  };

  return (
    <button
      type="button"
      onClick={openShortcuts}
      className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center"
      title="Show keyboard shortcuts"
      aria-label="Show keyboard shortcuts"
    >
      <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] dark:border-gray-600 dark:bg-gray-800">
        ?
      </kbd>
      <span className="hidden sm:inline">for keyboard shortcuts</span>
    </button>
  );
}
