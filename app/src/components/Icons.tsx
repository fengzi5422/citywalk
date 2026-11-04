type P = { size?: number; className?: string }

const S = (p: P) => ({
  width: p.size ?? 16,
  height: p.size ?? 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: p.className,
})

export const Back = (p: P) => (
  <svg {...S(p)}><path d="M10 3 5 8l5 5" /></svg>
)
export const Search = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 19 })} viewBox="0 0 20 20">
    <circle cx="9" cy="9" r="5.6" /><path d="m13.2 13.2 3.4 3.4" />
  </svg>
)
export const Pin = (p: P) => (
  <svg {...S(p)}><path d="M8 14.5s4.4-4 4.4-7A4.4 4.4 0 0 0 3.6 7.5c0 3 4.4 7 4.4 7Z" /><circle cx="8" cy="7.4" r="1.6" /></svg>
)
export const Chevron = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 10 })} viewBox="0 0 10 10"><path d="m2.5 4 2.5 2.5L7.5 4" /></svg>
)
export const Plus = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 18 })} viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg>
)
export const Arrow = (p: P) => (
  <svg {...S(p)}><path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" /></svg>
)
export const Clock = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 12 })} viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" /><path d="M7 4v3.2l2 1.2" /></svg>
)
export const Bookmark = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 19 })} viewBox="0 0 24 24" strokeWidth={1.7}><path d="M6 4.5h12v16l-6-4-6 4z" /></svg>
)
export const Compass = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 21 })} viewBox="0 0 24 24" strokeWidth={1.6}><circle cx="12" cy="12" r="9" /><path d="m15.6 8.4-2.3 5.2-5.2 2.3 2.3-5.2z" /></svg>
)
export const Calendar = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 21 })} viewBox="0 0 24 24" strokeWidth={1.6}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
)
export const User = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 21 })} viewBox="0 0 24 24" strokeWidth={1.6}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4" /></svg>
)
export const Map = (p: P) => (
  <svg {...S(p)}><path d="M9 15.5s5-4.6 5-8.2A5 5 0 0 0 4 7.3c0 3.6 5 8.2 5 8.2Z" /><circle cx="9" cy="7.2" r="1.7" /></svg>
)
export const List = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 17 })} viewBox="0 0 18 18" strokeWidth={1.6}><path d="M4 14V9m5 5V4m5 10V7" /></svg>
)
export const Check = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 10 })} viewBox="0 0 12 12"><path d="m2.5 6.2 2.3 2.3L9.5 3.8" /></svg>
)
export const Info = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 14 })}><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v3.4M8 5.4v.2" /></svg>
)
export const Warn = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 14 })}><path d="M8 5v4.2M8 11.4v.2" /><circle cx="8" cy="8" r="6.4" /></svg>
)
export const Share = (p: P) => (
  <svg {...S(p)}><path d="M8 11V3m0 0L4.5 6.5M8 3l3.5 3.5M3 13h10" /></svg>
)
export const Building = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 26 })} viewBox="0 0 24 24" strokeWidth={1.5}><path d="M3 20h18M6 20V9l6-4 6 4v11M10 20v-5h4v5" /></svg>
)
export const Bowl = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 26 })} viewBox="0 0 24 24" strokeWidth={1.5}><path d="M4 10h16a8 8 0 0 1-16 0Z" /><path d="M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2M16 6c0-1 1-1 1-2" /></svg>
)
export const Ticket = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 26 })} viewBox="0 0 24 24" strokeWidth={1.5}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5v14M4 10h5" /></svg>
)
export const Cup = (p: P) => (
  <svg {...S({ ...p, size: p.size ?? 26 })} viewBox="0 0 24 24" strokeWidth={1.5}><path d="M5 19V9a4 4 0 0 1 8 0v10M13 19V9a4 4 0 0 1 8 0v10" /></svg>
)
