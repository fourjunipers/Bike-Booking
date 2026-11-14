import {
  Bike,
  Car,
  ConciergeBell,
  HardHat,
  Mountain,
  Sailboat,
  Shapes,
  Tag,
} from "lucide-react";
import type { GeneralType } from "@/lib/general-products";
import { rowIcon } from "@/lib/product-list";
import type { VehicleKind } from "@/lib/vehicle-kinds";

/** One icon per kind of vehicle (lib/vehicle-kinds.ts). */
export const kindIcons: Record<VehicleKind, typeof Bike> = {
  motorbike: Bike,
  car: Car,
  atv: Mountain,
  boat: Sailboat,
  other: Shapes,
};

/** A general product's icon, where a vehicle shows its kind. */
export const generalIcons: Record<GeneralType, typeof Bike> = {
  gear: HardHat,
  sale_item: Tag,
  service: ConciergeBell,
};

const icons: Record<string, typeof Bike> = { ...kindIcons, ...generalIcons };

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

/**
 * A list row's icon: a vehicle's saved kind, a general product's type
 * (lib/product-list rowIcon). `data-icon` names it, for the browser tests.
 */
export function RowIcon({
  type,
  kind,
  className,
}: {
  type: string;
  kind: string | null;
  className?: string;
}) {
  const key = rowIcon({ type, kind });
  const Icon = icons[key] ?? Shapes;
  return <Icon aria-hidden data-icon={key} className={className} />;
}
