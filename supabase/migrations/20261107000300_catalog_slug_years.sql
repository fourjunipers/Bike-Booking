-- Catalog slugs: one year when the range is a single year
-- ("honda-nx500-2025", not "honda-nx500-2025-2025"). Existing slugs of that
-- shape are rewritten; nothing links to catalog pages before Phase 3.

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
    case
      when new.year_from is null then null
      when new.year_to is null or new.year_to = new.year_from then new.year_from::text
      else concat_ws(' ', new.year_from, new.year_to)
    end));
  if base = '' then
    base := 'bike';
  end if;
  candidate := base;
  while exists (select 1 from public.bike_catalog where slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

update public.bike_catalog
set slug = left(slug, length(slug) - 5)
where year_from is not null
  and year_from = year_to
  and slug like '%-' || year_from || '-' || year_from
  and not exists (
    select 1 from public.bike_catalog other
    where other.slug = left(bike_catalog.slug, length(bike_catalog.slug) - 5)
  );
