/**
 * Parse @Name mentions in message content and return segments for rendering.
 * Matches @ followed by word characters (letters, numbers, underscore).
 */
export type ContentSegment = { type: "text"; text: string } | { type: "mention"; text: string };

export function parseMentions(content: string): ContentSegment[] {
  if (!content) return [];
  const re = /@(\w+)/g;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, m.index) });
    }
    segments.push({ type: "mention", text: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", text: content }];
}
