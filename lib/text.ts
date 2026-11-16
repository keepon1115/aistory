import { WORD_MAX, WORD_MIN } from "./config";

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

/** 見た目の1文字単位に分ける */
export function graphemes(text: string): string[] {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u20E3]/u;
const NEWLINE = /[\r\n\u2028\u2029]/;
const CONTROL = /[\p{Cc}\p{Cf}]/u;

export type WordCheck = { ok: true; word: string } | { ok: false; message: string };

/** 入力された言葉の形式チェック（画面とサーバーで同じものを使う） */
export function validateWord(raw: string): WordCheck {
  if (NEWLINE.test(raw)) return { ok: false, message: "改行は使えません。1行で書いてみてください。" };
  const word = raw.normalize("NFC").trim();
  if (word === "") return { ok: false, message: "言葉を入れてみてください。" };
  if (EMOJI.test(word)) return { ok: false, message: "絵文字は使えません。ことばで書いてみてください。" };
  if (CONTROL.test(word)) return { ok: false, message: "使えない文字が入っています。" };
  const n = graphemes(word).length;
  if (n < WORD_MIN) return { ok: false, message: `${WORD_MIN}文字以上で書いてみてください。` };
  if (n > WORD_MAX) return { ok: false, message: `${WORD_MAX}文字までで書いてみてください。（いま${n}文字）` };
  return { ok: true, word };
}
