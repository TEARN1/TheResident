import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { CAMPUSES } from '../../public-services'
import { JoinCta } from '../directory-views'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Student Accommodation near Universities in South Africa | The Resident',
  description: 'Find verified student rooms, communes, and private rentals near major South African universities: Wits, UJ, UP Hatfield, UCT, Stellenbosch, UKZN, and TUT.',
  alternates: { canonical: '/campus' },
}

export default function CampusIndex() {
  return (
    <>
      <h1>Student Accommodation by University</h1>
      <p className={styles.lede}>
        Verified student communes, rooms, and shared apartments near major campuses across South Africa.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CAMPUSES.map(c => (
          <li key={c.slug} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
            <Link href={`/campus/${c.slug}`} style={{ fontSize: 18, fontWeight: 700, color: '#00f2ff', textDecoration: 'none' }}>
              {c.name}
            </Link>
            <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              {c.desc}
            </p>
          </li>
        ))}
      </ul>

      <JoinCta text="Have a room or student commune to rent near campus? List it on The Resident." />
    </>
  )
}
