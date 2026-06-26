import { Suspense } from "react";

import { KnockoutPageClient } from "./KnockoutPageClient";

export default function KnockoutPage() {
  return (
    <Suspense fallback={null}>
      <KnockoutPageClient />
    </Suspense>
  );
}
