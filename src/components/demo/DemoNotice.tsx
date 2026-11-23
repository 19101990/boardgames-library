interface DemoNoticeProps {
  className?: string;
}

/** Shown to signed-out visitors, who see the demo collection instead of the owner's real one. */
export function DemoNotice({ className = '' }: DemoNoticeProps) {
  return (
    <p
      role="note"
      // Colours live in globals.css (.demo-notice / .dark .demo-notice) so they follow the app's theme toggle.
      className={`demo-notice rounded-xl border px-3 py-2 text-xs ${className}`}
    >
      <span className="font-bold">Demo collection</span> · changes are saved only on this device
    </p>
  );
}
