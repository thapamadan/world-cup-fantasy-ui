import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

export function formatMatchDateTimeNepal(kickoffAt: string) {
  const kickoffDate = new Date(kickoffAt);

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: NEPAL_TIME_ZONE,
    }).format(kickoffDate),
    kickoff: `${new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: NEPAL_TIME_ZONE,
    }).format(kickoffDate)} NPT`,
  };
}
