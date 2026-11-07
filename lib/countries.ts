/**
 * Countries a creator can receive payouts in (Stripe-supported, common set).
 * Stripe needs the country before it creates the connected account, and it
 * can't be changed afterwards. Codes are ISO 3166-1 alpha-2, lowercase.
 */
export const PAYOUT_COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "ca", name: "Canada" },
  { code: "gb", name: "United Kingdom" },
  { code: "au", name: "Australia" },
  { code: "nz", name: "New Zealand" },
  { code: "ie", name: "Ireland" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "nl", name: "Netherlands" },
  { code: "be", name: "Belgium" },
  { code: "at", name: "Austria" },
  { code: "ch", name: "Switzerland" },
  { code: "se", name: "Sweden" },
  { code: "no", name: "Norway" },
  { code: "dk", name: "Denmark" },
  { code: "fi", name: "Finland" },
  { code: "pt", name: "Portugal" },
  { code: "pl", name: "Poland" },
  { code: "jp", name: "Japan" },
  { code: "sg", name: "Singapore" },
  { code: "hk", name: "Hong Kong" },
  { code: "mx", name: "Mexico" },
  { code: "ae", name: "United Arab Emirates" },
] as const;

export type PayoutCountry = (typeof PAYOUT_COUNTRIES)[number]["code"];

export const DEFAULT_PAYOUT_COUNTRY: PayoutCountry = "us";

export function isPayoutCountry(value: unknown): value is PayoutCountry {
  return typeof value === "string" && PAYOUT_COUNTRIES.some((c) => c.code === value);
}
