-- Supabase の SQL Editor で、このファイル全体を1回流す。

create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,
  word       text not null,
  body       text not null,
  status     text not null default 'queued'
             check (status in ('queued', 'showing', 'shown', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists stories_status_seq_idx on public.stories (status, seq);
create index if not exists stories_created_at_idx on public.stories (created_at);

-- ブラウザから直接DBに触れないようにする（ポリシーは作らない）。
-- サーバーは service role key で接続するので、RLSの影響を受けない。
alter table public.stories enable row level security;

-- 投影用: 表示中の物語があればそれを返し（再読み込み対策）、なければ列の先頭を「表示中」にして返す。
create or replace function public.claim_next_story()
returns setof public.stories
language plpgsql
as $$
declare
  s public.stories;
begin
  select * into s from public.stories where status = 'showing' order by seq limit 1;
  if found then
    return next s;
    return;
  end if;

  update public.stories
     set status = 'showing'
   where id = (
     select id from public.stories
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

revoke all on function public.claim_next_story() from public, anon, authenticated;
