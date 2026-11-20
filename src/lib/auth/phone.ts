import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export function normalizePhoneToE164(
  rawInput: string,
  defaultCountry: CountryCode = 'SN'
): string | null {
  const cleaned = rawInput.trim();
  if (!cleaned) return null;

  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
}

export function e164ToInternalEmail(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Numéro E.164 invalide pour la génération d’identifiant');
  }
  return `${digits}@ziyara.local`;
}
