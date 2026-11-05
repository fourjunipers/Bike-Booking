-- Holiday closures that repeat every year on the same dates (owner request,
-- 2026-11-04), e.g. Songkran 13–15 April. start_date/end_date hold the first
-- year; later years match on month and day. Lunar holidays move each year, so
-- they stay one-off closures. Mirrors lib/closures.ts.

alter table public.shop_closures
  add column repeats_yearly boolean not null default false,
  add constraint shop_closures_yearly_span_check
    check (not repeats_yearly or end_date - start_date < 365);

-- Whether the shop is closed on p_date by a holiday closure (opening hours are
-- separate). Security invoker: RLS on shop_closures decides what is visible.
create function public.is_shop_closed_on(p_shop_id uuid, p_date date)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_closures c,
      lateral (
        -- The closure's occurrence that starts in p_date's year, and the one
        -- before it (for closures that run over New Year).
        select make_date(y, extract(month from c.start_date)::int, 1)
          + (extract(day from c.start_date)::int - 1) as s
        from (values (extract(year from p_date)::int),
                     (extract(year from p_date)::int - 1)) as years (y)
      ) o
    where c.shop_id = p_shop_id
      and (
        (not c.repeats_yearly and p_date between c.start_date and c.end_date)
        or (
          c.repeats_yearly
          and p_date >= c.start_date
          and p_date between o.s and o.s + (c.end_date - c.start_date)
        )
      )
  );
$$;

grant execute on function public.is_shop_closed_on(uuid, date) to anon, authenticated;
