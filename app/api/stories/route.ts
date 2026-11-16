import { NextResponse } from "next/server";
import { judgeAndWrite } from "@/lib/ai";
import { MAX_QUEUE } from "@/lib/config";
import { getStore } from "@/lib/store";
import { validateWord } from "@/lib/text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Result =
  | { result: "ok"; id: string }
  | { result: "invalid"; message: string }
  | { result: "rejected" } // 判定を通らなかった
  | { result: "busy" } // 順番待ちが多すぎる
  | { result: "limit" } // 1日の上限
  | { result: "error" }; // AI呼び出しなどの失敗

const json = (r: Result) => NextResponse.json(r);

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = (await req.json())?.word;
  } catch {
    return json({ result: "invalid", message: "言葉を入れてみてください。" });
  }
  if (typeof raw !== "string") return json({ result: "invalid", message: "言葉を入れてみてください。" });

  const check = validateWord(raw);
  if (!check.ok) return json({ result: "invalid", message: check.message });

  try {
    const store = getStore();
    if ((await store.countQueued()) > MAX_QUEUE) return json({ result: "busy" });
    const limit = Number(process.env.DAILY_LIMIT ?? 1000) || 1000;
    if ((await store.countToday()) >= limit) return json({ result: "limit" });

    const ai = await judgeAndWrite(check.word);
    if (!ai.ok) return json({ result: "rejected" }); // 何も保存しない

    const story = await store.insert(check.word, ai.story);
    return json({ result: "ok", id: story.id });
  } catch (e) {
    console.error("[POST /api/stories]", e instanceof Error ? e.message : e);
    return json({ result: "error" });
  }
}
