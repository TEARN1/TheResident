import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Press & Media Kit — The Resident Crew & TEARN Ventures'
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
          padding: '56px 72px',
          background: 'linear-gradient(135deg, #050807 0%, #051F20 55%, #1c190a 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            { }
            <img src={logoSrc} width={64} height={64} style={{ borderRadius: 14 }} alt="" />
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4 }}>THE RESIDENT CREW</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d4af37' }}>PRESS &amp; MEDIA KIT</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.08 }}>
            Housing, Safety &amp; Local Commerce.
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: '#d4af37' }}>
            TEARN Ventures · Founded by Asemahle &quot;TEARN&quot; Nkwali
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#cbd5e1' }}>
          Boilerplate · Fact Sheet · Brand Logos · Press Portraits · theresidentcrew.com/press
        </div>
      </div>
    ),
    { ...size }
  )
}
