import { getOpenAIClient, openaiText } from "./openai";
import { ConstitutionalLanguage } from "./languages";
import {
  buildRadioBulletinPrompt,
  BulletinStory,
  stitchBulletinFallback,
} from "./radio-bulletin";

export async function generateRadioBulletin(
  lang: ConstitutionalLanguage,
  stories: BulletinStory[],
  dateLabel: string
): Promise<string> {
  if (!stories.length) return "";

  try {
    const client = getOpenAIClient();

    const script = (
      await openaiText(client, {
        system: buildRadioBulletinPrompt(lang, dateLabel, stories.length),
        userContent: `Write the full radio bulletin for these ${stories.length} stories:\n${JSON.stringify(stories)}`,
        maxTokens: 4500,
      })
    ).trim();
    if (script.length > 200) return script;
  } catch {
    /* fallback below */
  }

  return stitchBulletinFallback(lang, stories, dateLabel);
}
