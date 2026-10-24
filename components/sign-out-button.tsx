import { Button } from "@/components/ui/button";

/** Plain form POST, so it works without JavaScript. */
export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="outline">
        {label}
      </Button>
    </form>
  );
}
