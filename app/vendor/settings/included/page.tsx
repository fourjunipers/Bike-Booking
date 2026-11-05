import { permanentRedirect } from "next/navigation";

// "What's included" moved into Shop settings → Default settings (2026-11-05).
export default function ShopIncludedPage() {
  permanentRedirect("/vendor/settings/defaults");
}
