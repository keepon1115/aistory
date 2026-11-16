import { graphemes } from "./text";

/**
 * 原稿用紙の配置と、縦書き用の字形補正。
 * 投影画面（DOM）と保存画像（canvas）の両方がこのファイルを使うので、見た目の決まりは1か所。
 *
 * 方針: ブラウザの縦書き機能には頼らず、全部「横書きの1文字」を1マスの中央に置き、
 * 必要なものだけ回転・位置ずらしをする。DOM と canvas で同じ結果になる。
 */

export type Cell = {
  char: string;
  who: "user" | "ai";
  /** 右端の列を0とした列番号 */
  col: number;
  /** 上から数えた行番号 */
  row: number;
};

/** 来場者の言葉→AIの文章を1本につなげて、右上から縦に流し込む。入りきらない分は捨てる */
export function layoutCells(word: string, body: string, rows: number, cols: number): Cell[] {
  const chars: { char: string; who: "user" | "ai" }[] = [
    ...graphemes(word).map((char) => ({ char, who: "user" as const })),
    ...graphemes(body).map((char) => ({ char, who: "ai" as const })),
  ];
  return chars.slice(0, rows * cols).map((c, i) => ({ ...c, col: Math.floor(i / rows), row: i % rows }));
}

// 縦書きでは90度回すもの（長音・かぎ括弧・かっこ・波線・三点リーダーなど）
const ROTATE = new Set(Array.from("ー―—–〜～…‥「」『』（）()【】〔〕［］｛｝《》〈〉＜＞<>[]{}－-=＝"));
// 縦書きでは右上に寄せるもの（句読点）
const PUNCT = new Set(Array.from("、。，．"));
// 縦書きでは少しだけ右上に寄せるもの（小さいかな）
const SMALL_KANA = new Set(Array.from("ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ"));

export type GlyphTransform = {
  /** マスの大きさに対する比率 */
  dx: number;
  dy: number;
  rotate: number;
};

export function glyphTransform(char: string): GlyphTransform {
  if (ROTATE.has(char)) return { dx: 0, dy: 0, rotate: 90 };
  if (PUNCT.has(char)) return { dx: 0.5, dy: -0.5, rotate: 0 };
  if (SMALL_KANA.has(char)) return { dx: 0.1, dy: -0.1, rotate: 0 };
  return { dx: 0, dy: 0, rotate: 0 };
}

export const FONT_STACK =
  '"Shippori Mincho", "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif';
