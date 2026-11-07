-- =====================================================================
-- Waterfall · Milestone 2 · Stripe Connect (80/20) + paid unlocks
--
-- Run AFTER 20261106120000_milestone1_global_sync.sql.
-- Non-destructive and idempotent; runs in one transaction.
-- Only the server (secret key) writes payout accounts and purchases.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Creator payout accounts (Stripe Connect, Express dashboard)
-- ---------------------------------------------------------------------

create table if not exists public.stripe_accounts (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  transfers_active  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists stripe_accounts_touch_updated_at on public.stripe_accounts;
create trigger stripe_accounts_touch_updated_at
  before update on public.stripe_accounts
  for each row execute function public.touch_updated_at();

alter table public.stripe_accounts enable row level security;

drop policy if exists "Creators see their own payout account" on public.stripe_accounts;
create policy "Creators see their own payout account"
  on public.stripe_accounts for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.stripe_accounts from anon, authenticated;

-- Public flag so the UI knows a creator can sell locked drops.
-- Not in the client-writable column grant, so only the server can set it.
alter table public.profiles
  add column if not exists accepts_payments boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Purchases (written by the Stripe webhook)
-- ---------------------------------------------------------------------

alter table public.purchases
  add column if not exists amount_cents             integer,
  add column if not exists platform_fee_cents       integer,
  add column if not exists currency                 text not null default 'usd',
  add column if not exists stripe_payment_intent_id text,
  add column if not exists updated_at               timestamptz not null default now();

alter table public.purchases alter column status set default 'pending';

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases add  constraint purchases_status_check
  check (status in ('pending', 'completed', 'expired', 'failed', 'refunded'));

-- One row per Checkout Session; lets the webhook upsert idempotently.
alter table public.purchases drop constraint if exists purchases_stripe_session_id_key;
alter table public.purchases add  constraint purchases_stripe_session_id_key unique (stripe_session_id);

create index if not exists purchases_payment_intent_idx on public.purchases (stripe_payment_intent_id);
create index if not exists purchases_buyer_post_idx     on public.purchases (user_id, post_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchases'::regclass
      and contype = 'f'
      and confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
  ) then
    alter table public.purchases
      add constraint purchases_user_id_profiles_fkey foreign key (user_id)
      references public.profiles (id) on delete cascade not valid;
  end if;
end $$;

drop trigger if exists purchases_touch_updated_at on public.purchases;
create trigger purchases_touch_updated_at
  before update on public.purchases
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Locked drops only from creators who can actually get paid
-- ---------------------------------------------------------------------

drop policy if exists "Creators create their own posts" on public.posts;
create policy "Creators create their own posts"
  on public.posts for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (media_path   is null or split_part(media_path,   '/', 1) = (select auth.uid())::text)
    and (preview_path is null or split_part(preview_path, '/', 1) = (select auth.uid())::text)
    and (
      not is_locked
      or (
        media_path is not null
        and exists (
          select 1 from public.profiles pr
          where pr.id = (select auth.uid()) and pr.accepts_payments
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Realtime: buyers unlock instantly, creators see sales live
--    (RLS limits each purchase event to its buyer and its creator)
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchases'
  ) then
    alter publication supabase_realtime add table public.purchases;
  end if;
end $$;

commit;
