export const ALERT_CATALOG = [
  {
    type: "DONATION_INFLATION_ATTACK_DETECTED",
    label: "Donation / inflation attack",
    severity: "critical",
    icon: "M3 17l6-6 4 4 8-8M15 7h6v6",
    demoHref: "/vault/sepolia-demo",
    description:
      "Share price jumped more than 5% while total supply stayed unchanged — assets grew without new deposits. This matches a donation/inflation pattern, not confirmed proof of an exploit.",
  },
  {
    type: "LIQUIDITY_DRAIN_EVENT",
    label: "Liquidity drain",
    severity: "warning",
    icon: "M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3",
    demoHref: "/vault/liquidity-demo",
    description:
      "Withdrawals in the recent window exceeded 35% of available liquidity. Fast, large withdrawals can precede a bank-run or an attempt to drain the vault.",
  },
  {
    type: "SHARE_PRICE_CRASH_DETECTED",
    label: "Share price crash",
    severity: "critical",
    icon: "M3 7l6 6 4-4 8 8M15 17h6v-6",
    demoHref: "/vault/sim-demo",
    description:
      "Share price dropped more than 5% while total supply stayed unchanged — assets shrank without a matching withdrawal. This matches a loss of funds, exploit, or bad debt, not confirmed proof of an exploit.",
  },
  {
    type: "UNBACKED_MINT_DETECTED",
    label: "Unbacked mint",
    severity: "critical",
    icon: "M12 8v8M8 12h8M12 3a9 9 0 100 18 9 9 0 000-18z",
    demoHref: "/vault/sim-demo",
    description:
      "Share supply grew enough to move the share price more than 5% while total assets stayed unchanged — shares appear to have been minted without matching backing.",
  },
] as const;

export const ALERT_EXPLANATIONS: Record<string, string> = Object.fromEntries(
  ALERT_CATALOG.map((entry) => [entry.type, entry.description])
);
