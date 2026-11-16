import { NextResponse } from "next/server";
import { isScreenKeyValid } from "@/lib/screenAuth";
import { getStore } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/** 投影が終わった（shown）、またはスキップされた（skipped）ことを記録する。何度呼んでも安全。 */
export async function POST(req: Request) {
  if (!isScreenKeyValid(new URL(req.url).searchParams.get("key"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (typeof body?.id !== "string" || !UUID.test(body.id) || (body.result !== "shown" && body.result !== "skipped")) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    await getStore().finish(body.id, body.result);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/screen/done]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
