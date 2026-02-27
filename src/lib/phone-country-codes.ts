/**
 * Country codes for phone input, ordered: UK, TR, US, key EU, then rest alphabetically.
 */
export type PhoneCountry = { code: string; name: string; dial: string };

const PRIORITY: string[] = ["GB", "TR", "US", "DE", "FR", "IT", "ES", "NL", "BE", "PL", "SE", "AT", "CH", "IE", "PT", "GR", "RO", "CZ", "HU", "FI", "NO", "DK"];

const ALL: PhoneCountry[] = [
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "CZ", name: "Czech Republic", dial: "+420" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "AF", name: "Afghanistan", dial: "+93" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AZ", name: "Azerbaijan", dial: "+994" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "BY", name: "Belarus", dial: "+375" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "CY", name: "Cyprus", dial: "+357" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "GE", name: "Georgia", dial: "+995" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "IR", name: "Iran", dial: "+98" },
  { code: "IQ", name: "Iraq", dial: "+964" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "KZ", name: "Kazakhstan", dial: "+7" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "LV", name: "Latvia", dial: "+371" },
  { code: "LB", name: "Lebanon", dial: "+961" },
  { code: "LY", name: "Libya", dial: "+218" },
  { code: "LT", name: "Lithuania", dial: "+370" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "PS", name: "Palestine", dial: "+970" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "RU", name: "Russia", dial: "+7" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "RS", name: "Serbia", dial: "+381" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "SK", name: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "SY", name: "Syria", dial: "+963" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "UZ", name: "Uzbekistan", dial: "+998" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "YE", name: "Yemen", dial: "+967" },
];

const byCode = new Map(ALL.map((c) => [c.code, c]));

const prioritySet = new Set(PRIORITY);
const sorted = [
  ...PRIORITY.filter((c) => byCode.has(c)).map((c) => byCode.get(c)!),
  ...ALL.filter((c) => !prioritySet.has(c.code)).sort((a, b) => a.code.localeCompare(b.code)),
];

export const PHONE_COUNTRIES: PhoneCountry[] = sorted;
export const DEFAULT_PHONE_COUNTRY = "GB";

/** Infer country from phone (e.g. +44... -> GB). */
export function inferPhoneCountry(phone: string | null | undefined): string {
  if (!phone?.trim()) return DEFAULT_PHONE_COUNTRY;
  const p = phone.trim();
  const digits = p.replace(/\D/g, "");
  const byDialLength = [...ALL].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byDialLength) {
    const dialDigits = c.dial.replace(/\D/g, "");
    if (p.startsWith(c.dial) || digits.startsWith(dialDigits)) return c.code;
  }
  return DEFAULT_PHONE_COUNTRY;
}
