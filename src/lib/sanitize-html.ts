/**
 * Sanitize HTML for safe rendering (prevents XSS from Excel/Word preview content).
 * Uses isomorphic-dompurify: works in browser and Node (for SSR if needed).
 * style attribute removed to reduce CSS injection / data exfiltration risk.
 */
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "span", "div", "table", "thead", "tbody", "tr", "th", "td",
      "b", "i", "u", "strong", "em", "a", "ul", "ol", "li", "h1", "h2", "h3",
      "h4", "h5", "h6", "hr", "blockquote", "pre", "code",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "colspan", "rowspan", "align"],
  });
}
