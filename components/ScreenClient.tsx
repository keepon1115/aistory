"use client";

import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { COLORS, SCREEN_GRID, TIMING } from "@/lib/config";
import { graphemes } from "@/lib/text";
import Manuscript from "./Manuscript";

type Show = { id: string; word: string; body: string };
type View = { show: Show | null; visible: number; hidden: boolean };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 投影画面。次の流れを無限に繰り返す。
 *   列の先頭を取り出す → 言葉(白) → 5秒の沈黙 → 続き(灰) → 15秒表示 → 2秒で文字だけ消す
 * 通信エラーは画面に出さず、黙って再試行する。
 */
export default function ScreenClient() {
  const key = useSearchParams().get("key") ?? "";
  const [view, setView] = useState<View>({ show: null, visible: 0, hidden: false });
  const [fading, setFading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(window.location.origin + "/", { margin: 1, width: 240 }).then(setQr, () => setQr(null));
  }, []);

  useEffect(() => {
    if (!key) return;
    let stopped = false;
    let skip = false;
    let wake: (() => void) | null = null;

    // 待ち時間。Sキーで途中でも抜けられる
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (skip) return resolve();
        const t = setTimeout(done, ms);
        function done() {
          clearTimeout(t);
          wake = null;
          resolve();
        }
        wake = done;
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "s" || e.key === "S") {
        skip = true;
        wake?.();
      }
    };
    window.addEventListener("keydown", onKey);

    const api = (path: string, body?: unknown) =>
      fetch(`/api/screen/${path}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
        cache: "no-store",
      });

    async function fetchNext(): Promise<Show | null> {
      try {
        const res = await api("next");
        if (!res.ok) return null;
        return ((await res.json()) as { story: Show | null }).story;
      } catch {
        return null;
      }
    }

    // 終了報告。通信エラーや5xxのときだけ、成功するまで再試行する
    async function report(id: string, result: "shown" | "skipped") {
      while (!stopped) {
        try {
          const res = await api("done", { id, result });
          if (res.status < 500) return;
        } catch {
          // 再試行
        }
        await sleep(2000);
      }
    }

    async function run() {
      while (!stopped) {
        const story = await fetchNext();
        if (!story) {
          await sleep(TIMING.pollMs);
          continue;
        }
        skip = false;
        const userLen = graphemes(story.word).length;
        const bodyLen = graphemes(story.body).length;
        setFading(false);
        setView({ show: story, visible: 0, hidden: false });

        // 1. 来場者の言葉が白で1文字ずつ
        for (let i = 1; i <= userLen && !skip && !stopped; i++) {
          await wait(TIMING.userCharMs);
          setView((v) => ({ ...v, visible: i }));
        }
        // 2. 沈黙
        if (!skip) await wait(TIMING.silenceMs);
        // 3. AIの続きが灰色で1文字ずつ
        for (let i = 1; i <= bodyLen && !skip && !stopped; i++) {
          await wait(TIMING.aiCharMs);
          setView((v) => ({ ...v, visible: userLen + i }));
        }
        // 4. そのまま表示
        if (!skip) await wait(TIMING.holdMs);

        if (skip) {
          // 緊急スキップ: 即座に消す
          setView({ show: null, visible: 0, hidden: true });
          await report(story.id, "skipped");
        } else {
          // 5. 文字だけがゆっくり消える（マス目は残る）
          setFading(true);
          setView((v) => ({ ...v, hidden: true }));
          await sleep(TIMING.fadeMs);
          await report(story.id, "shown");
          setView({ show: null, visible: 0, hidden: false });
        }
      }
    }
    run();

    return () => {
      stopped = true;
      window.removeEventListener("keydown", onKey);
      wake?.();
    };
  }, [key]);

  const idle = view.show === null;
  // 16:9の画面に余白つきで収まる大きさ（横24マス × 縦12マス）
  const cell = `min(calc(94vw / ${SCREEN_GRID.cols}), calc(80vh / ${SCREEN_GRID.rows}))`;

  return (
    <main
      style={{ background: COLORS.background, color: "#fff", width: "100vw", height: "100vh", overflow: "hidden", cursor: "none" }}
    >
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "4vh" }}>
        <Manuscript
          word={view.show?.word ?? ""}
          body={view.show?.body ?? ""}
          rows={SCREEN_GRID.rows}
          cols={SCREEN_GRID.cols}
          cell={cell}
          visible={view.visible}
          hidden={view.hidden}
          fadeMs={fading ? TIMING.fadeMs : 0}
        />
      </div>
      <div
        style={{
          position: "fixed",
          left: "3vw",
          right: "3vw",
          bottom: "2vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "1.5vw",
        }}
      >
        <p
          style={{
            fontSize: idle ? "2.4vh" : "1.8vh",
            lineHeight: 1.6,
            textAlign: "right",
            letterSpacing: "0.15em",
            color: idle ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
            transition: "all 1s ease",
          }}
        >
          スマホで読み取って、ことばを送ると
          <br />
          物語がここに書かれます
        </p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="入力画面のQRコード" style={{ height: "11vh", width: "11vh", background: "#fff" }} />
        )}
      </div>
    </main>
  );
}
