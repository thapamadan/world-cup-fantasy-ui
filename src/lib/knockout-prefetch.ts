import { fetchKnockoutPrediction } from "@/lib/api";
import { writeKnockoutPredictionCache } from "@/lib/predictions-cache";

let inflightPrefetch: Promise<void> | null = null;

// Warm the knockout bracket cache right after login so opening /knockout (even
// in a brand-new tab) renders instantly from localStorage instead of waiting on
// the network round-trip.
export function prefetchKnockoutPrediction() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (inflightPrefetch) {
    return inflightPrefetch;
  }

  inflightPrefetch = fetchKnockoutPrediction()
    .then((prediction) => {
      writeKnockoutPredictionCache(prediction);
    })
    .catch(() => {
      // Ignore prefetch failures and let the page fetch normally.
    })
    .finally(() => {
      inflightPrefetch = null;
    });

  return inflightPrefetch;
}
