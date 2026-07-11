do $$
begin
  alter type public.sportz_notification_kind add value if not exists 'mention';
end $$;
