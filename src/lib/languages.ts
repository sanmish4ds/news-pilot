export interface ConstitutionalLanguage {
  code: string;
  name: string;
  native: string;
  /** ISO 639-1 where available; used for translation prompts */
  iso: string;
}

export const ENGLISH_OPTION: ConstitutionalLanguage = {
  code: "en",
  name: "English",
  native: "English",
  iso: "en",
};

export const HINDI_OPTION: ConstitutionalLanguage = {
  code: "hi",
  name: "Hindi",
  native: "हिन्दी",
  iso: "hi",
};

// Only English and Hindi are supported — both the language picker and
// listening (TTS) are scoped to these two everywhere in the app.
export const FEATURED_CODES = ["en", "hi"];
export const PREWARM_CODES = FEATURED_CODES;
export const ALL_LANGUAGES = [ENGLISH_OPTION, HINDI_OPTION];

export function getLanguageByCode(code: string): ConstitutionalLanguage | undefined {
  return ALL_LANGUAGES.find((l) => l.code === code);
}
