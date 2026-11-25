/** Keyzo mark: a key whose bow is a door-ring - deep-green tile with a brass key blade. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Keyzo" className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#234f38" />
      <circle cx="24" cy="32" r="9" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M33 32h20M46 32v8M53 32v6" stroke="#d9a74a" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function Logo({ size = 36, text = true, className = '' }: { size?: number; text?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {text && <span className="font-display text-xl font-extrabold tracking-tight">Key<span className="text-[var(--accent-text)]">zo</span></span>}
    </span>
  )
}
