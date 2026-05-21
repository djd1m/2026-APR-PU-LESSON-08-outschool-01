/**
 * Strip HTML tags from user-generated content.
 * Simple but effective — no dependency needed for text-only fields.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}
