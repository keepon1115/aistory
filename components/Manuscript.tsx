"use client";

import { COLORS } from "@/lib/config";
import { glyphTransform, layoutCells } from "@/lib/manuscript";

type Props = {
  word: string;
  body: string;
  rows: number;
  cols: number;
  /** マスの一辺（CSSの長さ。例: "40px"）。親が決める */
  cell: string;
  /** 先頭から何文字まで見せるか。省略すると全部 */
  visible?: number;
  /** 文字だけを透明にするときに使う（マス目は残る） */
  hidden?: boolean;
  fadeMs?: number;
};

/** DOM で描く原稿用紙。投影画面とスマホの物語表示の両方で使う。 */
export default function Manuscript({ word, body, rows, cols, cell, visible, hidden, fadeMs = 0 }: Props) {
  const cells = layoutCells(word, body, rows, cols).slice(0, visible ?? Infinity);
  return (
    <div
      role="img"
      aria-label={`${word}${body}`}
      style={{
        position: "relative",
        width: `calc(${cell} * ${cols})`,
        height: `calc(${cell} * ${rows})`,
        border: `1px solid ${COLORS.line}`,
        backgroundImage: `linear-gradient(to right, ${COLORS.line} 1px, transparent 1px), linear-gradient(to bottom, ${COLORS.line} 1px, transparent 1px)`,
        backgroundSize: `${cell} ${cell}`,
        backgroundPosition: "-1px -1px",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: hidden ? 0 : 1,
          transition: fadeMs ? `opacity ${fadeMs}ms ease` : undefined,
        }}
      >
        {cells.map((c, i) => {
          const t = glyphTransform(c.char);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `calc(${cell} * ${cols - 1 - c.col})`,
                top: `calc(${cell} * ${c.row})`,
                width: cell,
                height: cell,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: `calc(${cell} * 0.74)`,
                lineHeight: 1,
                color: c.who === "user" ? COLORS.user : COLORS.ai,
              }}
            >
              <span
                style={{
                  display: "block",
                  whiteSpace: "pre",
                  transform: `translate(${t.dx}em, ${t.dy}em) rotate(${t.rotate}deg)`,
                }}
              >
                {c.char}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
