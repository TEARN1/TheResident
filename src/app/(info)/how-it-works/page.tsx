import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'

export const metadata: Metadata = {
  title: 'How The Resident Works — Join Your Suburb in Minutes',
  description:
    'Sign up, join your suburb and start finding trusted local services, rooms, lift clubs and marketplaces. Here is how The Resident works, step by step.',
  alternates: { canonical: '/how-it-works' },
}

export default function HowItWorksPage() {
  return (
    <>
      <h1>How The Resident works</h1>
      <p className={styles.lede}>Getting started takes a few minutes.</p>

      <ol>
        <li>
          <strong>Create an account.</strong> Sign up with your email address or Facebook.
        </li>
        <li>
          <strong>Join your suburb.</strong> Tell us where you live and whether you are a tenant,
          landlord or visitor, so you see what is happening near you.
        </li>
        <li>
          <strong>Explore your neighbourhood.</strong> Browse local services, the marketplace,
          housing and community notices.
        </li>
        <li>
          <strong>Connect and trade.</strong> Message neighbours directly, hire a service, join a
          lift club or post something of your own.
        </li>
        <li>
          <strong>Rate and be rated.</strong> After you deal with someone, leave a rating. Good
          ratings build your reputation in the community.
        </li>
      </ol>

      <h2>For residents</h2>
      <p>
        Find trusted help nearby, borrow instead of buying, share lifts, and get alerts when
        something happens on your street.
      </p>

      <h2>For local businesses and service providers</h2>
      <p>
        List your services where your neighbours are looking. Ratings from real customers in your
        area help new customers choose you.
      </p>

      <h2>For landlords and tenants</h2>
      <p>
        Advertise a room or flat, or find one, among people who live in the area — and check a
        person&apos;s community reputation before you commit.
      </p>

      <h2>Safety features</h2>
      <p>
        Send a community alert when you need help, see alerts from neighbours, and set up a trust
        circle of people who can check in on you.
      </p>

      <h2>On your phone</h2>
      <p>
        The Resident works in any browser. You can also install it on Android or add it to your
        iPhone home screen from the <Link href="/">home page</Link>.
      </p>

      <div className={styles.cta}>
        <p style={{ marginBottom: 0 }}>
          Have a question? See the <Link href="/faq">FAQ</Link> or <Link href="/auth">join your suburb</Link> now.
        </p>
      </div>
    </>
  )
}
