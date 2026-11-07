-- Vendors can submit their shop before every setup step is done (owner
-- decision, 2026-11-06). Only the vendor terms are required to submit; the
-- shop becomes pending and the missing steps are returned for information.
-- Admin approval still needs a complete shop (checked in the admin action).

create or replace function public.submit_shop(p_shop_id uuid, p_accept_terms boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'only the shop owner can submit' using errcode = '42501';
  end if;
  if (select status from public.shops where id = p_shop_id) <> 'draft' then
    raise exception 'shop is not a draft' using errcode = '22023';
  end if;
  if not coalesce(p_accept_terms, false) then
    return array['terms'];
  end if;

  update public.shops
  set status = 'pending', submitted_at = now(), terms_accepted_at = now()
  where id = p_shop_id;
  return public.shop_readiness(p_shop_id);
end;
$$;
