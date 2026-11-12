import {
  Bike,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  PlusCircle,
  Settings,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react";
import type { AdminArea, StaffTab } from "@/lib/roles";

/** Serializable nav entry passed from the server layout to client links. */
export type NavItem = {
  href: string;
  label: string;
  key: StaffTab | AdminArea | "me";
};

/** The icon for a nav entry. */
export function NavIcon({
  navKey,
  className,
}: {
  navKey: NavItem["key"];
  className?: string;
}) {
  const props = { "aria-hidden": true, className };
  switch (navKey) {
    case "dashboard":
      return <LayoutDashboard {...props} />;
    case "orders":
      return <ClipboardList {...props} />;
    case "new-order":
      return <PlusCircle {...props} />;
    case "maintenance":
      return <Wrench {...props} />;
    case "fleet":
      return <Bike {...props} />;
    case "locations":
      return <MapPin {...props} />;
    case "team":
      return <Users {...props} />;
    case "settings":
      return <Settings {...props} />;
    case "me":
      return <UserCircle {...props} />;
  }
}
