import { Bike, Car, Mountain, Sailboat, Shapes } from "lucide-react";
import type { VehicleKind } from "@/lib/vehicle-kinds";

/** One icon per kind of vehicle (lib/vehicle-kinds.ts). */
export const kindIcons: Record<VehicleKind, typeof Bike> = {
  motorbike: Bike,
  car: Car,
  atv: Mountain,
  boat: Sailboat,
  other: Shapes,
};

/** The icon for a kind of vehicle; the "other" shapes for one it doesn't know. */
export function KindIcon({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  const Icon = kindIcons[kind as VehicleKind] ?? Shapes;
  return <Icon aria-hidden className={className} />;
}
