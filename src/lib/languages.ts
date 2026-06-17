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

export const ALL_LANGUAGES = [ENGLISH_OPTION, ...CONSTITUTIONAL_LANGUAGES];

export function getLanguageByCode(code: string): ConstitutionalLanguage | undefined {
  return ALL_LANGUAGES.find((l) => l.code === code);
}
