import type { Metadata } from "next";
import { Suspense } from "react";
import Library from "@/components/Library";

export const metadata: Metadata = {
  title: "みんなのライブラリ｜原稿用紙",
  description: "来場者のことばから生まれた物語の一覧です。",
};

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
