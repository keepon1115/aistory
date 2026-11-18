import { NextResponse } from "next/server";
import { LIBRARY_PAGE_SIZE } from "@/lib/config";
import { isScreenKeyValid } from "@/lib/screenAuth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * みんなのライブラリ。投影済み（shown）で、運営が外していない作品を新しい順に返す。
 * 判定で弾かれたもの（保存されない）と、投影中にSキーで飛ばしたもの（skipped）は最初から入らない。
 * 正しい key を付けたとき（運営用）だけ、外した作品も返す。
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const before = Number(params.get("before"));
  const admin = isScreenKeyValid(params.get("key"));
  try {
    const items = await getStore().listLibrary({
      before: Number.isSafeInteger(before) && before > 0 ? before : undefined,
      limit: LIBRARY_PAGE_SIZE + 1, // 1件多く取って「続きがあるか」を見る
      includeHidden: admin,
    });
    const page = items.slice(0, LIBRARY_PAGE_SIZE);
    return NextResponse.json({
      items: page.map(({ hidden, ...rest }) => (admin ? { ...rest, hidden } : rest)),
      nextBefore: items.length > LIBRARY_PAGE_SIZE ? page[page.length - 1].seq : null,
      admin,
    });
  } catch (e) {
    console.error("[GET /api/library]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
