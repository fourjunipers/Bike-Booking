// The shop picker only. It sits in a route group so this loading state doesn't
// wrap /[tenant]: the shop layout must finish its membership check before any
// HTML is sent, so a shop you're not in is still a real HTTP 404.
import { ListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <ListSkeleton rows={2} />
    </main>
  );
}
