insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('story-media', 'story-media', true, 209715200, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']),
  ('event-covers', 'event-covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public media readable"
on storage.objects for select
using (bucket_id in ('avatars', 'post-media', 'story-media', 'event-covers'));

create policy "users upload own media folder"
on storage.objects for insert
with check (
  bucket_id in ('avatars', 'post-media', 'story-media', 'event-covers')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users update own media folder"
on storage.objects for update
using (auth.uid()::text = (storage.foldername(name))[1])
with check (auth.uid()::text = (storage.foldername(name))[1]);

create policy "users delete own media folder"
on storage.objects for delete
using (auth.uid()::text = (storage.foldername(name))[1]);
