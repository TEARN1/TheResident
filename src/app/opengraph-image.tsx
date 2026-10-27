import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The preview WhatsApp, Facebook and X show when someone shares a link to
// the site. Generated once at build time. Room pages (/rooms/<id>) override
// it with the room's own photo when it has one.
export const alt = 'The Resident: find a room you can trust, know the street you live on'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/logo.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #050807 0%, #0b1a14 55%, #1a1405 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
          <img src={logoSrc} width={72} height={72} style={{ borderRadius: 14 }} alt="" />
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6 }}>THE RESIDENT</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>Find a room you can trust.</div>
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05, color: '#d4af37' }}>Know the street you live on.</div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#a7b3ad' }}>
          Real rooms from real landlords · Fair-price check · SOS to your neighbours
        </div>
      </div>
    ),
    { ...size }
  )
}
