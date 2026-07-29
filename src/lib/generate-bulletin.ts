import { getAnthropicClient, claudeText, CLAUDE_MODEL } from "./anthropic";
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
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4500,
      system: buildRadioBulletinPrompt(lang, dateLabel, stories.length),
      messages: [
        {
          role: "user",
          content: `Write the full radio bulletin for these ${stories.length} stories:\n${JSON.stringify(stories)}`,
        },
      ],
    });

    const script = claudeText(response).trim();
    if (script.length > 200) return script;
  } catch {
    /* fallback below */
  }

  return stitchBulletinFallback(lang, stories, dateLabel);
}
