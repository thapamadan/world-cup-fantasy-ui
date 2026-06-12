import { Suspense } from "react";

import { GameHistoryPageClient } from "./GameHistoryPageClient";

export default function GameHistoryPage() {
  return (
    <Suspense fallback={null}>
      <GameHistoryPageClient />
    </Suspense>
  );
}
