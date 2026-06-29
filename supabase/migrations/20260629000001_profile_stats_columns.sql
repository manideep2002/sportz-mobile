alter table public.profiles
  add column if not exists games_played int not null default 0,
  add column if not exists win_rate numeric(5,2) not null default 0,
  add column if not exists best_points int,
  add column if not exists avg_rebounds numeric(5,2);

