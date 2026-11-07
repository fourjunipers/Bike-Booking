-- The request reply window is at most 4 hours (owner decision, 2026-11-06).

update public.shops set request_window_min = 240 where request_window_min > 240;

alter table public.shops
  add constraint shops_request_window_max_check check (request_window_min <= 240);
