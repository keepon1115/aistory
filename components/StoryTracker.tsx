"use client";

import { useEffect, useState } from "react";
import StoryView from "./StoryView";

type Info =
  | { status: "queued"; ahead: number; waitMinutes: number }
  | { status: "showing" }
  | { status: "skipped" }
  | { status: "notfound" }
  | { status: "shown"; word: string; body: string };

const POLL_MS = 5000;

/** 物語のIDを受け取り、5秒ごとに状態を見て、状態に合わせた表示を出す */
export default function StoryTracker({ id, onAgain, againLabel }: { id: string; onAgain?: () => void; againLabel?: string }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      let done = false;
      try {
        const res = await fetch(`/api/stories/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!stopped) setInfo({ status: "notfound" });
          done = true;
        } else if (res.ok) {
          const data = (await res.json()) as Info;
          if (!stopped) setInfo(data);
          done = data.status === "shown" || data.status === "skipped";
        }
      } catch {
        // 通信エラーは黙って次の回で再試行
      }
      if (!stopped && !done) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  const again = onAgain ?? (() => (window.location.href = "/"));

  if (!info) return <Quiet title="読みこんでいます" />;

  switch (info.status) {
    case "queued":
      return (
        <Quiet
          title={info.ahead === 0 ? "つぎが、あなたの番です" : `あなたの前に${info.ahead}人（約${info.waitMinutes}分）`}
          sub="スクリーンの前で、お待ちください"
        />
      );
    case "showing":
      return <Quiet title="いまスクリーンに映っています" sub="顔を上げて、スクリーンを見てください" />;
    case "skipped":
      return <Quiet title="表示できませんでした" action={{ label: againLabel ?? "もう一度書く", onClick: again }} />;
    case "notfound":
      return <Quiet title="物語が見つかりませんでした" action={{ label: againLabel ?? "もう一度書く", onClick: again }} />;
    case "shown":
      return <StoryView word={info.word} body={info.body} onAgain={again} />;
  }
}

export function Quiet({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-2xl tracking-widest text-white">{title}</p>
      {sub && <p className="text-base text-white/60">{sub}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-4 rounded-full border border-white/70 px-6 py-3 tracking-widest text-white">
          {action.label}
        </button>
      )}
    </div>
  );
}
