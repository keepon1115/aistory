import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** 他のアプリとSupabaseプロジェクトを共有しても名前がぶつからないよう、接頭辞をつけている */
const TABLE = "aistory_stories";

export type StoryStatus = "queued" | "showing" | "shown" | "skipped";

export type Story = {
  id: string;
  seq: number;
  word: string;
  body: string;
  status: StoryStatus;
  /** みんなのライブラリから外したもの */
  hidden: boolean;
  created_at: string;
};

/** みんなのライブラリに並べる1件 */
export type LibraryItem = Pick<Story, "id" | "seq" | "word" | "body" | "hidden" | "created_at">;

export type LibraryQuery = {
  /** この seq より古いものを返す（「もっと見る」用）。省略すると最新から */
  before?: number;
  limit: number;
  /** 外した作品も含める（運営用） */
  includeHidden?: boolean;
};

/** DBの窓口。Supabase版と、ローカル確認用のメモリ版がある。 */
export interface Store {
  insert(word: string, body: string): Promise<Story>;
  get(id: string): Promise<Story | null>;
  countQueued(): Promise<number>;
  /** この物語より前に並んでいる人数（表示中の1件も含む） */
  countAhead(story: Story): Promise<number>;
  /** 今日（日本時間）の受付数 */
  countToday(): Promise<number>;
  /** 表示中の物語、なければ列の先頭を表示中にして返す。空ならnull */
  claimNext(): Promise<Story | null>;
  /** 表示中の物語を shown / skipped にする */
  finish(id: string, result: "shown" | "skipped"): Promise<void>;
  /** 投影済みの作品を新しい順に返す */
  listLibrary(q: LibraryQuery): Promise<LibraryItem[]>;
  /** ライブラリから外す・戻す。対象が無ければ false */
  setHidden(id: string, hidden: boolean): Promise<boolean>;
}

/** 日本時間の今日0時（ISO文字列） */
function startOfTodayJst(): string {
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const midnight = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate());
  return new Date(midnight - 9 * 3600 * 1000).toISOString();
}

function supabaseStore(client: SupabaseClient): Store {
  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  return {
    async insert(word, body) {
      return must(await client.from(TABLE).insert({ word, body }).select().single()) as Story;
    },
    async get(id) {
      return must(await client.from(TABLE).select("*").eq("id", id).maybeSingle()) as Story | null;
    },
    async countQueued() {
      const r = await client.from(TABLE).select("id", { count: "exact", head: true }).eq("status", "queued");
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
    async countAhead(story) {
      const q = await client
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", "queued")
        .lt("seq", story.seq);
      if (q.error) throw new Error(q.error.message);
      const s = await client.from(TABLE).select("id", { count: "exact", head: true }).eq("status", "showing");
      if (s.error) throw new Error(s.error.message);
      return (q.count ?? 0) + (s.count ?? 0);
    },
    async countToday() {
      const r = await client
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfTodayJst());
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
    async claimNext() {
      const rows = must(await client.rpc("aistory_claim_next_story")) as Story[] | null;
      return rows && rows.length > 0 ? rows[0] : null;
    },
    async finish(id, result) {
      must(await client.from(TABLE).update({ status: result }).eq("id", id).eq("status", "showing"));
    },
    async listLibrary({ before, limit, includeHidden }) {
      let q = client
        .from(TABLE)
        .select("id, seq, word, body, hidden, created_at")
        .eq("status", "shown")
        .order("seq", { ascending: false })
        .limit(limit);
      if (before !== undefined) q = q.lt("seq", before);
      if (!includeHidden) q = q.eq("hidden", false);
      return must(await q) as LibraryItem[];
    },
    async setHidden(id, hidden) {
      const rows = must(await client.from(TABLE).update({ hidden }).eq("id", id).select("id")) as { id: string }[];
      return rows.length > 0;
    },
  };
}

type MemoryState = { rows: Story[]; seq: number };

/** SUPABASE_URL が無い開発環境でだけ使う、サーバーのメモリ上のDB。本番では使わない。 */
function memoryStore(): Store {
  const g = globalThis as unknown as { __genkoMem?: MemoryState };
  const mem = (g.__genkoMem ??= { rows: [], seq: 0 });
  const bySeq = (a: Story, b: Story) => a.seq - b.seq;
  return {
    async insert(word, body) {
      const s: Story = {
        id: crypto.randomUUID(),
        seq: ++mem.seq,
        word,
        body,
        status: "queued",
        hidden: false,
        created_at: new Date().toISOString(),
      };
      mem.rows.push(s);
      return { ...s };
    },
    async get(id) {
      const s = mem.rows.find((r) => r.id === id);
      return s ? { ...s } : null;
    },
    async countQueued() {
      return mem.rows.filter((r) => r.status === "queued").length;
    },
    async countAhead(story) {
      return mem.rows.filter((r) => (r.status === "queued" && r.seq < story.seq) || r.status === "showing").length;
    },
    async countToday() {
      const from = startOfTodayJst();
      return mem.rows.filter((r) => r.created_at >= from).length;
    },
    async claimNext() {
      const showing = mem.rows.filter((r) => r.status === "showing").sort(bySeq)[0];
      if (showing) return { ...showing };
      const next = mem.rows.filter((r) => r.status === "queued").sort(bySeq)[0];
      if (!next) return null;
      next.status = "showing";
      return { ...next };
    },
    async finish(id, result) {
      const s = mem.rows.find((r) => r.id === id);
      if (s && s.status === "showing") s.status = result;
    },
    async listLibrary({ before, limit, includeHidden }) {
      return mem.rows
        .filter((r) => r.status === "shown" && (includeHidden || !r.hidden) && (before === undefined || r.seq < before))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
        .map(({ id, seq, word, body, hidden, created_at }) => ({ id, seq, word, body, hidden, created_at }));
    },
    async setHidden(id, hidden) {
      const s = mem.rows.find((r) => r.id === id);
      if (!s) return false;
      s.hidden = hidden;
      return true;
    },
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    cached = supabaseStore(createClient(url, key, {
        auth: { persistSession: false },
        // DBが応答しないときに、いつまでも待ち続けないようにする
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
      }));
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[genko] SUPABASE_URL が未設定のため、メモリ上のDBを使います（開発用）");
    cached = memoryStore();
  } else {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }
  return cached;
}
