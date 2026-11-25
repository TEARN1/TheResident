import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const revalidate = 86400

export async function GET() {
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
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #051F20 0%, #0b2e26 55%, #1c190a 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
            <img src={logoSrc} width={72} height={72} style={{ borderRadius: 16 }} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: '#d4af37' }}>TEARN VENTURES</div>
              <div style={{ fontSize: 20, color: '#94a3b8' }}>Johannesburg, South Africa</div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 22px',
              borderRadius: 999,
              border: '2px solid #d4af37',
              fontSize: 20,
              fontWeight: 700,
              color: '#fde68a',
            }}
          >
            FOUNDER &amp; CEO
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          <div
            style={{
              display: 'flex',
              width: 390,
              height: 520,
              borderRadius: 28,
              overflow: 'hidden',
              border: '4px solid #d4af37',
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
            <img src={ceoSrc} width={390} height={520} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, color: '#ffffff' }}>
              Asemahle &quot;TEARN&quot; Nkwali
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.38, color: '#cbd5e1' }}>
              Architect of South Africa&apos;s connected digital ecosystem for housing, live precinct safety, cultural discovery, and workplace skills.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '24px',
              borderRadius: 20,
              background: 'rgba(13, 38, 33, 0.9)',
              border: '2px solid rgba(212, 175, 55, 0.45)',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: '#d4af37' }}>The Resident Crew</div>
            <div style={{ fontSize: 20, color: '#cbd5e1', marginTop: 8 }}>theresidentcrew.com</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '24px',
              borderRadius: 20,
              background: 'rgba(13, 38, 33, 0.9)',
              border: '2px solid rgba(0, 242, 255, 0.4)',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: '#00f2ff' }}>The Gruvs</div>
            <div style={{ fontSize: 20, color: '#cbd5e1', marginTop: 8 }}>thegruvs.com</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '24px',
              borderRadius: 20,
              background: 'rgba(13, 38, 33, 0.9)',
              border: '2px solid rgba(16, 185, 129, 0.45)',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: '#34d399' }}>Excellency Academy</div>
            <div style={{ fontSize: 20, color: '#cbd5e1', marginTop: 8 }}>excellencyacs.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 1200 }
  )
}
