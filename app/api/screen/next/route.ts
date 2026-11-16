import { NextResponse } from "next/server";
import { isScreenKeyValid } from "@/lib/screenAuth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 投影用。表示中の物語があればそれ（再読み込み対策）、なければ列の先頭を取り出す。 */
export async function POST(req: Request) {
  if (!isScreenKeyValid(new URL(req.url).searchParams.get("key"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const story = await getStore().claimNext();
    return NextResponse.json({ story: story ? { id: story.id, word: story.word, body: story.body } : null });
  } catch (e) {
    console.error("[POST /api/screen/next]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
