-- Catalog entries are told apart by model years only (owner decision,
-- 2026-11-04): "Honda Scoopy 2025–2026" instead of "Honda Scoopy (New Gen)".
-- Existing slugs keep working; new ones come from make, model and years.

create or replace function public.bike_catalog_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  base := public.slugify(concat_ws(' ', new.make, new.model,
    case when new.year_from is not null then concat_ws(' ', new.year_from, new.year_to) end));
  if base = '' then
    base := 'bike';
  end if;
  candidate := base;
  while exists (select 1 from public.bike_catalog where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

alter table public.bike_catalog drop column generation;
