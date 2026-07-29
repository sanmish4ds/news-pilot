/** 22 languages listed in the Eighth Schedule of the Constitution of India */
export interface ConstitutionalLanguage {
  code: string;
  name: string;
  native: string;
  /** ISO 639-1 where available; used for translation prompts */
  iso: string;
}

export const CONSTITUTIONAL_LANGUAGES: ConstitutionalLanguage[] = [
  { code: "as", name: "Assamese", native: "অসমীয়া", iso: "as" },
  { code: "bn", name: "Bengali", native: "বাংলা", iso: "bn" },
  { code: "brx", name: "Bodo", native: "बड़ो", iso: "brx" },
  { code: "doi", name: "Dogri", native: "डोगरी", iso: "doi" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", iso: "gu" },
  { code: "hi", name: "Hindi", native: "हिन्दी", iso: "hi" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", iso: "kn" },
  { code: "ks", name: "Kashmiri", native: "कॉशुर", iso: "ks" },
  { code: "kok", name: "Konkani", native: "कोंकणी", iso: "kok" },
  { code: "mai", name: "Maithili", native: "मैथिली", iso: "mai" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", iso: "ml" },
  { code: "mni", name: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ", iso: "mni" },
  { code: "mr", name: "Marathi", native: "मराठी", iso: "mr" },
  { code: "ne", name: "Nepali", native: "नेपाली", iso: "ne" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", iso: "or" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", iso: "pa" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्", iso: "sa" },
  { code: "sat", name: "Santhali", native: "ᱥᱟᱱᱛᱟᱲᱤ", iso: "sat" },
  { code: "sd", name: "Sindhi", native: "سنڌي", iso: "sd" },
  { code: "ta", name: "Tamil", native: "தமிழ்", iso: "ta" },
  { code: "te", name: "Telugu", native: "తెలుగు", iso: "te" },
  { code: "ur", name: "Urdu", native: "اردو", iso: "ur" },
];

export const ENGLISH_OPTION: ConstitutionalLanguage = {
  code: "en",
  name: "English",
  native: "English",
  iso: "en",
};

/**
 * Approximate rank by number of speakers in India (2011 Census mother-tongue
 * figures), used to order the language picker after the fixed English/Hindi/
 * Maithili head. Lower number = more speakers = appears earlier.
 */
const SPEAKER_RANK: Record<string, number> = {
  bn: 1, // Bengali ~97M
  mr: 2, // Marathi ~83M
  te: 3, // Telugu ~81M
  ta: 4, // Tamil ~69M
  gu: 5, // Gujarati ~55M
  ur: 6, // Urdu ~50M
  kn: 7, // Kannada ~43M
  or: 8, // Odia ~37M
  ml: 9, // Malayalam ~34M
  pa: 10, // Punjabi ~33M
  as: 11, // Assamese ~15M
  sat: 12, // Santhali ~7.4M
  ks: 13, // Kashmiri ~6.8M
  ne: 14, // Nepali ~2.9M
  doi: 15, // Dogri ~2.6M
  kok: 16, // Konkani ~2.3M
  sd: 17, // Sindhi ~2.7M
  mni: 18, // Manipuri ~1.8M
  brx: 19, // Bodo ~1.4M
  sa: 20, // Sanskrit — negligible native speakers
};

const FEATURED_CODES = ["en", "hi", "mai"];

export const ALL_LANGUAGES = [
  ENGLISH_OPTION,
  ...CONSTITUTIONAL_LANGUAGES.filter((l) => l.code === "hi"),
  ...CONSTITUTIONAL_LANGUAGES.filter((l) => l.code === "mai"),
  ...CONSTITUTIONAL_LANGUAGES.filter((l) => !FEATURED_CODES.includes(l.code)).sort(
    (a, b) => (SPEAKER_RANK[a.code] ?? 99) - (SPEAKER_RANK[b.code] ?? 99)
  ),
];

export function getLanguageByCode(code: string): ConstitutionalLanguage | undefined {
  return ALL_LANGUAGES.find((l) => l.code === code);
}
