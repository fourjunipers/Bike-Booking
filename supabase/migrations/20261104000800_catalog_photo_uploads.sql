-- Admins upload catalog stock photos straight to Storage from the browser
-- (resized there like vendor photos), instead of through a Server Action
-- with its 1 MB body limit. Path: catalog-photos/<catalog_id>/<file>.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create policy "Admins upload catalog photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'catalog-photos' and public.is_admin());

create policy "Admins delete catalog photos"
on storage.objects for delete to authenticated
using (bucket_id = 'catalog-photos' and public.is_admin());
