-- =====================================================================
-- Waterfall · Milestone 1 · Supabase global sync
--
-- * Non-destructive: keeps every existing row in profiles / posts /
--   purchases and only ADDS columns, tables, triggers and policies.
-- * Idempotent: safe to run more than once.
-- * Runs in one transaction: if anything fails, nothing is applied.
--
-- Run it in Supabase Dashboard -> SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

-- Turns any text into a valid handle: lowercase, [a-z0-9_.], 3..23 chars.
create or replace function public.to_handle(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(case when char_length(s) >= 3 then s else s || 'creator' end, 23)
  from (select regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9_.]', '', 'g') as s) t
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. PROFILES  (existing table: id, display_name, bio, avatar_url, ...)
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists handle         text,
  add column if not exists follower_count integer     not null default 0,
  add column if not exists created_at     timestamptz not null default now();

alter table public.profiles alter column bio set default '';

-- Give existing profiles a unique handle derived from their display name.
with src as (
  select id, public.to_handle(display_name) as base
  from public.profiles
  where handle is null
),
ranked as (
  select id, base, row_number() over (partition by base order by id) as rn
  from src
)
update public.profiles p
set handle = case
  when r.rn = 1 and not exists (select 1 from public.profiles x where x.handle = r.base)
    then r.base
  else r.base || '_' || substr(replace(p.id::text, '-', ''), 1, 6)
end
from ranked r
where p.id = r.id;

alter table public.profiles alter column handle set not null;

alter table public.profiles drop constraint if exists profiles_handle_key;
alter table public.profiles add  constraint profiles_handle_key unique (handle);

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add  constraint profiles_handle_format
  check (handle ~ '^[a-z0-9_.]{3,30}$');

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add  constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 500);

-- profiles.id must belong to an auth user (NOT VALID = existing rows are not re-checked).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey foreign key (id)
      references auth.users (id) on delete cascade not valid;
  end if;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2. POSTS  (existing table: id, user_id, author_name, content,
--            is_locked, price_cents, image_url, created_at)
-- ---------------------------------------------------------------------

alter table public.posts
  add column if not exists media_path    text,     -- storage path of the media file
  add column if not exists media_type    text,     -- 'image' | 'video'
  add column if not exists preview_path  text,     -- tiny public preview for locked media
  add column if not exists ripple_count  integer not null default 0,
  add column if not exists comment_count integer not null default 0;

alter table public.posts alter column content     set default '';
alter table public.posts alter column price_cents set default 499;
alter table public.posts alter column user_id     set default auth.uid();

alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add  constraint posts_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

alter table public.posts drop constraint if exists posts_content_length;
alter table public.posts add  constraint posts_content_length
  check (char_length(content) <= 5000);

-- "A locked post must have media" is enforced in the insert policy below, not as a
-- CHECK constraint: older test rows are locked without media, and Postgres re-checks
-- CHECK constraints on every UPDATE (e.g. counter updates), even when added NOT VALID.
alter table public.posts drop constraint if exists posts_locked_needs_media;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'f'
      and confrelid = 'public.profiles'::regclass
  ) then
    alter table public.posts
      add constraint posts_user_id_profiles_fkey foreign key (user_id)
      references public.profiles (id) on delete cascade not valid;
  end if;
end $$;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx    on public.posts (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. COMMENTS, RIPPLES, FOLLOWS  (new tables)
-- ---------------------------------------------------------------------

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at);

create table if not exists public.ripples (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists ripples_user_id_idx on public.ripples (user_id);

create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint follows_not_self check (follower_id <> creator_id)
);
create index if not exists follows_creator_id_idx on public.follows (creator_id);

-- purchases is completed in Milestone 2 (Stripe); for now only indexes.
create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_post_id_idx on public.purchases (post_id);

-- ---------------------------------------------------------------------
-- 4. Counters kept in sync by triggers (clients can't write them)
-- ---------------------------------------------------------------------

create or replace function public.sync_ripple_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set ripple_count = ripple_count + 1 where id = new.post_id;
  else
    update public.posts set ripple_count = greatest(ripple_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.creator_id;
  else
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.creator_id;
  end if;
  return null;
end;
$$;

drop trigger if exists ripples_sync_count on public.ripples;
create trigger ripples_sync_count
  after insert or delete on public.ripples
  for each row execute function public.sync_ripple_count();

drop trigger if exists comments_sync_count on public.comments;
create trigger comments_sync_count
  after insert or delete on public.comments
  for each row execute function public.sync_comment_count();

drop trigger if exists follows_sync_count on public.follows;
create trigger follows_sync_count
  after insert or delete on public.follows
  for each row execute function public.sync_follower_count();

-- Recalculate counters once so they match existing data.
update public.posts p set
  ripple_count  = (select count(*) from public.ripples  r where r.post_id = p.id),
  comment_count = (select count(*) from public.comments c where c.post_id = p.id);

update public.profiles pr set
  follower_count = (select count(*) from public.follows f where f.creator_id = pr.id);

-- ---------------------------------------------------------------------
-- 5. Auto-create a profile for every new sign-up
-- ---------------------------------------------------------------------

-- Remove any older sign-up trigger that also writes to profiles,
-- otherwise two inserts would collide and block sign-ups.
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and p.prosrc ilike '%profiles%'
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text := public.to_handle(coalesce(nullif(new.raw_user_meta_data ->> 'handle', ''),
                                              split_part(new.email, '@', 1)));
  candidate text := base;
  tries     int  := 0;
begin
  while exists (select 1 from public.profiles where handle = candidate) loop
    tries := tries + 1;
    candidate := base || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    exit when tries > 5;
  end loop;

  insert into public.profiles (id, display_name, handle, bio)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    candidate,
    ''
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------

-- Start from a clean slate: drop every old policy on these tables.
do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'posts', 'comments', 'ripples', 'follows',
                        'purchases', 'waterfall_posts')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles        enable row level security;
alter table public.posts           enable row level security;
alter table public.comments        enable row level security;
alter table public.ripples         enable row level security;
alter table public.follows         enable row level security;
alter table public.purchases       enable row level security;
-- Unused table from an earlier attempt: locked down (RLS on, no policies).
alter table public.waterfall_posts enable row level security;

-- profiles: everyone can read, users edit only their own row.
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- posts: everyone can read; creators insert only their own, with media in their own
-- folder, and a locked post must have media to lock. (Clients can't update posts.)
create policy "Posts are public"
  on public.posts for select
  to anon, authenticated
  using (true);

create policy "Creators create their own posts"
  on public.posts for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (media_path   is null or split_part(media_path,   '/', 1) = (select auth.uid())::text)
    and (preview_path is null or split_part(preview_path, '/', 1) = (select auth.uid())::text)
    and (not is_locked or media_path is not null)
  );

-- comments: everyone can read; signed-in users write/delete their own.
create policy "Comments are public"
  on public.comments for select
  to anon, authenticated
  using (true);

create policy "Users add their own comments"
  on public.comments for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users delete their own comments"
  on public.comments for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ripples: private to each user (public totals live in posts.ripple_count).
create policy "Users see their own ripples"
  on public.ripples for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own ripples"
  on public.ripples for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users remove their own ripples"
  on public.ripples for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- follows: private to each follower (public totals live in profiles.follower_count).
create policy "Users see who they follow"
  on public.follows for select
  to authenticated
  using (follower_id = (select auth.uid()));

create policy "Users follow creators"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()));

create policy "Users unfollow creators"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

-- purchases: buyer and the post's creator can read. Only the server
-- (Stripe webhook, Milestone 2) writes, using the secret key.
create policy "Buyers and creators see purchases"
  on public.purchases for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
      where p.id = purchases.post_id
        and p.user_id = (select auth.uid())
    )
  );

-- Column-level privileges: clients may only write these columns.
-- (Counters, prices and verification flags stay server-controlled.)
revoke insert, update on public.profiles from anon, authenticated;
grant  update (display_name, handle, bio, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.posts from anon, authenticated;
grant  insert (user_id, content, is_locked, media_path, media_type, preview_path)
  on public.posts to authenticated;

revoke update on public.comments, public.ripples, public.follows from anon, authenticated;
revoke insert, update, delete on public.purchases from anon, authenticated;

revoke execute on function public.to_handle(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Realtime: broadcast changes to every connected device
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'profiles', 'ripples', 'follows'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Storage
--    feed-media   (public)  : avatars, public post media, locked previews
--    locked-media (private) : paid media, readable by owner or buyer only
--    Files live under "<user id>/..." so ownership is checked by folder.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('feed-media',   'feed-media',   true,  52428800, array['image/*', 'video/*']),
  ('locked-media', 'locked-media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop old policies that touch these buckets.
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(feed-media|locked-media)'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "feed-media: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'feed-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "feed-media: read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feed-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "feed-media: delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'feed-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "locked-media: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'locked-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "locked-media: owner or buyer can view"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'locked-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.purchases pu
        join public.posts p on p.id = pu.post_id
        where p.media_path = objects.name
          and pu.user_id = (select auth.uid())
          and pu.status = 'completed'
      )
    )
  );

create policy "locked-media: delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'locked-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;

-- ---------------------------------------------------------------------
-- Quick check (read-only): run after the migration to see the result.
-- ---------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
-- select id, public, file_size_limit from storage.buckets order by 1;
