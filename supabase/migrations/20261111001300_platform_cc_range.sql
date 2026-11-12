-- Platform Phase 1a review, fix 9: one engine-size range.
--
-- A shop's own model accepted 1-20000 cc, the catalog 50-2500. A 49 cc moped
-- saved as the shop's own, then failed with a raw constraint error when the
-- shop submitted it for Moto Mangos. Both now accept 1-20000 cc.
-- (cc stays a smallint on the catalog: 20000 fits.)

alter table public.bike_catalog
  drop constraint bike_catalog_cc_check,
  add constraint bike_catalog_cc_check check (cc between 1 and 20000);
