"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EVENT_LABEL } from "@/lib/config";
import { STORY_IMAGE_SIZE, renderStoryImage, saveImage } from "@/lib/storyImage";

type Item = { id: string; seq: number; word: string; body: string; created_at: string; hidden?: boolean };
type Page = { items: Item[]; nextBefore: number | null; admin: boolean };

/** 一覧の小さい画像の倍率（保存画像の0.35倍 ≒ 幅360px。2列表示で高精細画面でもにじまない） */
const THUMB_SCALE = 0.35;

/**
 * みんなのライブラリ。投影済みの作品を、保存画像と同じ原稿用紙の画像で新しい順に並べる。
 * 押すと大きく表示し、そこから画像を保存できる。
 * `?key=<SCREEN_KEY>` を付けて開くと運営用になり、作品を外す・戻すボタンが出る。
 */
export default function Library() {
  const key = useSearchParams().get("key");
  const [items, setItems] = useState<Item[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [admin, setAdmin] = useState(false);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [open, setOpen] = useState<Item | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const load = useCallback(
    async (before: number | null) => {
      setState("loading");
      try {
        const qs = new URLSearchParams();
        if (before !== null) qs.set("before", String(before));
        if (key) qs.set("key", key);
        const res = await fetch(`/api/library?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(String(res.status));
        const page = (await res.json()) as Page;
        setItems((prev) => (before === null ? page.items : [...prev, ...page.items]));
        setNextBefore(page.nextBefore);
        setAdmin(page.admin);
        setState("idle");
      } catch {
        setState("error");
      }
    },
    [key],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  async function toggleHidden(item: Item) {
    if (!key) return;
    const hidden = !item.hidden;
    if (hidden && !window.confirm(`「${item.word}」をライブラリから外しますか？`)) return;
    try {
      const res = await fetch(`/api/library/hide?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const update = (i: Item) => (i.id === item.id ? { ...i, hidden } : i);
      setItems((prev) => prev.map(update));
      setOpen((o) => (o ? update(o) : o));
    } catch {
      window.alert("変更できませんでした。もう一度ためしてください。");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl tracking-[0.3em] text-white">みんなのライブラリ</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">来場者のことばから生まれた物語</p>
        {admin && (
          <p className="mt-3 text-xs text-amber-300/90">
            運営用の表示です。作品を押すと、ライブラリから外す・戻すができます。
          </p>
        )}
        <Link href="/" className="mt-4 inline-block text-sm tracking-widest text-white/60 underline underline-offset-4">
          ことばを書いてみる
        </Link>
      </header>

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setOpen(item)}
                className={`block w-full text-left ${item.hidden ? "opacity-30" : ""}`}
                aria-label={`「${item.word}」の物語を大きく見る`}
              >
                <Thumb item={item} />
                <span className="mt-1 block truncate text-xs tracking-wider text-white/70">
                  {item.hidden ? "【外した作品】" : ""}
                  {item.word}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        {state === "loading" && <p className="text-sm text-white/60">読みこんでいます</p>}
        {state === "error" && (
          <>
            <p className="text-sm text-white/70">読みこめませんでした</p>
            <button
              onClick={() => load(items.length > 0 ? nextBefore : null)}
              className="rounded-full border border-white/70 px-6 py-2 tracking-widest text-white"
            >
              もう一度
            </button>
          </>
        )}
        {state === "idle" && items.length === 0 && <p className="text-sm text-white/60">まだ物語はありません</p>}
        {state === "idle" && nextBefore !== null && (
          <button
            onClick={() => load(nextBefore)}
            className="rounded-full border border-white/70 px-6 py-2 tracking-widest text-white"
          >
            もっと見る
          </button>
        )}
      </div>

      {open && (
        <Viewer item={open} admin={admin} onClose={close} onToggleHidden={() => toggleHidden(open)} />
      )}
    </main>
  );
}

// 一覧の画像は、画面に入ったものから1枚ずつ順番に描く（一度にたくさん描いて固まらないように）
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const p = queue.then(job, job);
  queue = p.catch(() => undefined);
  return p;
}

function Thumb({ item }: { item: Item }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let made: string | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        enqueue(async () => {
          if (cancelled) return;
          const blob = await renderStoryImage(item.word, item.body, THUMB_SCALE);
          if (cancelled) return;
          made = URL.createObjectURL(blob);
          setUrl(made);
        }).catch((e) => console.error("[thumb]", e));
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (made) URL.revokeObjectURL(made);
    };
  }, [item.word, item.body]);

  return (
    <div
      ref={ref}
      className="w-full bg-white/[0.03]"
      style={{ aspectRatio: `${STORY_IMAGE_SIZE.width} / ${STORY_IMAGE_SIZE.height}` }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="block h-full w-full" />
      )}
    </div>
  );
}

/** 押した作品を大きく表示する。画像の保存もここから */
function Viewer({
  item,
  admin,
  onClose,
  onToggleHidden,
}: {
  item: Item;
  admin: boolean;
  onClose: () => void;
  onToggleHidden: () => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    renderStoryImage(item.word, item.body).then(
      (b) => {
        if (cancelled) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      },
      () => !cancelled && setMessage("画像をつくれませんでした。"),
    );
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [item.word, item.body]);

  // Escキーで閉じる。開いている間は後ろの一覧をスクロールさせない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onSave() {
    if (!blob) return;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await saveImage(blob);
      if (outcome === "downloaded") setMessage("保存されない場合は、画像を長押しして保存してください。");
    } catch {
      setMessage("保存できませんでした。画像を長押しして保存してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`「${item.word}」の物語`}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/95"
      onClick={onClose}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center gap-4 px-4 py-4">
        <div className="flex w-full justify-end">
          <button onClick={onClose} className="px-2 py-1 text-2xl leading-none text-white/80" aria-label="閉じる">
            ×
          </button>
        </div>
        {/* スマホでも保存ボタンが画面内に収まるよう、高さを画面の7割までにする */}
        <div
          className="max-w-full bg-white/[0.03]"
          style={{
            aspectRatio: `${STORY_IMAGE_SIZE.width} / ${STORY_IMAGE_SIZE.height}`,
            height: `min(70dvh, calc((100vw - 2rem) * ${STORY_IMAGE_SIZE.height / STORY_IMAGE_SIZE.width}))`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${EVENT_LABEL} ${item.word}${item.body}`} className="block h-full w-full" />
          )}
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onSave}
            disabled={!blob || busy}
            className="rounded-full border border-white/70 px-6 py-3 text-lg tracking-widest text-white disabled:opacity-50"
          >
            {!blob ? "つくっています…" : "画像を保存"}
          </button>
          {message && <p className="text-center text-sm text-white/70">{message}</p>}
          {admin && (
            <button
              onClick={onToggleHidden}
              className="rounded-full px-6 py-2 text-sm tracking-widest text-amber-300/90 underline underline-offset-4"
            >
              {item.hidden ? "ライブラリに戻す" : "ライブラリから外す"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
