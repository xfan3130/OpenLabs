/** OpenLab mark: data points with a fitted curve. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#1c5cab" />
        <path d="M7 24 C 12 23, 17 18, 25 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="9" cy="23.2" r="2" fill="#fff" />
        <circle cx="15" cy="20.4" r="2" fill="#fff" />
        <circle cx="20" cy="14.6" r="2" fill="#fff" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">OpenLab</span>
    </span>
  );
}
