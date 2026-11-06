"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import type { Post } from "@/lib/types";
import PaywallModal from "@/components/modals/PaywallModal";
import TipModal from "@/components/modals/TipModal";
import Composer from "./Composer";
import PostCard from "./PostCard";

interface Props {
  /** When set, only this creator's drops are shown and the composer is hidden. */
  creatorHandle?: string;
}

export default function FlowView({ creatorHandle }: Props) {
  const { posts, unlockedPostIds, unlockPost } = useAppState();
  const showToast = useToast();

  const [checkoutPost, setCheckoutPost] = useState<Post | null>(null);
  const [tipCreator, setTipCreator] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(3);

  const displayedPosts = creatorHandle ? posts.filter((p) => p.creatorHandle === creatorHandle) : posts;

  function handlePaid() {
    if (!checkoutPost) return;
    unlockPost(checkoutPost.id);
    setCheckoutPost(null);
    showToast("🔓 Media unlocked! $3.99 to Creator (80%), $1.00 Platform (20%).");
  }

  function handleSendTip() {
    setTipCreator(null);
    showToast(`⚡ Sent $${tipAmount}.00 tip!`);
  }

  return (
    <div className="view-section active">
      {creatorHandle ? (
        <div className="filter-banner active">
          <div className="filter-banner-text">
            Viewing drops by <span className="filter-banner-name">{creatorHandle}</span>
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
          <p className="feed-empty">No drops in this stream yet.</p>
        ) : (
          displayedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isUnlocked={!post.isLocked || unlockedPostIds.includes(post.id)}
              onUnlock={setCheckoutPost}
              onTip={setTipCreator}
            />
          ))
        )}
      </div>

      {checkoutPost && (
        <PaywallModal
          creatorName={checkoutPost.creatorName}
          price={checkoutPost.price}
          onClose={() => setCheckoutPost(null)}
          onPaid={handlePaid}
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
