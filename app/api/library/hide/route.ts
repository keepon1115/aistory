import { NextResponse } from "next/server";
import { isScreenKeyValid } from "@/lib/screenAuth";
import { getStore } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/** 運営用: 作品をみんなのライブラリから外す（hidden: true）・戻す（hidden: false）。SCREEN_KEY が要る。 */
export async function POST(req: Request) {
  if (!isScreenKeyValid(new URL(req.url).searchParams.get("key"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (typeof body?.id !== "string" || !UUID.test(body.id) || typeof body.hidden !== "boolean") {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const found = await getStore().setHidden(body.id, body.hidden);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/library/hide]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
