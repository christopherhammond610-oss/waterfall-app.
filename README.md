# Waterfall: Direct Creator Stream

Next.js 16 (App Router) + React 19 + TypeScript.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Routes

| URL | Screen |
| --- | --- |
| `/` | Flow feed + composer |
| `/hub` | Creator Hub (profile editor + metrics) |
| `/creator/@handle` | A single creator's drops |

Old hash links (`#/hub`, `#/creator/@x`) redirect automatically.

## Structure

```
app/                 routes + globals.css (design system)
components/
  Header.tsx, NavTabs.tsx
  feed/              FlowView, Composer, PostCard, PostMedia, CommentsDrawer
  hub/               HubView, ProfileEditor, StreamMetrics
  modals/            Modal, PaywallModal, TipModal
context/             AppStateContext (data), ToastContext (notifications)
lib/                 types, defaults, storage, helpers
legacy/index.html    original single-file version (reference only)
```

Data currently persists to `localStorage` through `lib/storage.ts` and `context/AppStateContext.tsx`.
The Supabase sync replaces that layer. Stripe Checkout plugs into `PaywallModal`'s `onPaid` flow.
