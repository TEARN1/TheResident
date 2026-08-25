import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Notice — The Resident',
  description: 'What The Resident collects, why, and how to get it deleted.'
}

// ─────────────────────────────────────────────────────────────────────────
// ⚠️  BEFORE THIS GOES LIVE
// Every factual claim below was written against what the code actually
// does (res_profiles columns, the geolocation call sites, the Gruvs
// data-sharing boundary in CONTRACT.md, the security log schema) rather
// than copied from a template — an inaccurate privacy notice is a false
// representation, not a formality.
//
// Two things still need a human, and are marked OPERATOR_TODO inline:
//   1. A real contact address for data-subject requests. POPIA requires a
//      reachable Information Officer; the app has no real contact address
//      anywhere in the codebase, so one could not be filled in truthfully.
//   2. Confirmation of the operating entity's legal name/registration.
// Have someone qualified review it before publishing.
// ─────────────────────────────────────────────────────────────────────────

const OPERATOR_CONTACT = 'OPERATOR_TODO: add a real contact address'

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-black text-white">Privacy Notice</h1>
      <p className="text-xs text-gray-500">
        Written for South Africa&apos;s Protection of Personal Information Act (POPIA).
      </p>

      <h2>The short version</h2>
      <p>
        The Resident helps people find rooms, share services and look out for each other in their
        area. That needs real information about real people, so this page states exactly what is
        collected, who can see it, and how to get it removed. Nothing here is sold to advertisers.
      </p>

      <h2>What is collected</h2>

      <h3>Your account</h3>
      <p>
        The Resident and The Gruvs share one account. Your display name, username, email, avatar
        and verification status live on the shared account and are visible in both apps.
      </p>

      <h3>Your Resident profile</h3>
      <ul>
        <li>Whether you use the app as a tenant or a landlord</li>
        <li>A short bio you write</li>
        <li>A legal/formal name, only if you choose to add one</li>
        <li>Gender, number of children, employment status and whether you have pets — used to match you against a landlord&apos;s stated requirements</li>
        <li>A photo you upload for verification</li>
        <li>If you are a landlord: the preferences you set for tenants</li>
      </ul>

      <h3>Location</h3>
      <p>
        The map asks your browser for your location so it can show what is near you. That request
        is always yours to refuse — the map falls back to a world view and still works.
        <strong> Continuous location sharing is a separate, explicit toggle</strong> that is off
        unless you turn it on, shows while it is running, and stops when you turn it off.
      </p>

      <h3>What you post</h3>
      <p>
        Listings, marketplace items, notices, gossip posts, comments, reviews, disputes, safety
        reports and map reports are stored with your account attached. Direct messages are stored
        on the shared account and are readable by you and the person you are messaging.
      </p>

      <h3>Security records</h3>
      <p>
        Sign-in attempts, blocked attacks, password changes and account-affecting admin actions are
        recorded so abuse can be investigated. These include a timestamp, your account reference and
        your browser&apos;s user-agent string, and are deleted automatically after 180 days.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>Other residents</strong> — what you post publicly, plus your display name, avatar and verification status.</li>
        <li><strong>A landlord you apply to</strong> — the profile details above, so they can assess an application. This is the point of the profile.</li>
        <li><strong>The Gruvs</strong> — the shared account fields only. Your Resident-specific profile, next of kin and housing activity are not copied there.</li>
        <li><strong>Nobody else.</strong> Your data is not sold, and there is no advertising network in this app.</li>
      </ul>

      <h2>Your rights under POPIA</h2>
      <ul>
        <li><strong>See it</strong> — most of it is visible in the app; you can request the rest.</li>
        <li><strong>Correct it</strong> — profile fields are editable from Profile at any time.</li>
        <li><strong>Delete it</strong> — you can delete your account from Profile. See below for what that does and does not remove.</li>
        <li><strong>Object</strong> — you can withdraw from features (turn off location sharing, mute notifications, remove next-of-kin links) without deleting the account.</li>
        <li><strong>Complain</strong> — to us first, and to the Information Regulator of South Africa if that does not resolve it.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        Deleting removes your Resident profile, your listings, and your account access. Two things
        deliberately survive, and you should know that before you delete:
      </p>
      <ul>
        <li>
          <strong>Security records</strong>, until their 180-day expiry. Letting someone erase the
          record of a blocked attack by deleting the account that made it would defeat the point.
        </li>
        <li>
          <strong>Messages you sent to other people</strong>, in those people&apos;s inboxes — the
          same way an email you sent stays in the recipient&apos;s mailbox.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        The Resident is not intended for under-18s. Children are referenced only as a count on an
        adult&apos;s profile, for matching against a landlord&apos;s stated limits — no information
        about a child is collected.
      </p>

      <h2>Contact</h2>
      <p>
        For access, correction, deletion or a complaint: <strong>{OPERATOR_CONTACT}</strong>
      </p>
    </>
  )
}
