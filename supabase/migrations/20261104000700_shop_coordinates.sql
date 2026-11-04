-- Latitude/longitude of a shop's location for the map pin picker
-- (PostgREST returns geography as WKB hex). Security invoker: RLS on shops
-- decides who can read it.

create function public.shop_coordinates(p_shop_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select extensions.st_y(location::extensions.geometry), extensions.st_x(location::extensions.geometry)
  from public.shops
  where id = p_shop_id and location is not null;
$$;

grant execute on function public.shop_coordinates(uuid) to anon, authenticated;
