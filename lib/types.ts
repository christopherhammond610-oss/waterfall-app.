export interface Profile {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
}

export interface Comment {
  author: string;
  text: string;
  time: string;
}

export interface Post {
  id: string;
  creatorName: string;
  creatorHandle: string;
  avatar: string;
  bodyText: string;
  isLocked: boolean;
  price: string;
  mediaUrl: string | null;
  ripples: number;
  userRippled: boolean;
  followersCount: number;
  isFollowed: boolean;
  comments: Comment[];
}
