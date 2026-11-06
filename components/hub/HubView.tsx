"use client";

import { useAppState } from "@/context/AppStateContext";
import ProfileEditor from "./ProfileEditor";
import StreamMetrics from "./StreamMetrics";

export default function HubView() {
  const { hydrated } = useAppState();

  return (
    <div className="view-section active">
      {/* Re-mount the editor once saved data has loaded so the form shows it. */}
      <ProfileEditor key={hydrated ? "loaded" : "default"} />
      <StreamMetrics />
    </div>
  );
}
