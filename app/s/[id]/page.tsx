"use client";

import { use } from "react";
import StoryTracker from "@/components/StoryTracker";

/** 物語のページ。キオスクのQRからスマホで開く。投影前なら順番待ち表示になる。 */
export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <StoryTracker id={id} againLabel="言葉を書いてみる" />
    </main>
  );
}
