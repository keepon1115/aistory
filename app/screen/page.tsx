import { Suspense } from "react";
import ScreenClient from "@/components/ScreenClient";

export default function ScreenPage() {
  return (
    <Suspense>
      <ScreenClient />
    </Suspense>
  );
}
