"use client";

export function FooterShortcutTrigger() {
  const openShortcuts = () => {
    window.dispatchEvent(new CustomEvent("openKeyboardShortcuts"));
  };

  return (
    <button
      type="button"
      onClick={openShortcuts}
      className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer"
      title="Show keyboard shortcuts"
    >
      <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-[10px] dark:border-gray-600 dark:bg-gray-800">
        ?
      </kbd>
      <span>for keyboard shortcuts</span>
    </button>
  );
}
