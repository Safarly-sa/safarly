/** Pulled out of the embed component so the parsing itself is unit-testable without mounting React. */
export function extractTikTokId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}
