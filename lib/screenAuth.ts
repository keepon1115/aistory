import "server-only";
import { timingSafeEqual } from "node:crypto";

/** /screen 用APIの合言葉チェック。SCREEN_KEY が未設定なら常に拒否する。 */
export function isScreenKeyValid(given: string | null): boolean {
  const expected = process.env.SCREEN_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
