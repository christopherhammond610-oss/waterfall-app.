# Waterfall: Direct Creator Stream

Next.js 16 (App Router) + React 19 + TypeScript, backed by Supabase (Postgres, Auth, Storage, Realtime).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. In Supabase Dashboard -> SQL Editor, run the files in `supabase/migrations/` in order.
4. `npm run dev` and open http://localhost:3000

```bash
npm run dev     # development
npm run build   # production build
npm run lint
```

## Routes

| URL | Screen |
| --- | --- |
| `/` | Flow feed + composer |
| `/login` | Sign in / create account |
| `/hub` | Creator Hub (profile editor + metrics) |
| `/creator/@handle` | A single creator's drops |

Old hash links (`#/hub`, `#/creator/@x`) redirect automatically.

## Structure

```
app/                 routes + globals.css (design system)
components/
  Header.tsx, NavTabs.tsx, useRequireAuth.ts
  auth/              AuthForm
  feed/              FlowView, Composer, PostCard, PostMedia, CommentsDrawer
  hub/               HubView, ProfileEditor, StreamMetrics
  modals/            Modal, PaywallModal, TipModal
context/             AppStateContext (Supabase data + realtime), ToastContext
lib/                 supabase client, media uploads, types, formatting
supabase/migrations/ database schema, RLS policies, storage buckets
legacy/index.html    original single-file version (reference only)
```

## How data works

- **Auth:** Supabase email/password. A profile row is created automatically on sign-up.
- **Database:** `profiles`, `posts`, `comments`, `ripples`, `follows`, `purchases`.
  Row Level Security is on for every table; counters (ripples, comments, followers)
  are maintained by database triggers, so clients can't tamper with them.
- **Realtime:** posts, comments, profile changes and counters sync live across devices.
- **Storage:**
  - `feed-media` (public): avatars, public post media, tiny blurred previews of paid media.
  - `locked-media` (private): paid media. Only the creator, or a buyer with a completed
    purchase, can get a short-lived signed URL.
- **Payments (Stripe Connect, 80/20):**
  - Creators connect a Stripe account from the Creator Hub (Express dashboard).
    Only creators with active payouts can post locked drops (enforced in the database).
  - Unlocking creates a Stripe Checkout Session as a *destination charge*: the buyer pays
    the platform, 80% is transferred to the creator, 20% is kept as the application fee.
    Stripe's processing fee is paid from the platform's 20%.
  - Access is granted only by the signed webhook (`/api/stripe/webhook`), which upserts the
    purchase; realtime then unlocks the drop for the buyer. A full refund revokes access.

## Stripe setup

1. Stripe Dashboard (test mode / sandbox) -> **Connect** -> finish the platform setup.
2. Put the secret key in `STRIPE_SECRET_KEY`.
3. Webhook endpoint `https://<site>/api/stripe/webhook` with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Local development: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   prints a `whsec_...` secret to use in `.env.local`.

| API route | Purpose |
| --- | --- |
| `POST /api/stripe/connect` | Create the creator's connected account (once) + onboarding link |
| `POST /api/stripe/connect/status` | Sync payout status from Stripe |
| `POST /api/stripe/connect/dashboard` | Login link to the creator's Stripe Express dashboard |
| `POST /api/stripe/checkout` | Checkout Session to unlock a drop |
| `POST /api/stripe/webhook` | Verified Stripe events -> purchases |

All routes except the webhook require `Authorization: Bearer <Supabase access token>`.
