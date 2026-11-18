import { COLORS, EVENT_LABEL, IMAGE_GRID } from "./config";
import { FONT_STACK, glyphTransform, layoutCells } from "./manuscript";

const CELL = 64;
const MARGIN = 72;
const FOOTER = 72;
const LABEL_SIZE = 24;

/** 保存画像の大きさ（scale = 1 のとき）。一覧の枠の縦横比にも使う */
export const STORY_IMAGE_SIZE = {
  width: CELL * IMAGE_GRID.cols + MARGIN * 2,
  height: CELL * IMAGE_GRID.rows + MARGIN * 2 + FOOTER,
};

function fontFamily(): string {
  const fam = getComputedStyle(document.body).fontFamily;
  return fam && fam !== "" ? fam : FONT_STACK;
}

/** 本文に含まれる文字のフォントが読み込み済みになるまで待つ（最大8秒）。失敗しても描画は続ける */
async function waitForFont(text: string, family: string, cell: number): Promise<void> {
  // 代替フォント付きの一覧ではなく、先頭の1つだけを読み込む
  const primary = family.split(",")[0].trim();
  const load = Promise.allSettled([
    document.fonts.load(`500 ${Math.round(cell * 0.74)}px ${primary}`, text),
    document.fonts.load(`500 ${LABEL_SIZE}px ${primary}`, EVENT_LABEL),
  ]).then(() => document.fonts.ready);
  await Promise.race([load, new Promise((r) => setTimeout(r, 8000))]);
}

/**
 * 保存用の縦長画像を canvas に描いて PNG にする。サーバーは使わない。
 * scale を小さくすると、同じ見た目の小さい画像になる（ライブラリの一覧用）。
 */
export async function renderStoryImage(word: string, body: string, scale = 1): Promise<Blob> {
  const CELL_S = Math.round(CELL * scale);
  const MARGIN_S = Math.round(MARGIN * scale);
  const FOOTER_S = Math.round(FOOTER * scale);
  const LABEL_S = Math.max(8, Math.round(LABEL_SIZE * scale));
  const family = fontFamily();
  await waitForFont(word + body + EVENT_LABEL, family, CELL_S);

  const { rows, cols } = IMAGE_GRID;
  const gridW = CELL_S * cols;
  const gridH = CELL_S * rows;
  const width = gridW + MARGIN_S * 2;
  const height = gridH + MARGIN_S * 2 + FOOTER_S;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // マス目
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(MARGIN_S + c * CELL_S, MARGIN_S);
    ctx.lineTo(MARGIN_S + c * CELL_S, MARGIN_S + gridH);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(MARGIN_S, MARGIN_S + r * CELL_S);
    ctx.lineTo(MARGIN_S + gridW, MARGIN_S + r * CELL_S);
  }
  ctx.stroke();

  // 文字（右上から縦に流れる）
  const fontSize = CELL_S * 0.74;
  ctx.font = `500 ${fontSize}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of layoutCells(word, body, rows, cols)) {
    const t = glyphTransform(c.char);
    const cx = MARGIN_S + (cols - 1 - c.col) * CELL_S + CELL_S / 2;
    const cy = MARGIN_S + c.row * CELL_S + CELL_S / 2;
    ctx.save();
    ctx.translate(cx + t.dx * fontSize, cy + t.dy * fontSize);
    ctx.rotate((t.rotate * Math.PI) / 180);
    ctx.fillStyle = c.who === "user" ? COLORS.user : COLORS.ai;
    ctx.fillText(c.char, 0, 0);
    ctx.restore();
  }

  // 隅のラベル
  ctx.font = `500 ${LABEL_S}px ${family}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(EVENT_LABEL, width - MARGIN_S, height - MARGIN_S / 2 - 8 * scale);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

/** ①共有シート ②ダウンロード、の順に試す。画像そのものの表示は呼び出し側が行う。 */
export async function saveImage(blob: Blob): Promise<SaveOutcome> {
  const file = new File([blob], "monogatari.png", { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // 共有に失敗したらダウンロードへ
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "monogatari.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
