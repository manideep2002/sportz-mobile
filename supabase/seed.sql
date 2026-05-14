insert into public.courts (name, sport, city, address, latitude, longitude, surface, rating, hourly_price_cents, currency, availability_status)
values
  ('Koramangala Indoor', 'Basketball', 'Bengaluru', 'Koramangala', 12.9352, 77.6245, 'Synthetic floor', 4.8, 40000, 'INR', 'available'),
  ('KGA Tennis Courts', 'Tennis', 'Bengaluru', 'Old Airport Road', 12.9507, 77.6408, 'Clay surface', 4.9, 60000, 'INR', 'available'),
  ('Cubbon Park Turf', 'Football', 'Bengaluru', 'Cubbon Park', 12.9763, 77.5929, 'Astroturf', 4.7, 80000, 'INR', 'booked_until_8pm')
on conflict do nothing;
