import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Asemahle "TEARN" Nkwali — Founder & CEO of The Resident Crew & TEARN Ventures'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const [logo, ceoPhoto] = await Promise.all([
    readFile(join(process.cwd(), 'public/logo.png')),
    readFile(join(process.cwd(), 'public/founder/asemahle-tearn-nkwali-ceo-portrait.jpg')),
  ])
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  const ceoSrc = `data:image/jpeg;base64,${ceoPhoto.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '48px 64px',
          gap: 44,
          background: 'linear-gradient(135deg, #051F20 0%, #0b2e26 58%, #1c190a 100%)',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            flex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            { }
            <img src={logoSrc} width={60} height={60} style={{ borderRadius: 14 }} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: '#d4af37' }}>TEARN VENTURES</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#34d399' }}>EXECUTIVE LEADERSHIP</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.06 }}>
              Asemahle &quot;TEARN&quot; Nkwali
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#d4af37', lineHeight: 1.3 }}>
              Founder &amp; CEO · The Resident Crew, The Gruvs &amp; Excellency Academy
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 22, color: '#cbd5e1' }}>
            PropTech · Community Safety · South African Real Estate · Local Services
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 360,
            height: 480,
            borderRadius: 28,
            overflow: 'hidden',
            border: '4px solid #d4af37',
            flexShrink: 0,
          }}
        >
          { }
          <img src={ceoSrc} width={360} height={480} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
      </div>
    ),
    { ...size }
  )
}
