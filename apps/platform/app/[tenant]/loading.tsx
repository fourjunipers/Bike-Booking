// "/<shop>" itself only redirects to the home tab; this also covers any
// tenant page without its own loading.tsx, inside the app shell.
import { DashboardSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <DashboardSkeleton />;
}
