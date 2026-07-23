-- Keep server-side storage limits aligned with story/chat client validation.
update storage.buckets
set
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
  ]
where id in ('story-media', 'chat-media');
