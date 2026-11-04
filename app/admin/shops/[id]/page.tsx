import Link from "next/link";
import { notFound } from "next/navigation";
import { approveShop, clearFlags, returnShop } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/form-kit";
import { requireAdmin } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import {
  effectiveDeposit,
  INCLUSION_FIELDS,
  type Inclusions,
} from "@/lib/inclusions";
import { formatBaht } from "@/lib/money";
import { photoUrl, PHOTO_BUCKETS, SHOP_PLACEHOLDER } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/env";
import { formatBangkok } from "@/lib/time";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Everything admin checks before approving: real shop, photos, prices, policies. */
export default async function AdminShopPage({
  params,
}: PageProps<"/admin/shops/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();
  const [
    { data: shop },
    { data: contacts },
    { data: hours },
    { data: policies },
    { data: models },
    { data: extras },
    { data: readiness },
  ] = await Promise.all([
    db.from("shops").select("*").eq("id", id).maybeSingle(),
    db.from("shop_contacts").select("*").eq("shop_id", id).maybeSingle(),
    db
      .from("shop_hours")
      .select("weekday, open, close")
      .eq("shop_id", id)
      .order("weekday"),
    db
      .from("shop_policies")
      .select(`deposit_amount, ${INCLUSION_FIELDS.join(", ")}`)
      .eq("shop_id", id)
      .maybeSingle<Inclusions & { deposit_amount: number | null }>(),
    db
      .from("bike_models")
      .select(
        "id, qty, photos, deposit_amount, booking_mode, visible, flagged_for_review, catalog:bike_catalog (make, model, generation, year_from, year_to, cc, status), price_days (day, total)",
      )
      .eq("shop_id", id),
    db
      .from("shop_extras")
      .select(
        "id, name, price_kind, price_rental, price_1d, price_7d, price_30d, active, terms",
      )
      .eq("shop_id", id),
    db.rpc("shop_readiness", { p_shop_id: id }),
  ]);
  if (!shop) notFound();
  const base = supabaseUrl();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/admin/shops"
          className="text-sm underline underline-offset-4"
        >
          All shops
        </Link>
        <h1 className="text-2xl font-semibold">{shop.name}</h1>
        <p>
          <span className="capitalize">{shop.status}</span> · boost{" "}
          {shop.boost_level} · submitted{" "}
          {formatBangkok(shop.submitted_at) || "—"} · terms accepted{" "}
          {formatBangkok(shop.terms_accepted_at) || "—"}
        </p>
        {readiness && readiness.length > 0 && (
          <p className="text-destructive">
            Still missing: {readiness.join(", ")}
          </p>
        )}
      </header>

      {shop.status === "pending" && (
        <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <form action={approveShop} className="space-y-2">
            <input type="hidden" name="id" value={shop.id} />
            <p>Approving makes the shop visible to customers.</p>
            <Button type="submit" size="lg" className="h-11">
              Approve and go live
            </Button>
          </form>
          <form action={returnShop} className="space-y-2">
            <input type="hidden" name="id" value={shop.id} />
            <label htmlFor="notes" className="text-sm font-medium">
              Return with notes (the vendor sees these)
            </label>
            <textarea
              id="notes"
              name="notes"
              required
              rows={3}
              className={textareaClass}
            />
            <Button type="submit" variant="outline" className="h-11">
              Return to vendor
            </Button>
          </form>
        </section>
      )}

      {shop.status === "live" &&
        (shop.flagged_for_review ||
          (models ?? []).some((m) => m.flagged_for_review)) && (
          <form
            action={clearFlags}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-4"
          >
            <input type="hidden" name="id" value={shop.id} />
            <p>
              This shop has edits to review (flagged models are marked below).
            </p>
            <Button type="submit" variant="outline" className="h-11">
              Mark reviewed
            </Button>
          </form>
        )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="whitespace-pre-line">
            {shop.about || "No description."}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {(shop.photos.length > 0 ? shop.photos : [SHOP_PLACEHOLDER]).map(
              (p) => (
                <li key={p}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL */}
                  <img
                    src={photoUrl(
                      base,
                      PHOTO_BUCKETS.shop,
                      p,
                      SHOP_PLACEHOLDER,
                    )}
                    alt=""
                    className="aspect-4/3 w-full rounded border object-cover"
                  />
                </li>
              ),
            )}
          </ul>
          <p>
            Station: {shop.nearest_station || "—"} ·{" "}
            {shop.maps_url ? (
              <a
                href={shop.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Open in Google Maps
              </a>
            ) : (
              "no Maps link"
            )}
            {shop.google_place_id ? " · Google profile linked" : ""}
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Contacts and hours</h2>
          <p>
            WhatsApp {contacts?.whatsapp || "—"} · Phone{" "}
            {contacts?.phone || "—"} · LINE {contacts?.line_id || "—"} · Email{" "}
            {contacts?.email || "—"}
          </p>
          <ul className="text-sm">
            {(hours ?? []).map((h) => (
              <li key={h.weekday}>
                {DAYS[h.weekday]} {h.open.slice(0, 5)}–{h.close.slice(0, 5)}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            Cut-off {shop.cutoff_minutes} min before closing · buffers{" "}
            {shop.buffer_before_h} h / {shop.buffer_after_h} h · request window{" "}
            {shop.request_window_min} min
          </p>
        </div>
      </section>

      {policies && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            Shop defaults: what&apos;s included, deposit, documents
          </h2>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Row label="Deposit">
              {policies.deposit_amount
                ? formatBaht(policies.deposit_amount)
                : "none"}
            </Row>
            {INCLUSION_FIELDS.map((f) => (
              <Row key={f} label={f.replaceAll("_", " ")}>
                {Array.isArray(policies[f])
                  ? (policies[f] as string[]).join(", ") || "—"
                  : String(policies[f] ?? "—")}
              </Row>
            ))}
          </dl>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fleet ({models?.length ?? 0})</h2>
        <ul className="divide-y rounded-lg border">
          {(models ?? []).map((m) => {
            const price = (d: number) =>
              m.price_days.find((p) => p.day === d)?.total;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-4 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL */}
                <img
                  src={photoUrl(base, PHOTO_BUCKETS.model, m.photos[0])}
                  alt=""
                  className="size-16 rounded border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {m.catalog ? catalogLabel(m.catalog) : "—"}
                    {m.catalog?.status === "requested" && " (catalog request)"}
                    {m.flagged_for_review && " · flagged"}
                    {!m.visible && " · hidden"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Qty {m.qty} · {m.booking_mode} · deposit{" "}
                    {formatBaht(
                      effectiveDeposit(
                        policies?.deposit_amount ?? null,
                        m.deposit_amount,
                      ) ?? 0,
                    )}{" "}
                    · {m.photos.length} photos · 1/7/30 days:{" "}
                    {[1, 7, 30]
                      .map((d) => (price(d) ? formatBaht(price(d)!) : "—"))
                      .join(" / ")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Extras ({extras?.length ?? 0})
        </h2>
        <ul className="space-y-1 text-sm">
          {(extras ?? []).map((e) => (
            <li key={e.id}>
              {e.name}:{" "}
              {e.price_kind === "rental"
                ? `${formatBaht(e.price_rental ?? 0)} per rental`
                : [e.price_1d, e.price_7d, e.price_30d]
                    .map((p) => (p ? formatBaht(p) : "—"))
                    .join(" / ") + " (1/7/30 days)"}
              {!e.active && " · paused"}
              {e.terms && ` · terms: ${e.terms}`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground capitalize">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
