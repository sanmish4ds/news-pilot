import { getOpenAIClient } from "./openai";
import { ConstitutionalLanguage } from "./languages";
import {
  buildRadioBulletinPrompt,
  BulletinStory,
  stitchBulletinFallback,
} from "./radio-bulletin";
import { getTranslationModel } from "./translation-prompts";

export async function generateRadioBulletin(
  lang: ConstitutionalLanguage,
  stories: BulletinStory[],
  dateLabel: string
): Promise<string> {
  if (!stories.length) return "";

  try {
    const client = getOpenAIClient();
    const model = getTranslationModel(lang.code);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildRadioBulletinPrompt(lang, dateLabel, stories.length),
        },
        {
          role: "user",
          content: `Write the full radio bulletin for these ${stories.length} stories:\n${JSON.stringify(stories)}`,
        },
      ],
      max_tokens: 4500,
      temperature: lang.code === "mai" ? 0.3 : 0.5,
    });

    const script = response.choices[0]?.message?.content?.trim();
    if (script && script.length > 200) return script;
  } catch {
    /* fallback below */
  }

  return stitchBulletinFallback(lang, stories, dateLabel);
}
