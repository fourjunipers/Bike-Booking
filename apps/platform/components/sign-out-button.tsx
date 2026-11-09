import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A plain form post, so it works before JavaScript loads. */
export function SignOutButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <Button type="submit" variant="outline" className="h-10 w-full">
        <LogOut aria-hidden />
        {label}
      </Button>
    </form>
  );
}
