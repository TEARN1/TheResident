// Global multi-currency support engine for The Resident
// Provides instant currency switching, exchange rate conversion, and formatting worldwide.

export interface CurrencyConfig {
  code: string
  symbol: string
  label: string
  flag: string
  rateAgainstUSD: number // Base USD = 1.0
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar', flag: '🇺🇸', rateAgainstUSD: 1.0 },
  { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺', rateAgainstUSD: 0.92 },
  { code: 'GBP', symbol: '£', label: 'British Pound', flag: '🇬🇧', rateAgainstUSD: 0.79 },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand', flag: '🇿🇦', rateAgainstUSD: 18.25 },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling', flag: '🇰🇪', rateAgainstUSD: 129.5 },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira', flag: '🇳🇬', rateAgainstUSD: 1540.0 },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar', flag: '🇨🇦', rateAgainstUSD: 1.38 },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', flag: '🇦🇺', rateAgainstUSD: 1.54 },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', flag: '🇯🇵', rateAgainstUSD: 155.0 },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real', flag: '🇧🇷', rateAgainstUSD: 5.65 }
]

export function getCurrencyConfig(code: string): CurrencyConfig {
  const normalized = (code || 'ZAR').toUpperCase().trim()
  return SUPPORTED_CURRENCIES.find(c => c.code === normalized) || {
    code: normalized,
    symbol: normalized,
    label: normalized,
    flag: '🌐',
    rateAgainstUSD: 1.0
  }
}

/**
 * Converts an amount from one currency to another using exchange rates.
 */
export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string
): number {
  if (fromCode.toUpperCase() === toCode.toUpperCase()) return amount
  const fromConfig = getCurrencyConfig(fromCode)
  const toConfig = getCurrencyConfig(toCode)

  // Convert to base USD first, then to target
  const amountInUSD = amount / (fromConfig.rateAgainstUSD || 1.0)
  const targetAmount = amountInUSD * (toConfig.rateAgainstUSD || 1.0)
  
  return Math.round(targetAmount)
}

/**
 * Automatically detects sensible initial currency from user's locale or timezone.
 */
export function detectUserCurrency(): string {
  if (typeof window === 'undefined') return 'ZAR'
  
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.includes('Africa/Johannesburg')) return 'ZAR'
    if (tz.includes('Africa/Nairobi')) return 'KES'
    if (tz.includes('Africa/Lagos')) return 'NGN'
    if (tz.includes('London')) return 'GBP'
    if (tz.includes('Paris') || tz.includes('Berlin') || tz.includes('Rome') || tz.includes('Madrid') || tz.includes('Amsterdam')) return 'EUR'
    if (tz.includes('Tokyo')) return 'JPY'
    if (tz.includes('Sao_Paulo')) return 'BRL'
    if (tz.includes('Toronto') || tz.includes('Vancouver')) return 'CAD'
    if (tz.includes('Sydney') || tz.includes('Melbourne')) return 'AUD'
    if (tz.includes('New_York') || tz.includes('Chicago') || tz.includes('Los_Angeles') || tz.includes('America')) return 'USD'
  } catch {
    // fallback
  }

  return 'USD'
}
