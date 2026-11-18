-- Supabase の SQL Editor で、このファイル全体を1回流す。
-- 何度流しても大丈夫（すでにあるテーブルには、足りない列だけを足す）。

create table if not exists public.aistory_stories (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,
  word       text not null,
  body       text not null,
  status     text not null default 'queued'
             check (status in ('queued', 'showing', 'shown', 'skipped')),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

-- みんなのライブラリから外した作品は hidden = true（以前に作ったテーブルにも列を足す）
alter table public.aistory_stories add column if not exists hidden boolean not null default false;

create index if not exists aistory_stories_status_seq_idx on public.aistory_stories (status, seq);
create index if not exists aistory_stories_created_at_idx on public.aistory_stories (created_at);
-- ライブラリ用: 投影済みで、外していない作品を新しい順に
create index if not exists aistory_stories_library_idx on public.aistory_stories (seq desc)
  where status = 'shown' and not hidden;

-- ブラウザから直接DBに触れないようにする（ポリシーは作らない）。
-- サーバーは service role key で接続するので、RLSの影響を受けない。
alter table public.aistory_stories enable row level security;

-- 投影用: 表示中の物語があればそれを返し（再読み込み対策）、なければ列の先頭を「表示中」にして返す。
create or replace function public.aistory_claim_next_story()
returns setof public.aistory_stories
language plpgsql
as $$
declare
  s public.aistory_stories;
begin
  select * into s from public.aistory_stories where status = 'showing' order by seq limit 1;
  if found then
    return next s;
    return;
  end if;

  update public.aistory_stories
     set status = 'showing'
   where id = (
     select id from public.aistory_stories
      where status = 'queued'
      order by seq
      limit 1
      for update skip locked
   )
  returning * into s;

  if found then
    return next s;
  end if;
  return;
end;
$$;

revoke all on function public.aistory_claim_next_story() from public, anon, authenticated;
