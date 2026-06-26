import { Suspense } from "react";

import { PointsChartPageClient } from "./PointsChartPageClient";

export default function PointsChartPage() {
  return (
    <Suspense fallback={null}>
      <PointsChartPageClient />
    </Suspense>
  );
}
