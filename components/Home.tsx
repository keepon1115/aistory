"use client";

import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import {
  COOLDOWN_SECONDS,
  KIOSK_RETURN_SECONDS,
  STORAGE_KEY_LAST_SUBMIT,
  STORAGE_KEY_STORY,
  WORD_MAX,
} from "@/lib/config";
import { graphemes, validateWord } from "@/lib/text";
import StoryTracker, { Quiet } from "./StoryTracker";

type Phase =
  | { name: "input" }
  | { name: "tracking"; id: string }
  | { name: "kioskQr"; id: string };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 保存できなくても動く
  }
}

export default function Home() {
  const kiosk = useSearchParams().get("kiosk") === "1";
  const [phase, setPhase] = useState<Phase>({ name: "input" });
  const [restored, setRestored] = useState(false);

  // 再読み込みしても自分の物語に戻れるようにする（キオスクは対象外）
  useEffect(() => {
    if (!kiosk) {
      const id = safeGet(STORAGE_KEY_STORY);
      if (id) setPhase({ name: "tracking", id });
    }
    setRestored(true);
  }, [kiosk]);

  function backToInput() {
    safeSet(STORAGE_KEY_STORY, null);
    setPhase({ name: "input" });
  }

  function onSubmitted(id: string) {
    if (kiosk) {
      setPhase({ name: "kioskQr", id });
    } else {
      safeSet(STORAGE_KEY_STORY, id);
      safeSet(STORAGE_KEY_LAST_SUBMIT, String(Date.now()));
      setPhase({ name: "tracking", id });
    }
  }

  if (!restored) return <Shell>{null}</Shell>;

  return (
    <Shell>
      {phase.name === "input" ? (
        <WordForm kiosk={kiosk} onSubmitted={onSubmitted} />
      ) : phase.name === "tracking" ? (
        <StoryTracker id={phase.id} onAgain={backToInput} />
      ) : (
        <KioskQr id={phase.id} onNext={backToInput} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">{children}</main>;
}

function WordForm({
  kiosk,
  onSubmitted,
}: {
  kiosk: boolean;
  onSubmitted: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 連投対策: 送信後60秒は再送信できない（キオスクは対象外）
  useEffect(() => {
    if (kiosk) return;
    const update = () => {
      const last = Number(safeGet(STORAGE_KEY_LAST_SUBMIT) ?? 0);
      const left = Math.ceil(COOLDOWN_SECONDS - (Date.now() - last) / 1000);
      setCooldown(left > 0 ? left : 0);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [kiosk]);

  useEffect(() => {
    if (kiosk) inputRef.current?.focus();
  }, [kiosk]);

  const count = graphemes(value.normalize("NFC").trim()).length;
  const canSend = !composing && !sending && cooldown === 0 && count > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (composing || sending || cooldown > 0) return;
    const check = validateWord(value);
    if (!check.ok) {
      setMessage(check.message);
      return;
    }
    setMessage(null);
    setSending(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word: check.word }),
      });
      const data = (await res.json()) as { result: string; id?: string; message?: string };
      if (data.result === "ok" && data.id) {
        onSubmitted(data.id);
        return;
      }
      setMessage(
        data.result === "rejected"
          ? "別の言葉で試してみてください。"
          : data.result === "busy"
            ? "ただいま混み合っています。少し待ってからお試しください。"
            : data.result === "limit"
              ? "本日の受付は終了しました。"
              : data.result === "invalid"
                ? (data.message ?? "言葉を確かめてみてください。")
                : "もう一度送ってください。",
      );
    } catch {
      setMessage("もう一度送ってください。");
    }
    setSending(false);
  }

  if (sending) return <Quiet title="物語を準備しています" sub="しばらくお待ちください" />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl tracking-[0.3em] text-white">原稿用紙</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          ことばを入れると、その続きが
          <br />
          スクリーンに書かれていきます
        </p>
      </div>
      <div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            setValue(e.currentTarget.value);
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="2〜10文字のことば"
          aria-label="ことば"
          className="w-full rounded-none border-0 border-b border-white/60 bg-transparent px-1 py-3 text-center text-2xl tracking-widest text-white outline-none placeholder:text-base placeholder:text-white/30 focus:border-white"
        />
        <p className="mt-2 text-right text-xs text-white/40">
          {count} / {WORD_MAX}
        </p>
      </div>
      {message && <p className="text-center text-sm text-white/80">{message}</p>}
      <button
        type="submit"
        disabled={!canSend}
        className="rounded-full border border-white/70 px-6 py-3 text-lg tracking-widest text-white disabled:opacity-30"
      >
        {cooldown > 0 ? `あと${cooldown}秒で送れます` : "物語をはじめる"}
      </button>
    </form>
  );
}

function KioskQr({ id, onNext }: { id: string; onNext: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [left, setLeft] = useState(KIOSK_RETURN_SECONDS);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/s/${id}`, { margin: 2, width: 360 }).then(setQr, () => setQr(null));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left <= 0) onNext();
  }, [left, onNext]);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-xl tracking-widest text-white">受け付けました</p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="物語のページのQRコード" className="w-64 rounded bg-white" />
      )}
      <p className="text-base text-white/80">このQRを読み取ると、あとで物語を持ち帰れます</p>
      <button onClick={onNext} className="rounded-full border border-white/70 px-6 py-3 tracking-widest text-white">
        次の人へ（{Math.max(left, 0)}）
      </button>
    </div>
  );
}
