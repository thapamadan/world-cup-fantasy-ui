import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "WOW Predictor",
  description: "Predict FIFA World Cup scores and compete on the WowFinStack leaderboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
