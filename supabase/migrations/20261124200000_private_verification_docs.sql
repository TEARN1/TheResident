-- Penetration test, 24 November 2026 (TEARNs-Excellence docs/pentest-2026-11.md):
-- landlords' proof-of-address documents (lease, utility bill, title deed) and
-- tenants' "picture of yourself" went to the public gossip-media bucket, so
-- anyone with a link could open them for ever. They now go to a private
-- bucket: the owner and platform admins open them through a short-lived
-- signed link. The database stores "res-verification/<path>", not a URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('res-verification', 'res-verification', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live under the uploader's own id: <uid>/properties/... or <uid>/selfie/...
drop policy if exists res_verification_insert_own on storage.objects;
create policy res_verification_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'res-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists res_verification_read_own_or_admin on storage.objects;
create policy res_verification_read_own_or_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'res-verification'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.res_is_platform_admin()));

drop policy if exists res_verification_delete_own on storage.objects;
create policy res_verification_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'res-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
