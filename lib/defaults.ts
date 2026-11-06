import type { Post, Profile } from "./types";

export const LOCKED_PRICE = "$4.99";
export const LOCKED_PRICE_VALUE = 4.99;
export const CREATOR_SHARE = 0.8;

export const DEFAULT_PROFILE: Profile = {
  name: "Christopher Hammond",
  handle: "@christopher",
  bio: "Creator & founder building direct flow media systems. Dropping raw edits and updates directly to my audience.",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
};

export const DEFAULT_POSTS: Post[] = [
  {
    id: "post-1",
    creatorName: "Marcus Vance",
    creatorHandle: "@marcusvance",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    bodyText:
      "Just finished editing the unreleased film reel from the underground set. Premium drops only. Dive into the high-res flow below.",
    isLocked: true,
    price: LOCKED_PRICE,
    mediaUrl:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    ripples: 14,
    userRippled: false,
    followersCount: 3,
    isFollowed: false,
    comments: [
      { author: "Elena Rostova", text: "The color grade on this sequence is crazy.", time: "18m ago" },
    ],
  },
  {
    id: "post-2",
    creatorName: "Elena Rostova",
    creatorHandle: "@elenarostova",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    bodyText:
      "Direct monetized streaming without platform algorithms cutting off reach. The new waterfall architecture is officially alive.",
    isLocked: false,
    price: "Free",
    mediaUrl: null,
    ripples: 28,
    userRippled: false,
    followersCount: 5,
    isFollowed: true,
    comments: [
      {
        author: "Christopher Hammond",
        text: "Single-page flow feels so much cleaner than standard apps.",
        time: "1h ago",
      },
    ],
  },
];
