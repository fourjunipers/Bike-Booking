-- Re-check of the Phase 1a review, follow-up 3: which marketplace shop asked
-- for a catalog entry is not for the public.
--
-- An approved catalog entry is public. requested_by_shop_id on it says which
-- shop asked for it: the same kind of fact as requested_by_tenant_id, which
-- 20261111000700 already made private. This takes it out of the columns anon
-- and signed-in users may select, leaving 21.
--
-- Nothing reads it with those roles:
-- * The marketplace's vendor pages only write it (insert), and the policy
--   "Shops read their own requests" uses it inside the database, which needs
--   no column grant.
-- * The marketplace's admin pages, which join a request to its shop through
--   it, use the service role.
-- * The platform app never selects it.

revoke select (requested_by_shop_id) on public.bike_catalog from anon, authenticated;
