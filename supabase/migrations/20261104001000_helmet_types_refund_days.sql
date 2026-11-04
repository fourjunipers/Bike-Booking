-- Owner feedback on "What's included" (2026-11-04):
-- * Helmet type becomes a set (most shops offer several styles); helmet sizes
--   are dropped.
-- * "Deposit refunded after (days)" is optional on the shop: null = not stated.

alter table public.shop_policies
  add column helmet_types public.helmet_type[] not null default '{}';
update public.shop_policies
set helmet_types = array[helmet_type]
where helmet_type is not null;
alter table public.shop_policies
  drop column helmet_type,
  drop column helmet_sizes,
  alter column deposit_refund_days drop not null,
  alter column deposit_refund_days drop default;

-- Null = shop default, as for every other override.
alter table public.bike_model_policies
  add column helmet_types public.helmet_type[];
update public.bike_model_policies
set helmet_types = array[helmet_type]
where helmet_type is not null;
alter table public.bike_model_policies
  drop column helmet_type,
  drop column helmet_sizes;
