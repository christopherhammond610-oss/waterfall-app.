"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAppState } from "@/context/AppStateContext";
import NavTabs, { NavTabsView } from "./NavTabs";

export default function Header() {
  const router = useRouter();
  const { profile } = useAppState();

  // Keep old hash links from the single-file version working (#/hub, #/creator/@x).
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/")) router.replace(hash.slice(1) === "/flow" ? "/" : hash.slice(1));
  }, [router]);

  return (
    <header>
      <div className="nav-container">
        <Link href="/" className="brand-logo">
          <div className="logo-icon">🌊</div>
          Waterfall
        </Link>

        {/* Creator pages resolve their URL at request time, so the tabs stream in. */}
        <Suspense fallback={<NavTabsView isHub={false} />}>
          <NavTabs />
        </Suspense>

        <Link href="/hub" className="profile-nav-trigger">
          {/* eslint-disable-next-line @next/next/no-img-element -- user avatars can be any URL or a data URL */}
          <img className="avatar-mini" src={profile.avatar} alt="Avatar" />
        </Link>
      </div>
    </header>
  );
}
