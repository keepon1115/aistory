import { NextResponse } from "next/server";
import { SECONDS_PER_PERSON } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 送信者のスマホ用。物語の本文は、投影が終わる（shown）まで返さない。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ status: "notfound" }, { status: 404 });
  try {
    const store = getStore();
    const story = await store.get(id);
    if (!story) return NextResponse.json({ status: "notfound" }, { status: 404 });

    if (story.status === "shown") {
      return NextResponse.json({ status: "shown", word: story.word, body: story.body });
    }
    if (story.status === "queued") {
      const ahead = await store.countAhead(story);
      return NextResponse.json({
        status: "queued",
        ahead,
        waitMinutes: Math.max(1, Math.ceil((ahead * SECONDS_PER_PERSON) / 60)),
      });
    }
    return NextResponse.json({ status: story.status }); // showing / skipped
  } catch (e) {
    console.error("[GET /api/stories/:id]", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
