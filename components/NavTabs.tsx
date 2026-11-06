"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabsView({ isHub }: { isHub: boolean }) {
  return (
    <nav className="nav-tabs">
      <Link href="/" className={`nav-link${isHub ? "" : " active"}`}>
        Flow
      </Link>
      <Link href="/hub" className={`nav-link${isHub ? " active" : ""}`}>
        Creator Hub
      </Link>
    </nav>
  );
}

/** Reads the current URL to highlight the active tab. Render inside <Suspense>. */
export default function NavTabs() {
  return <NavTabsView isHub={usePathname() === "/hub"} />;
}
