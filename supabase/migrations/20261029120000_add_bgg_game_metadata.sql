alter table public.games
  add column if not exists bgg_id bigint,
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists description text;
