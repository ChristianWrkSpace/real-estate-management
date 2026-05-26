import { permanentRedirect } from "next/navigation";

// Convenience alias — the canonical route is /finance (the sidebar label is
// "P&L"). Anyone typing /pnl (or /p%26l) gets routed to the real page.
export default function PnlAlias() {
  permanentRedirect("/finance");
}
