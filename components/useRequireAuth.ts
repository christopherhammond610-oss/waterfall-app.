"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";

/** Returns a guard: true when signed in, otherwise sends the visitor to /login. */
export function useRequireAuth() {
  const { userId } = useAppState();
  const router = useRouter();
  const showToast = useToast();

  return useCallback(
    (action: string) => {
      if (userId) return true;
      showToast(`🔐 Sign in to ${action}.`);
      router.push("/login");
      return false;
    },
    [router, showToast, userId],
  );
}
