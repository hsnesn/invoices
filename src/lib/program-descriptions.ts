/**
 * Short descriptions for TRT World programs.
 * Used in guest invite modal to help producers select programs.
 */
export const PROGRAM_DESCRIPTIONS: Record<string, string> = {
  Roundtable:
    "Debate programme bringing diverse perspectives to the table. Face-to-face discussions on news and current affairs, from elections and climate policy to international conflicts.",
  Nexus:
    "Forensic analysis of news stories. Deep dives into how events unfold and what drives global narratives.",
  "World News Bulletin":
    "Comprehensive news coverage. Regular updates on international headlines and breaking stories.",
  "Global Briefing":
    "Daily briefing on world events. Concise overview of key developments across regions.",
  Newshour:
    "In-depth news programme. Extended coverage of major stories with expert analysis and context.",
  Newsmakers:
    "Current affairs programme with unfiltered debates. Disrupts conventional perspectives on international affairs with expert guests.",
  Newsfeed:
    "Social media-driven stories. Stories that are trending and shaping the conversation online.",
  "Strait Talk":
    "Analysis of global policymakers. Interviews and discussions with decision-makers and analysts.",
  "Money Talks":
    "Economics and finance programme. In-depth reports on global markets and economic developments.",
  "Africa Matters":
    "African news and analysis. Coverage of politics, business, culture and development across the continent.",
  "Inside America":
    "US politics and policy. Interviews and analysis on American domestic and foreign policy.",
  "Global Business":
    "International business coverage. Markets, trade and corporate developments worldwide.",
  "Beyond the Game":
    "Sports stories with a wider lens. Human interest and social impact of sports.",
  Storyteller:
    "Documentaries on social and environmental change. Long-form storytelling from around the world.",
  "YouTube Special":
    "Digital-first content for YouTube. Special formats and extended coverage.",
  "Social Media Clip":
    "Short-form content for social platforms. Clips and highlights for digital audiences.",
  "Gunun Ozeti":
    "TRT Haber daily summary. Overview of the day's main stories.",
  "Aksam Bulteni":
    "TRT Haber evening bulletin. Evening news round-up.",
  "Al Youm":
    "TRT Arabi daily programme. Arabic-language news and current affairs.",
  Moubasher:
    "TRT Arabi live coverage. Real-time reporting and analysis.",
};

export function getProgramDescription(programName: string): string | null {
  const trimmed = programName?.trim();
  if (!trimmed) return null;
  const exact = PROGRAM_DESCRIPTIONS[trimmed];
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const key = Object.keys(PROGRAM_DESCRIPTIONS).find((k) => k.toLowerCase() === lower);
  return key ? PROGRAM_DESCRIPTIONS[key] : null;
}
