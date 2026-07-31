import { ConstitutionalLanguage } from "./languages";
import { UiStrings } from "./ui-strings";

/** Languages often mis-translated as Hindi */
export const HINDI_CONFUSABLE_CODES = new Set(["mai", "doi", "kok", "ne", "brx", "ks", "sa"]);

const LANGUAGE_RULES: Record<string, string> = {
  mai: `MAITHILI ONLY (Mithila/Bihar). NOT Hindi. Use: अछि, अखन, एहि, हमर, खबर सङ्ख्या, अगिला खबर, सूचना स्रोत.`,
  hi: `Simple Hindi TV news for 50+ listeners. Energetic prime-time news-anchor delivery — brisk, punchy sentences, natural spoken emphasis (e.g. "बड़ी खबर", "अभी-अभी", "चलिए जानते हैं"), not a flat/monotone reading. Use ! and short pauses ("।") to land emphasis, without overdoing exclamations.`,
  bn: `Bengali script only.`,
  ta: `Tamil script only.`,
  te: `Telugu script only.`,
  mr: `Marathi, not Hindi.`,
  ur: `Urdu Perso-Arabic script.`,
};

export function getTranslationModel(): string {
  return "gpt-4o-mini";
}

/** Prompt used to translate the full news array in a single call. */
export function buildNewsChunkPrompt(lang: ConstitutionalLanguage): string {
  const specific = LANGUAGE_RULES[lang.code] || "";
  return `Translate Indian news headlines for elderly radio listeners into ${lang.name} (${lang.native}).
${specific}

Return ONLY raw JSON, no markdown fence, no commentary: { "news": array of { id, rank, headline, summary, source } — headline/summary translated into ${lang.name} }.`;
}

/** Used when the bulletin comes from a local template — only "ui" strings are needed from the model. */
export function buildUiOnlyPrompt(lang: ConstitutionalLanguage, newsCount: number): string {
  return `Translate these UI labels for a news radio app into ${lang.name} (${lang.native}), for elderly listeners.

Return ONLY raw JSON, no markdown fence, no commentary: { "ui": { title, subtitle, chooseLanguage, playBulletin, listenAllStories, listenStory, radioMode, storiesMode, pause, stop, refresh, onAir, preparingBulletin, loadingNews, preparingNews, voiceBrowser, voiceNotReady, nowPlaying, readyToPlay, storyLabel, headlines } }. title must be "The News Noice: " plus localized "Today's Top ${newsCount} News from India" (brand name The News Noice appears only once, no em dashes). headlines is a short section heading meaning "Today's Headlines".`;
}
