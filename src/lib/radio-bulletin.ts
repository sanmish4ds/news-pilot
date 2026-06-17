import { ConstitutionalLanguage } from "./languages";

export interface BulletinStory {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  source: string;
}

/** Stitch a radio bulletin locally (fallback) */
export function stitchBulletinFallback(
  lang: ConstitutionalLanguage,
  stories: BulletinStory[],
  dateLabel: string
): string {
  const n = stories.length;
  if (lang.code === "en") {
    const lines = [
      `Good evening. This is The News Noice.`,
      `Here are the top ${n} news from India for ${dateLabel}.`,
      ``,
    ];
    stories.forEach((s, i) => {
      lines.push(`Story number ${s.rank}. ${s.headline}. ${s.summary} Reporting from ${s.source}.`);
      if (i < stories.length - 1) lines.push(`Next.`);
      lines.push(``);
    });
    lines.push(`That wraps today's bulletin. Thank you for listening to The News Noice.`);
    return lines.join("\n");
  }

  if (lang.code === "hi") {
    const lines = [
      `नमस्कार। आप सुन रहे हैं The News Noice।`,
      `${dateLabel} के भारत की ${n} बड़ी खबरें।`,
      ``,
    ];
    stories.forEach((s, i) => {
      lines.push(`खबर नंबर ${s.rank}। ${s.headline}। ${s.summary} स्रोत ${s.source}।`);
      if (i < stories.length - 1) lines.push(`अगली खबर।`);
      lines.push(``);
    });
    lines.push(`आज की खबरें यहीं समाप्त। The News Noice सुनने के लिए धन्यवाद।`);
    return lines.join("\n");
  }

  if (lang.code === "mai") {
    const lines = [
      `प्रणाम। अहाँ सुनि रहल छी The News Noice।`,
      `${dateLabel}क भारतक ${n} बड़ खबर।`,
      ``,
    ];
    stories.forEach((s, i) => {
      lines.push(`खबर सङ्ख्या ${s.rank}। ${s.headline}। ${s.summary} सूचना स्रोत ${s.source}।`);
      if (i < stories.length - 1) lines.push(`अगिला खबर।`);
      lines.push(``);
    });
    lines.push(`आजक खबर इहँ समाप्त। सुनबाक लेल धन्यवाद।`);
    return lines.join("\n");
  }

  // Generic template for other languages — GPT will override
  const lines = [
    `The News Noice.`,
    `Top ${n} news from India.`,
    ``,
  ];
  stories.forEach((s, i) => {
    lines.push(`${s.rank}. ${s.headline}. ${s.summary}. ${s.source}.`);
    if (i < stories.length - 1) lines.push(`---`);
  });
  return lines.join("\n");
}

export function buildRadioBulletinPrompt(
  lang: ConstitutionalLanguage,
  dateLabel: string,
  storyCount: number
): string {
  const maiNote =
    lang.code === "mai"
      ? `
MAITHILI ONLY — Mithila radio announcer. NOT Hindi.
Use: प्रणाम, खबर सङ्ख्या, अगिला खबर, सूचना स्रोत, अछि, कहल, अखन.
Transitions: "अगिला खबर", "आ निम्न", "एहि खबर मे"`
      : "";

  return `You write a complete radio news bulletin script for ONE announcer to read aloud continuously.

Language: ${lang.name} (${lang.native})
Date: ${dateLabel}
Stories: ${storyCount}
${maiNote}

Write like ALL INDIA RADIO / FM gold bulletin — smooth, professional, for elderly listeners:
1. OPENING (2 sentences): greet, station name "The News Noice", today's date, "top ${storyCount} news from India"
2. BODY: each story flows naturally with transitions — NO awkward "news number" repetition every time. Use varied bridges:
   - "First," / "पहली खबर," / "खबर सङ्ख्या एक,"
   - "Moving on," / "अगली खबर," / "अगिला खबर,"
   - "In other news," / "इसी बीच,"
3. Each story: headline + 2 short spoken sentences + source credit woven in naturally
4. CLOSING (1-2 sentences): sign off warmly, thank listener

Rules:
- ONE continuous script — no JSON, no markdown, no stage directions
- Short sentences, natural pauses with periods
- Total length: suitable for ~8-12 minute bulletin
- Do NOT use bullet points or numbered lists — flowing speech only
- Return ONLY the script text`;
}
