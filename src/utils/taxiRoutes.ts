/**
 * taxiRoutes.ts — Minibus Taxi Telemetry, Rank Operations & Commuter Mobility Engine.
 *
 * South Africa's public transit backbone (over 70% of all daily commuter trips).
 * Bridges informal minibus taxi operations (SANTACO / Regional Taxi Associations)
 * with real-time commuter telemetry, rank opening hours, live queue tracking,
 * fare matrix lookups, front-seat change calculations, and iconic hand signals.
 */

export interface LatLon {
  lat: number
  lon: number
}

export type QueueCongestionLevel = 'cleared' | 'fast' | 'moderate' | 'congested'

export interface TaxiRoute {
  id: string
  destination: string
  corridor: string
  fareZAR: number
  travelTimeMins: number
  platformBay: string
  frequencyPeakMins: number
  frequencyOffPeakMins: number
  handSignal: {
    name: string
    description: string
    gesture: string
  }
  liveQueue: {
    status: QueueCongestionLevel
    estimatedWaitMins: number
    activeTaxisInRank: number
    marshalNotes: string
    lastUpdated: string
  }
  waypointStops: string[]
}

export interface TaxiRank {
  id: string
  name: string
  popularName: string
  city: 'JHB' | 'PTA' | 'CPT' | 'DUR'
  metroHub: string
  lat: number
  lon: number
  address: string
  association: string
  associationCode: string
  operatingHours: {
    opensAt: string
    closesAt: string
    peakMorning: string
    peakAfternoon: string
  }
  routes: TaxiRoute[]
}

export const SA_TAXI_RANKS: TaxiRank[] = [
  // --- JOHANNESBURG ---
  {
    id: 'rank-mtn-noord',
    name: 'MTN Noord Taxi Rank',
    popularName: 'Noord / Park Station Taxi Rank',
    city: 'JHB',
    metroHub: 'Braamfontein',
    lat: -26.1953,
    lon: 28.0435,
    address: 'Corner Noord & King George Streets, Johannesburg CBD',
    association: 'Greater Johannesburg Regional Taxi Council (GJRTC)',
    associationCode: 'SANTACO-GP-JHB-01',
    operatingHours: {
      opensAt: '04:30',
      closesAt: '22:00',
      peakMorning: '06:00 - 08:30',
      peakAfternoon: '16:00 - 19:30',
    },
    routes: [
      {
        id: 'noord-soweto-bara',
        destination: 'Chris Hani Baragwanath (Soweto)',
        corridor: 'M1 South / Chris Hani Rd',
        fareZAR: 22,
        travelTimeMins: 35,
        platformBay: 'Bay 12 (Ground Deck)',
        frequencyPeakMins: 3,
        frequencyOffPeakMins: 8,
        handSignal: {
          name: 'Bara / Soweto',
          description: 'Closed fist with thumb extended pointing outwards or rightward tap',
          gesture: '✊',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 5,
          activeTaxisInRank: 14,
          marshalNotes: 'Loading continuously. No backlog.',
          lastUpdated: '10 mins ago',
        },
        waypointStops: ['Parktown', 'Fordsburg', 'Crown Mines', 'Southgate', 'Baragwanath'],
      },
      {
        id: 'noord-sandton',
        destination: 'Sandton City / Gautrain',
        corridor: 'M1 North / Rivonia Rd',
        fareZAR: 26,
        travelTimeMins: 30,
        platformBay: 'Bay 4 (Upper Deck)',
        frequencyPeakMins: 5,
        frequencyOffPeakMins: 12,
        handSignal: {
          name: 'Sandton',
          description: 'Two fingers pointing upwards in a tight V or index finger pointing forward with upward tilt',
          gesture: '✌️',
        },
        liveQueue: {
          status: 'moderate',
          estimatedWaitMins: 12,
          activeTaxisInRank: 6,
          marshalNotes: 'Traffic build-up on Oxford Rd; arrivals slowed slightly.',
          lastUpdated: '5 mins ago',
        },
        waypointStops: ['Killarney', 'Rosebank', 'Illovo', 'Sandton Central'],
      },
      {
        id: 'noord-fourways',
        destination: 'Fourways Mall / Montecasino',
        corridor: 'William Nicol (Winnie Mandela Dr)',
        fareZAR: 32,
        travelTimeMins: 45,
        platformBay: 'Bay 8 (Upper Deck)',
        frequencyPeakMins: 6,
        frequencyOffPeakMins: 15,
        handSignal: {
          name: 'Fourways',
          description: 'Four outstretched fingers pointing upward',
          gesture: '🖐️',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 8,
          activeTaxisInRank: 8,
          marshalNotes: 'Full fleet deployed for afternoon peak.',
          lastUpdated: '15 mins ago',
        },
        waypointStops: ['Rosebank', 'Sandton', 'Bryanston', 'Fourways'],
      },
      {
        id: 'noord-alex',
        destination: 'Alexandra (Pan Africa)',
        corridor: 'Louis Botha Avenue',
        fareZAR: 18,
        travelTimeMins: 25,
        platformBay: 'Bay 2 (East Wing)',
        frequencyPeakMins: 4,
        frequencyOffPeakMins: 10,
        handSignal: {
          name: 'Alex / Pan Africa',
          description: 'Flat open palm waved side to side in horizontal motion',
          gesture: '👋',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 4,
          activeTaxisInRank: 18,
          marshalNotes: 'Very fast queue. Taxis departing every 3 mins.',
          lastUpdated: '3 mins ago',
        },
        waypointStops: ['Hillbrow', 'Berea', 'Orange Grove', 'Bramley', 'Pan Africa Rank'],
      },
      {
        id: 'noord-braam-local',
        destination: 'Braamfontein / Wits Campus',
        corridor: 'Bertha & Jan Smuts Ave',
        fareZAR: 14,
        travelTimeMins: 10,
        platformBay: 'Bay 1 (Exit Lane)',
        frequencyPeakMins: 2,
        frequencyOffPeakMins: 5,
        handSignal: {
          name: 'Local / Short Left',
          description: 'Index finger pointing straight down towards the ground',
          gesture: '👇',
        },
        liveQueue: {
          status: 'cleared',
          estimatedWaitMins: 2,
          activeTaxisInRank: 9,
          marshalNotes: 'Immediate seating available.',
          lastUpdated: '1 min ago',
        },
        waypointStops: ['Queen Elizabeth Bridge', 'De Korte St', 'Jorissen St', 'Wits Braamfontein Gate'],
      },
    ],
  },
  {
    id: 'rank-bree-street',
    name: 'Bree Taxi Rank (Lillian Ngoyi)',
    popularName: 'Bree Metro Mall Taxi Rank',
    city: 'JHB',
    metroHub: 'Braamfontein',
    lat: -26.2008,
    lon: 28.0336,
    address: 'Lillian Ngoyi & Simmonds St, Johannesburg CBD',
    association: 'Johannesburg Central Taxi Association (JCTA)',
    associationCode: 'SANTACO-GP-JHB-02',
    operatingHours: {
      opensAt: '04:00',
      closesAt: '22:30',
      peakMorning: '05:30 - 08:30',
      peakAfternoon: '15:30 - 19:30',
    },
    routes: [
      {
        id: 'bree-dobsonville',
        destination: 'Dobsonville / Meadowlands',
        corridor: 'Main Reef Rd / R41',
        fareZAR: 24,
        travelTimeMins: 40,
        platformBay: 'Platform 3 - Lane C',
        frequencyPeakMins: 4,
        frequencyOffPeakMins: 10,
        handSignal: {
          name: 'Meadowlands / Dobsie',
          description: 'Thumb pointing over shoulder with slight fist rotation',
          gesture: '👍',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 6,
          activeTaxisInRank: 12,
          marshalNotes: 'R41 roadworks bypassed via Maraisburg.',
          lastUpdated: '8 mins ago',
        },
        waypointStops: ['Mayfair', 'Langlaagte', 'Riverlea', 'Meadowlands Zone 2', 'Dobsonville Mall'],
      },
      {
        id: 'bree-randburg',
        destination: 'Randburg CBD (Braam Fischer)',
        corridor: 'Empire Rd & Jan Smuts Ave',
        fareZAR: 20,
        travelTimeMins: 30,
        platformBay: 'Platform 1 - Lane A',
        frequencyPeakMins: 5,
        frequencyOffPeakMins: 12,
        handSignal: {
          name: 'Randburg',
          description: 'Index finger pointing forward horizontally, drawing a slight arc',
          gesture: '👉',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 5,
          activeTaxisInRank: 7,
          marshalNotes: 'Smooth departure flow.',
          lastUpdated: '12 mins ago',
        },
        waypointStops: ['Empire Rd', 'Parktown West', 'Rosebank', 'Craighall Park', 'Randburg Square'],
      },
    ],
  },
  {
    id: 'rank-baragwanath',
    name: 'Baragwanath Transport Interchange',
    popularName: 'Bara Taxi Rank',
    city: 'JHB',
    metroHub: 'Maboneng',
    lat: -26.2628,
    lon: 27.9392,
    address: 'Old Potchefstroom Rd (Chris Hani Rd), Diepkloof, Soweto',
    association: 'Soweto Taxi Services (STS) / Baragwanath Taxi Association',
    associationCode: 'SANTACO-GP-SWT-01',
    operatingHours: {
      opensAt: '04:00',
      closesAt: '22:00',
      peakMorning: '05:00 - 08:30',
      peakAfternoon: '16:00 - 20:00',
    },
    routes: [
      {
        id: 'bara-jhb-cbd',
        destination: 'Johannesburg CBD (Noord / Bree)',
        corridor: 'Chris Hani Rd to M1 North',
        fareZAR: 22,
        travelTimeMins: 35,
        platformBay: 'Platform A - Intercity Deck',
        frequencyPeakMins: 3,
        frequencyOffPeakMins: 8,
        handSignal: {
          name: 'Joburg CBD / Town',
          description: 'Index finger pointing straight up towards the sky',
          gesture: '☝️',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 5,
          activeTaxisInRank: 20,
          marshalNotes: 'Both lanes loading at maximum cadence.',
          lastUpdated: '4 mins ago',
        },
        waypointStops: ['Diepkloof Ext', 'Booysens Reserve', 'Selby', 'Bree Street', 'Noord'],
      },
    ],
  },

  // --- PRETORIA ---
  {
    id: 'rank-bloed-street',
    name: 'Bloed Street Mall Taxi Rank',
    popularName: 'Bloed Street Rank',
    city: 'PTA',
    metroHub: 'Hatfield',
    lat: -25.7423,
    lon: 28.1912,
    address: 'Bloed & Sisulu Streets, Pretoria Central',
    association: 'Tshwane Greater Taxi Association (TGTA)',
    associationCode: 'SANTACO-GP-TSH-01',
    operatingHours: {
      opensAt: '04:30',
      closesAt: '21:30',
      peakMorning: '06:00 - 08:30',
      peakAfternoon: '15:30 - 18:30',
    },
    routes: [
      {
        id: 'bloed-hatfield-up',
        destination: 'Hatfield / University of Pretoria',
        corridor: 'Pretorius & Stanza Bopape St',
        fareZAR: 17,
        travelTimeMins: 20,
        platformBay: 'Bay 5',
        frequencyPeakMins: 4,
        frequencyOffPeakMins: 10,
        handSignal: {
          name: 'Hatfield / UP',
          description: 'Peace sign tilted at 45 degrees towards the shoulder',
          gesture: '✌️',
        },
        liveQueue: {
          status: 'cleared',
          estimatedWaitMins: 3,
          activeTaxisInRank: 11,
          marshalNotes: 'Student queue flowing smoothly.',
          lastUpdated: '14 mins ago',
        },
        waypointStops: ['Arcadia', 'Loftus Versfeld', 'Burnett St', 'Hatfield Plaza'],
      },
      {
        id: 'bloed-mamelodi',
        destination: 'Mamelodi East / Denlyn Mall',
        corridor: 'N4 Eastern Bypass / Simon Vermooten',
        fareZAR: 24,
        travelTimeMins: 40,
        platformBay: 'Bay 12',
        frequencyPeakMins: 4,
        frequencyOffPeakMins: 12,
        handSignal: {
          name: 'Mamelodi',
          description: 'Three fingers pointing right with open wrist',
          gesture: '🤟',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 7,
          activeTaxisInRank: 16,
          marshalNotes: 'High fleet turnover.',
          lastUpdated: '6 mins ago',
        },
        waypointStops: ['Silverton', 'Eersterust Offramp', 'Tsabaya Ave', 'Denlyn Mall'],
      },
    ],
  },

  // --- CAPE TOWN ---
  {
    id: 'rank-cpt-deck',
    name: 'Cape Town Station Deck Taxi Rank',
    popularName: 'Station Deck Rank',
    city: 'CPT',
    metroHub: 'Cape Town CBD',
    lat: -33.9218,
    lon: 18.4243,
    address: 'Old Marine Drive, Above Cape Town Station, Cape Town CBD',
    association: 'Cape Amalgamated Taxi Association (CATA) & CODETA Joint Council',
    associationCode: 'SANTACO-WC-CPT-01',
    operatingHours: {
      opensAt: '05:00',
      closesAt: '21:30',
      peakMorning: '06:00 - 09:00',
      peakAfternoon: '15:30 - 19:00',
    },
    routes: [
      {
        id: 'deck-khayelitsha',
        destination: 'Khayelitsha (Site C & Kuyasa)',
        corridor: 'N2 Outbound',
        fareZAR: 27,
        travelTimeMins: 45,
        platformBay: 'A-Deck Lane 3',
        frequencyPeakMins: 4,
        frequencyOffPeakMins: 12,
        handSignal: {
          name: 'Khayelitsha',
          description: 'Open hand pointing forward, tapping downward twice',
          gesture: '🫱',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 8,
          activeTaxisInRank: 22,
          marshalNotes: 'Buses also running; taxi ranks clear.',
          lastUpdated: '10 mins ago',
        },
        waypointStops: ['Woodstock', 'Mowbray', 'Athlone', 'Nyanga Junction', 'Site C'],
      },
      {
        id: 'deck-camps-bay',
        destination: 'Camps Bay / Clifton Beach',
        corridor: 'Kloof Nek Rd',
        fareZAR: 18,
        travelTimeMins: 20,
        platformBay: 'B-Deck Lane 1',
        frequencyPeakMins: 6,
        frequencyOffPeakMins: 15,
        handSignal: {
          name: 'Camps Bay',
          description: 'Flat hand waving up and over like an ocean wave',
          gesture: '🌊',
        },
        liveQueue: {
          status: 'cleared',
          estimatedWaitMins: 2,
          activeTaxisInRank: 8,
          marshalNotes: 'Sunny weather; beach-goers moving steadily.',
          lastUpdated: '7 mins ago',
        },
        waypointStops: ['Buitengracht St', 'Kloof Nek', 'Camps Bay Strip'],
      },
    ],
  },

  // --- DURBAN ---
  {
    id: 'rank-warwick-junction',
    name: 'Warwick Junction Taxi Interchange',
    popularName: 'Berea Station / Brook Street Rank',
    city: 'DUR',
    metroHub: 'Florida Rd',
    lat: -29.8576,
    lon: 31.0118,
    address: 'Market Rd & Brook St, Berea / Durban Central',
    association: 'Durban Long Distance & Regional Taxi Association (DLDRTA)',
    associationCode: 'SANTACO-KZN-ETK-01',
    operatingHours: {
      opensAt: '04:30',
      closesAt: '21:30',
      peakMorning: '05:30 - 08:30',
      peakAfternoon: '15:30 - 19:00',
    },
    routes: [
      {
        id: 'warwick-umlazi',
        destination: 'Umlazi Mega City / V-Section',
        corridor: 'M4 South / Mangosuthu Highway',
        fareZAR: 23,
        travelTimeMins: 35,
        platformBay: 'Brook St Deck 2',
        frequencyPeakMins: 3,
        frequencyOffPeakMins: 8,
        handSignal: {
          name: 'Umlazi',
          description: 'Two fingers hooked downward like a letter U',
          gesture: '🤘',
        },
        liveQueue: {
          status: 'fast',
          estimatedWaitMins: 5,
          activeTaxisInRank: 19,
          marshalNotes: 'Regular departures. No delays on M4.',
          lastUpdated: '9 mins ago',
        },
        waypointStops: ['Congella', 'Montclair', 'Mobeni', 'Umlazi Station', 'Mega City'],
      },
    ],
  },
]

/**
 * Calculates straight-line distance in kilometres.
 */
export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371
  const toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR
  const dLon = (b.lon - a.lon) * toR
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Finds all taxi ranks within radiusKm of a coordinate, sorted by proximity.
 */
export function getTaxiRanksNear(lat: number, lon: number, maxKm = 25): (TaxiRank & { distanceKm: number })[] {
  const origin: LatLon = { lat, lon }
  return SA_TAXI_RANKS.map(rank => ({
    ...rank,
    distanceKm: Math.round(distanceKm(origin, { lat: rank.lat, lon: rank.lon }) * 10) / 10,
  }))
    .filter(rank => rank.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/**
 * Searches taxi routes matching a destination or corridor query.
 */
export function searchTaxiDestinations(
  query: string
): { rank: TaxiRank; route: TaxiRoute; matchScore: number }[] {
  if (!query || query.trim().length === 0) return []
  const q = query.trim().toLowerCase()
  const results: { rank: TaxiRank; route: TaxiRoute; matchScore: number }[] = []

  for (const rank of SA_TAXI_RANKS) {
    for (const route of rank.routes) {
      let score = 0
      const dest = route.destination.toLowerCase()
      const corr = route.corridor.toLowerCase()
      const stops = route.waypointStops.map(s => s.toLowerCase()).join(' ')
      const rankName = rank.name.toLowerCase()

      if (dest === q) score += 100
      else if (dest.includes(q)) score += 50
      else if (corr.includes(q)) score += 30
      else if (stops.includes(q)) score += 25
      else if (rankName.includes(q)) score += 15

      if (score > 0) {
        results.push({ rank, route, matchScore: score })
      }
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Logic 147 Extended: Front-seat Minibus Taxi Change Dispenser Calculator.
 *
 * The passenger sitting in the front passenger seat ("Passenger in the front")
 * acts as the de-facto cashier for the taxi driver, collecting money from all rows,
 * totaling fares, giving change, and passing the net amount to the driver.
 *
 * Calculates change total and the exact physical coin and note breakdown.
 */
export interface TaxiChangeBreakdown {
  farePerPersonZAR: number
  passengersPaid: number
  totalFareDueZAR: number
  amountTenderedZAR: number
  changeDueZAR: number
  isShortPayment: boolean
  shortfallZAR: number
  coinsAndNotes: {
    notesR50: number
    notesR20: number
    notesR10: number
    coinsR5: number
    coinsR2: number
    coinsR1: number
    coins50c: number
  }
  summaryText: string
}

export function calculateTaxiFrontSeatChange(
  farePerPersonZAR: number,
  passengersPaid: number,
  amountTenderedZAR: number
): TaxiChangeBreakdown {
  const totalFareDueZAR = farePerPersonZAR * passengersPaid
  const diff = amountTenderedZAR - totalFareDueZAR
  const isShortPayment = diff < 0
  const shortfallZAR = isShortPayment ? Math.abs(diff) : 0
  const changeDueZAR = isShortPayment ? 0 : diff

  // Coin & Note distribution breakdown
  let remainingCents = Math.round(changeDueZAR * 100)
  const notesR50 = Math.floor(remainingCents / 5000)
  remainingCents %= 5000
  const notesR20 = Math.floor(remainingCents / 2000)
  remainingCents %= 2000
  const notesR10 = Math.floor(remainingCents / 1000)
  remainingCents %= 1000
  const coinsR5 = Math.floor(remainingCents / 500)
  remainingCents %= 500
  const coinsR2 = Math.floor(remainingCents / 200)
  remainingCents %= 200
  const coinsR1 = Math.floor(remainingCents / 100)
  remainingCents %= 100
  const coins50c = Math.floor(remainingCents / 50)

  let summaryText = ''
  if (isShortPayment) {
    summaryText = `⚠️ Short payment by R${shortfallZAR.toFixed(2)}. Tendered R${amountTenderedZAR} for ${passengersPaid} @ R${farePerPersonZAR}.`
  } else if (changeDueZAR === 0) {
    summaryText = `✅ Exact fare: R${totalFareDueZAR}. No change needed.`
  } else {
    const parts: string[] = []
    if (notesR50 > 0) parts.push(`${notesR50}x R50`)
    if (notesR20 > 0) parts.push(`${notesR20}x R20`)
    if (notesR10 > 0) parts.push(`${notesR10}x R10`)
    if (coinsR5 > 0) parts.push(`${coinsR5}x R5`)
    if (coinsR2 > 0) parts.push(`${coinsR2}x R2`)
    if (coinsR1 > 0) parts.push(`${coinsR1}x R1`)
    if (coins50c > 0) parts.push(`${coins50c}x 50c`)
    summaryText = `Change R${changeDueZAR.toFixed(2)} (${parts.join(', ') || 'Cash'})`
  }

  return {
    farePerPersonZAR,
    passengersPaid,
    totalFareDueZAR,
    amountTenderedZAR,
    changeDueZAR,
    isShortPayment,
    shortfallZAR,
    coinsAndNotes: {
      notesR50,
      notesR20,
      notesR10,
      coinsR5,
      coinsR2,
      coinsR1,
      coins50c,
    },
    summaryText,
  }
}

/**
 * Returns a quick cheat-sheet of South African taxi hand signals.
 */
export function getTaxiHandSignalGuide(): {
  signalName: string
  meaning: string
  gestureEmoji: string
  region: string
}[] {
  return [
    {
      signalName: 'Index Finger Downward',
      meaning: 'Local / Short Left (dropping off within 1–3 km or inside the neighbourhood)',
      gestureEmoji: '👇',
      region: 'National',
    },
    {
      signalName: 'Index Finger Pointing Up',
      meaning: 'Joburg CBD / Pretoria CBD / Central Town',
      gestureEmoji: '☝️',
      region: 'Gauteng',
    },
    {
      signalName: 'Closed Fist (Thumb Right)',
      meaning: 'Baragwanath / Soweto / Hospital',
      gestureEmoji: '✊',
      region: 'Gauteng',
    },
    {
      signalName: 'Two Fingers Up (V)',
      meaning: 'Sandton / Rosebank / Bree Street',
      gestureEmoji: '✌️',
      region: 'Gauteng',
    },
    {
      signalName: 'Four Fingers Extended',
      meaning: 'Fourways / Douglasdale',
      gestureEmoji: '🖐️',
      region: 'Johannesburg North',
    },
    {
      signalName: 'Palm Wave Horizontal',
      meaning: 'Alexandra / Pan Africa / Wynberg',
      gestureEmoji: '👋',
      region: 'Johannesburg East',
    },
    {
      signalName: 'Downward Tap Twice',
      meaning: 'Khayelitsha / Mitchells Plain',
      gestureEmoji: '🫱',
      region: 'Western Cape',
    },
    {
      signalName: 'Hooked Downward U',
      meaning: 'Umlazi / KwaMashu',
      gestureEmoji: '🤘',
      region: 'KwaZulu-Natal',
    },
  ]
}
