-- Run this file in Supabase Dashboard > SQL Editor.
-- Before running: create your user in Supabase Dashboard > Authentication > Users,
-- then replace the UUID below with that user's ID. Disable public sign-ups in
-- Authentication > Settings.

create or replace function public.is_library_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() = '000'::uuid;
$$;

revoke all on function public.is_library_owner() from public;
grant execute on function public.is_library_owner() to authenticated;

alter table public.games enable row level security;
alter table public.expansions enable row level security;
alter table public.plays enable row level security;

revoke insert, update, delete on table public.games from anon, public;
revoke insert, update, delete on table public.expansions from anon, public;
revoke insert, update, delete on table public.plays from anon, public;

grant select on table public.games to anon, authenticated;
grant select on table public.expansions to anon, authenticated;
grant select on table public.plays to anon, authenticated;
grant insert, update, delete on table public.games to authenticated;
grant insert, update, delete on table public.expansions to authenticated;
grant insert, update, delete on table public.plays to authenticated;

drop policy if exists "public may read games" on public.games;
create policy "public may read games"
  on public.games for select to anon, authenticated using (true);
drop policy if exists "authenticated may manage games" on public.games;
create policy "authenticated may manage games"
  on public.games for all to authenticated
  using (true) with check (true);
drop policy if exists "library owner only games" on public.games;
create policy "library owner only games"
  on public.games as restrictive for all to authenticated
  using (public.is_library_owner())
  with check (public.is_library_owner());

drop policy if exists "public may read expansions" on public.expansions;
create policy "public may read expansions"
  on public.expansions for select to anon, authenticated using (true);
drop policy if exists "authenticated may manage expansions" on public.expansions;
create policy "authenticated may manage expansions"
  on public.expansions for all to authenticated
  using (true) with check (true);
drop policy if exists "library owner only expansions" on public.expansions;
create policy "library owner only expansions"
  on public.expansions as restrictive for all to authenticated
  using (public.is_library_owner())
  with check (public.is_library_owner());

drop policy if exists "public may read plays" on public.plays;
create policy "public may read plays"
  on public.plays for select to anon, authenticated using (true);
drop policy if exists "authenticated may manage plays" on public.plays;
create policy "authenticated may manage plays"
  on public.plays for all to authenticated
  using (true) with check (true);
drop policy if exists "library owner only plays" on public.plays;
create policy "library owner only plays"
  on public.plays as restrictive for all to authenticated
  using (public.is_library_owner())
  with check (public.is_library_owner());
