-- Supports newest-first event chat reads and stable (created_at, id) cursors.
create index if not exists event_messages_event_created_id_idx
  on public.event_messages (event_id, created_at desc, id desc);
