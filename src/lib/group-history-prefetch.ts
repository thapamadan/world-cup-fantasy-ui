import { fetchGroupHistory } from "@/lib/api";
import { writeGroupHistoryCache } from "@/lib/predictions-cache";

const inflightPrefetches = new Map<number, Promise<void>>();

export function prefetchGroupHistory(groupId: number) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const existing = inflightPrefetches.get(groupId);
  if (existing) {
    return existing;
  }

  const promise = fetchGroupHistory(groupId)
    .then((response) => {
      writeGroupHistoryCache(groupId, response);
    })
    .catch(() => {
      // Ignore prefetch failures and let the page fetch normally.
    })
    .finally(() => {
      inflightPrefetches.delete(groupId);
    });

  inflightPrefetches.set(groupId, promise);
  return promise;
}
