import { ConstitutionalLanguage } from "./languages";
import { UiStrings } from "./ui-strings";

/** Languages often mis-translated as Hindi */
export const HINDI_CONFUSABLE_CODES = new Set(["mai", "doi", "kok", "ne", "brx", "ks", "sa"]);

const LANGUAGE_RULES: Record<string, string> = {
  mai: `MAITHILI ONLY (Mithila/Bihar). NOT Hindi. Use: अछि, अखन, एहि, हमर, खबर सङ्ख्या, अगिला खबर, सूचना स्रोत.`,
  hi: `Simple Hindi TV news for 50+ listeners.`,
  bn: `Bengali script only.`,
  ta: `Tamil script only.`,
  te: `Telugu script only.`,
  mr: `Marathi, not Hindi.`,
  ur: `Urdu Perso-Arabic script.`,
};

export function getTranslationModel(languageCode: string): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function buildTranslationSystemPrompt(
  lang: ConstitutionalLanguage,
  newsCount: number,
  dateLabel: string
): string {
  const specific = LANGUAGE_RULES[lang.code] || "";

  return `Translate Indian news for elderly radio listeners into ${lang.name} (${lang.native}).
${specific}

Return JSON with:
1. "news": array of { id, rank, headline, summary, source } — headline/summary in ${lang.name}
2. "ui": { title, subtitle, chooseLanguage, playBulletin, listenAllStories, listenStory, radioMode, storiesMode, pause, stop, refresh, onAir, preparingBulletin, loadingNews, preparingNews, voiceNatural, voiceBrowser, voiceNotReady, nowPlaying, readyToPlay, storyLabel } (no em dashes in any string)
3. "bulletinScript": ONE continuous radio bulletin (max 2000 chars) for text-to-speech:
   - Open: greet + "News Pilot Radio" + date ${dateLabel}
   - ${newsCount} stories with smooth transitions (not robotic numbering every time)
   - Close: warm sign-off
   - Short sentences, natural spoken ${lang.name}, flowing like ALL INDIA RADIO
   - NO markdown, NO JSON inside bulletinScript

Keep total response compact. bulletinScript is the most important field for audio.`;
}
