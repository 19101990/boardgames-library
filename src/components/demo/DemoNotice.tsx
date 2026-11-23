interface DemoNoticeProps {
  className?: string;
}

/** Shown to signed-out visitors, who see the demo collection instead of the owner's real one. */
export function DemoNotice({ className = '' }: DemoNoticeProps) {
  return (
    <p
      role="note"
      className={`rounded-xl border border-[#a2d8e2] bg-[#e2f4f7] px-3 py-2 text-xs text-[#0e6f80] dark:border-[#1f4a5a] dark:bg-[#0b1f2a] dark:text-[#8fe6f7] ${className}`}
    >
      <span className="font-bold">Demo collection</span> · changes are saved only on this device
    </p>
  );
}
