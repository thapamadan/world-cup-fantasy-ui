import { useState } from "react";

const teamFlagCodes: Record<string, string> = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  bosniaherzegovina: "ba",
  brazil: "br",
  canada: "ca",
  capeverdeislands: "cv",
  colombia: "co",
  congodr: "cd",
  croatia: "hr",
  curacao: "cw",
  czechia: "cz",
  ecuador: "ec",
  egypt: "eg",
  england: "gb",
  france: "fr",
  germany: "de",
  ghana: "gh",
  haiti: "ht",
  iran: "ir",
  iraq: "iq",
  ivorycoast: "ci",
  japan: "jp",
  jordan: "jo",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  newzealand: "nz",
  norway: "no",
  panama: "pa",
  paraguay: "py",
  portugal: "pt",
  qatar: "qa",
  saudiarabia: "sa",
  scotland: "gb-sct",
  senegal: "sn",
  southafrica: "za",
  southkorea: "kr",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  unitedstates: "us",
  uruguay: "uy",
  uzbekistan: "uz",
};

function normalizeTeamName(team: string) {
  return team
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function TeamFlag({ team, fallback, className = "" }: { team: string; fallback?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const code = teamFlagCodes[normalizeTeamName(team)];

  if (!code || failed) {
    return <span className={className}>{fallback ?? "🏳️"}</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={`${team} flag`}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
