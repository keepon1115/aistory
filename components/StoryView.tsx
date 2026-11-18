"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EVENT_LABEL, IMAGE_GRID } from "@/lib/config";
import { renderStoryImage, saveImage } from "@/lib/storyImage";
import Manuscript from "./Manuscript";

/** 投影後に表示する、縦書きの原稿用紙と「画像を保存」「もう一度書く」 */
export default function StoryView({ word, body, onAgain }: { word: string; body: string; onAgain: () => void }) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function onSave() {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await renderStoryImage(word, body);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setPreviewUrl(urlRef.current);
      const outcome = await saveImage(blob);
      if (outcome === "downloaded") setMessage("保存されない場合は、下の画像を長押しして保存してください。");
    } catch (e) {
      console.error("[saveImage]", e);
      setMessage("画像をつくれませんでした。もう一度ためしてください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="max-w-full overflow-x-auto">
        <Manuscript word={word} body={body} rows={IMAGE_GRID.rows} cols={IMAGE_GRID.cols} cell="min(6.2vw, 28px)" />
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded-full border border-white/70 px-6 py-3 text-lg tracking-widest text-white disabled:opacity-50"
        >
          {busy ? "つくっています…" : "画像を保存"}
        </button>
        <button onClick={onAgain} className="rounded-full px-6 py-3 text-base tracking-widest text-white/70">
          もう一度書く
        </button>
        <Link href="/library" className="text-center text-sm tracking-widest text-white/60 underline underline-offset-4">
          みんなのライブラリを見る
        </Link>
      </div>
      {message && <p className="text-center text-sm text-white/70">{message}</p>}
      {previewUrl && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-white/70">長押しで保存できます</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`${EVENT_LABEL} あなたの物語`} className="w-full max-w-sm" />
        </div>
      )}
    </div>
  );
}
