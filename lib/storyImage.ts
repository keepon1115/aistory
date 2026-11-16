import { COLORS, EVENT_LABEL, IMAGE_GRID } from "./config";
import { FONT_STACK, glyphTransform, layoutCells } from "./manuscript";

const CELL = 64;
const MARGIN = 72;
const FOOTER = 72;

function fontFamily(): string {
  const fam = getComputedStyle(document.body).fontFamily;
  return fam && fam !== "" ? fam : FONT_STACK;
}

/** 本文に含まれる文字のフォントが読み込み済みになるまで待つ（最大8秒）。失敗しても描画は続ける */
async function waitForFont(text: string, family: string): Promise<void> {
  // 代替フォント付きの一覧ではなく、先頭の1つだけを読み込む
  const primary = family.split(",")[0].trim();
  const load = Promise.allSettled([
    document.fonts.load(`500 ${Math.round(CELL * 0.74)}px ${primary}`, text),
    document.fonts.load(`500 24px ${primary}`, EVENT_LABEL),
  ]).then(() => document.fonts.ready);
  await Promise.race([load, new Promise((r) => setTimeout(r, 8000))]);
}

/** 保存用の縦長画像を canvas に描いて PNG にする。サーバーは使わない。 */
export async function renderStoryImage(word: string, body: string): Promise<Blob> {
  const family = fontFamily();
  await waitForFont(word + body + EVENT_LABEL, family);

  const { rows, cols } = IMAGE_GRID;
  const gridW = CELL * cols;
  const gridH = CELL * rows;
  const width = gridW + MARGIN * 2;
  const height = gridH + MARGIN * 2 + FOOTER;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // マス目
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(MARGIN + c * CELL, MARGIN);
    ctx.lineTo(MARGIN + c * CELL, MARGIN + gridH);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(MARGIN, MARGIN + r * CELL);
    ctx.lineTo(MARGIN + gridW, MARGIN + r * CELL);
  }
  ctx.stroke();

  // 文字（右上から縦に流れる）
  const fontSize = CELL * 0.74;
  ctx.font = `500 ${fontSize}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of layoutCells(word, body, rows, cols)) {
    const t = glyphTransform(c.char);
    const cx = MARGIN + (cols - 1 - c.col) * CELL + CELL / 2;
    const cy = MARGIN + c.row * CELL + CELL / 2;
    ctx.save();
    ctx.translate(cx + t.dx * fontSize, cy + t.dy * fontSize);
    ctx.rotate((t.rotate * Math.PI) / 180);
    ctx.fillStyle = c.who === "user" ? COLORS.user : COLORS.ai;
    ctx.fillText(c.char, 0, 0);
    ctx.restore();
  }

  // 隅のラベル
  ctx.font = `500 24px ${family}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(EVENT_LABEL, width - MARGIN, height - MARGIN / 2 - 8);

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
