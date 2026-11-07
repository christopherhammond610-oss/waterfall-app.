"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { apiPost } from "@/lib/api";
import { errorMessage, normalizeHandle } from "@/lib/format";
import type { Post } from "@/lib/types";
import PaywallModal from "@/components/modals/PaywallModal";
import TipModal from "@/components/modals/TipModal";
import { useRequireAuth } from "@/components/useRequireAuth";
import Composer from "./Composer";
import PostCard from "./PostCard";

interface Props {
  /** When set, only this creator's drops are shown and the composer is hidden. */
  creatorHandle?: string;
}

export default function FlowView({ creatorHandle }: Props) {
  const { posts, feed, loadCreator, profileByHandle } = useAppState();
  const showToast = useToast();
  const requireAuth = useRequireAuth();
  const router = useRouter();

  const [checkoutPost, setCheckoutPost] = useState<Post | null>(null);
  const [tipCreator, setTipCreator] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(3);
  const [lookup, setLookup] = useState<{ handle: string; found: boolean } | null>(null);

  const handle = creatorHandle ? normalizeHandle(creatorHandle) : null;

  // Creator pages fetch that creator's profile and posts (they may be older than the feed).
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    loadCreator(handle).then(
      (creator) => !cancelled && setLookup({ handle, found: !!creator }),
      () => !cancelled && setLookup({ handle, found: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [handle, loadCreator]);

  // Coming back from Stripe Checkout. The webhook grants access; realtime unlocks the drop.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("checkout");
    if (!result) return;
    if (result === "success") showToast("✅ Payment received! Your drop unlocks in a moment.");
    else if (result === "cancelled") showToast("Checkout cancelled. You weren't charged.");
    router.replace(window.location.pathname, { scroll: false });
  }, [router, showToast]);

  const creator = handle ? profileByHandle(handle) : undefined;
  const displayedPosts = handle ? posts.filter((p) => creator && p.creatorId === creator.id) : posts;

  let emptyMessage = "No drops in this stream yet.";
  if (handle) {
    const resolved = lookup?.handle === handle;
    if (!creator && !resolved) emptyMessage = "Loading drops...";
    else if (!creator) emptyMessage = "This creator doesn't exist.";
  } else if (!feed.ready) {
    emptyMessage = "Loading the flow...";
  } else if (feed.error) {
    emptyMessage = `Couldn't load the flow: ${feed.error}`;
  }

  function handleUnlock(post: Post) {
    if (requireAuth("unlock drops")) setCheckoutPost(post);
  }

  async function startCheckout() {
    if (!checkoutPost) return;
    try {
      const { url } = await apiPost<{ url: string }>("/api/stripe/checkout", { postId: checkoutPost.id });
      window.location.assign(url);
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
      throw error;
    }
  }

  function handleSendTip() {
    setTipCreator(null);
    showToast(`⚡ Sent $${tipAmount}.00 tip!`);
  }

  return (
    <div className="view-section active">
      {handle ? (
        <div className="filter-banner active">
          <div className="filter-banner-text">
            Viewing drops by <span className="filter-banner-name">@{handle}</span>
          </div>
          <Link href="/" className="filter-banner-clear">
            Show All Drops ✕
          </Link>
        </div>
      ) : (
        <Composer />
      )}

      <div className="stream-feed">
        {displayedPosts.length === 0 ? (
          <p className="feed-empty">{emptyMessage}</p>
        ) : (
          displayedPosts.map((post) => (
            <PostCard key={post.id} post={post} onUnlock={handleUnlock} onTip={setTipCreator} />
          ))
        )}
      </div>

      {checkoutPost && (
        <PaywallModal
          creatorName={checkoutPost.creatorName}
          price={checkoutPost.price}
          onClose={() => setCheckoutPost(null)}
          onCheckout={startCheckout}
        />
      )}

      {tipCreator && (
        <TipModal
          creatorName={tipCreator}
          amount={tipAmount}
          onAmountChange={setTipAmount}
          onClose={() => setTipCreator(null)}
          onSend={handleSendTip}
        />
      )}
    </div>
  );
}
