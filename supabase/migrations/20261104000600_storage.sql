-- Photo buckets. Files are resized to WebP in the browser before upload
-- (Supabase image transformations are a paid feature). Paths:
--   shop-photos/<shop_id>/<file>             owners write
--   model-photos/<shop_id>/<model_id>/<file> members write (staff manage fleet)
--   catalog-photos/<file>                    admin only (service role)
-- All three are public buckets: anyone can view a photo by its URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('shop-photos', 'shop-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('model-photos', 'model-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('catalog-photos', 'catalog-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Owners upload shop photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'shop-photos'
  and public.is_shop_owner(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Owners delete shop photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'shop-photos'
  and public.is_shop_owner(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Members upload model photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'model-photos'
  and public.is_shop_member(public.try_uuid((storage.foldername(name))[1]))
);

create policy "Members delete model photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'model-photos'
  and public.is_shop_member(public.try_uuid((storage.foldername(name))[1]))
);
