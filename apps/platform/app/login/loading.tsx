import { FormSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <FormSkeleton fields={2} />
    </main>
  );
}
