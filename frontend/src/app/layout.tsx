import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argus4626 — Vault Intelligence",
  description: "ERC-4626 vault observability and invariant monitoring.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
