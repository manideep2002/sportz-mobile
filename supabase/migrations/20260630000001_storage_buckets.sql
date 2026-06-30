insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('story-media', 'story-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('event-covers', 'event-covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "public media readable" on storage.objects;
create policy "public media readable"
on storage.objects for select
using (bucket_id in ('avatars', 'post-media', 'story-media', 'event-covers'));

drop policy if exists "users upload own media folder" on storage.objects;
create policy "users upload own media folder"
on storage.objects for insert
with check (
  bucket_id in ('avatars', 'post-media', 'story-media', 'event-covers')
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users update own media folder" on storage.objects;
create policy "users update own media folder"
on storage.objects for update
using (auth.uid()::text = (storage.foldername(name))[1])
with check (auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users delete own media folder" on storage.objects;
create policy "users delete own media folder"
on storage.objects for delete
using (auth.uid()::text = (storage.foldername(name))[1]);
