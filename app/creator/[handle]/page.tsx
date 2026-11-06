import { Suspense } from "react";
import FlowView from "@/components/feed/FlowView";

export default function CreatorPage({ params }: PageProps<"/creator/[handle]">) {
  return (
    <Suspense fallback={null}>
      {params.then(({ handle }) => (
        <FlowView creatorHandle={safeDecode(handle)} />
      ))}
    </Suspense>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
