import Link from 'next/link'
import Image from 'next/image'
import styles from './info.module.css'
import { infoLinks } from '../info-links'

// Plain server-rendered layout for the public information pages, so search
// engines get the full text in the HTML without running any JavaScript.
export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo.png" alt="The Resident logo" width={28} height={28} style={{ borderRadius: '4px' }} />
          THE RESIDENT
        </Link>
        <Link href="/auth" className="btn-gold">Join Your Suburb</Link>
      </nav>
      <main className={styles.content}>{children}</main>
      <footer className={styles.footer}>
        <Link href="/">Home</Link>
        {infoLinks.map(l => (
          <Link key={l.href} href={l.href}>{l.label}</Link>
        ))}
      </footer>
    </div>
  )
}
