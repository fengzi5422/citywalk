const GRADS = [
  'linear-gradient(150deg,#3B7A63,#8FBE9C)',
  'linear-gradient(150deg,#4A6B7C,#9BB6C2)',
  'linear-gradient(150deg,#B4703F,#DDB08A)',
  'linear-gradient(150deg,#5C6B8A,#A8B4CC)',
  'linear-gradient(150deg,#7A5C6B,#C2A8B4)',
  'linear-gradient(150deg,#2C6E60,#7FAE94)',
]

export const gradOf = (seed: string) =>
  GRADS[Math.abs(seed.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % GRADS.length]

export function Skyline({ opacity = 0.24 }: { opacity?: number }) {
  return (
    <svg className="art" viewBox="0 0 390 120" preserveAspectRatio="none">
      <path
        d="M0 120V74h26V56h30v24h34V42h28v22h32V30h26v32h34V50h28v26h32V44h26v24h34V62h34v20h26v38Z"
        fill={`rgba(255,255,255,${opacity})`}
      />
    </svg>
  )
}

export function Waves({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 186 54" preserveAspectRatio="none">
      <path
        d="M0 54V38c22 0 22-12 44-12s22 12 44 12 22-14 44-14 22 10 54 10v20Z"
        fill={`rgba(255,255,255,${opacity})`}
      />
    </svg>
  )
}

export function MiniSkyline({ w = 56, h = 66 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 56 66" style={{ position: 'absolute', bottom: 0, left: 0 }}>
      <path d="M0 66V46h8V34h10v12h9V28h8v18h9V36h8v30Z" fill="rgba(255,255,255,.22)" />
    </svg>
  )
}
