import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'

export const metadata: Metadata = {
  title: 'About The Resident — Your Suburb, Connected',
  description:
    'The Resident is a community app for South African neighbourhoods: local services, spaza marketplaces, lift clubs, rooms to rent, and street safety alerts from verified neighbours.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <>
      <h1>About The Resident</h1>
      <p className={styles.lede}>
        The Resident is a community app that connects the people who live on the same streets, so
        they can trade, help each other and keep the neighbourhood safe.
      </p>

      <h2>Why we built it</h2>
      <p>
        Most of what makes a suburb work already happens between neighbours: the plumber a friend
        recommends, the spaza shop down the road, the lift club to work, the WhatsApp group that
        warns everyone when something is wrong. That information is scattered across group chats
        and word of mouth, and it is hard to know who to trust. The Resident brings it into one
        place, tied to real residents with a track record.
      </p>

      <h2>What you can do</h2>
      <ul>
        <li><strong>Find local services</strong> — handymen, plumbers, electricians, cleaners and other trades that neighbours have used.</li>
        <li><strong>Buy and sell locally</strong> — spaza shops, home businesses, group buys and second-hand items in your suburb.</li>
        <li><strong>Find a place to stay</strong> — rooms, flats and roommates, from people in the area.</li>
        <li><strong>Get around</strong> — join or start a lift club, or find bakkie transport.</li>
        <li><strong>Share</strong> — borrow tools from the community tool library and report lost and found items.</li>
        <li><strong>Stay safe</strong> — send and receive community alerts, and keep a trust circle of people who check in on you.</li>
      </ul>

      <h2>Built on trust</h2>
      <p>
        Every resident builds a reputation from ratings by the neighbours they deal with. That
        makes it easier to choose who to hire, buy from or share a home with, and harder for
        anyone to take advantage of the community.
      </p>

      <div className={styles.cta}>
        <p><strong>Ready to meet your neighbours?</strong></p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/auth">Join your suburb</Link> or read <Link href="/how-it-works">how it works</Link>.
        </p>
      </div>
    </>
  )
}
