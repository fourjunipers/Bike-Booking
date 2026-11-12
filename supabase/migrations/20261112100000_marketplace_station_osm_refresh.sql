-- Train stations refresh themselves from OpenStreetMap once a month
-- (marketplace UI batch, item 2). The scheduled job (netlify/functions/
-- refresh-stations.mts → /api/cron/stations) merges stations by their
-- OpenStreetMap id:
--   osm_id             "node/123", "way/456" or "relation/789"; null for the
--                      182 stations seeded on 7 Nov 2026 until the first
--                      refresh matches them by name and position.
--   osm_last_seen_at   when a refresh last found the station in OpenStreetMap.
--   osm_missing_since  set when a refresh no longer finds it; the station is
--                      switched off (active = false), never deleted. Cleared,
--                      and the station switched back on, if it comes back.
--                      Stations an admin switched off keep this null, so the
--                      refresh never switches them back on.
-- OpenStreetMap data is ODbL: pages that use it keep "© OpenStreetMap
-- contributors".

alter table public.stations
  add column osm_id text check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  add column osm_last_seen_at timestamptz,
  add column osm_missing_since timestamptz;

create unique index stations_osm_id_key on public.stations (osm_id)
  where osm_id is not null;

-- No default grants (root CLAUDE.md): no new table or function here, and the
-- new columns follow the table's existing grants. Customers keep reading
-- active stations through RLS and station_list(); only the service role
-- (the refresh job and admin pages) writes. Stated on purpose:
grant select, insert, update on public.stations to service_role;
revoke insert, update, delete on public.stations from anon, authenticated;
