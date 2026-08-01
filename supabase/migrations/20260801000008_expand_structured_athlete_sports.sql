-- Expand structured athlete sports check constraints and seed stat definitions & achievements.

alter table public.athlete_seasons drop constraint if exists athlete_seasons_sport_check;
alter table public.sport_stat_definitions drop constraint if exists sport_stat_definitions_sport_check;
alter table public.athlete_matches drop constraint if exists athlete_matches_sport_check;
alter table public.achievement_definitions drop constraint if exists achievement_definitions_sport_check;

alter table public.athlete_seasons add constraint athlete_seasons_sport_check
  check (sport in (
    'basketball', 'football', 'cricket', 'kabaddi', 'badminton',
    'tennis', 'volleyball', 'table_tennis', 'hockey', 'athletics',
    'running', 'swimming', 'cycling', 'boxing', 'other'
  ));

alter table public.sport_stat_definitions add constraint sport_stat_definitions_sport_check
  check (sport in (
    'basketball', 'football', 'cricket', 'kabaddi', 'badminton',
    'tennis', 'volleyball', 'table_tennis', 'hockey', 'athletics',
    'running', 'swimming', 'cycling', 'boxing', 'other'
  ));

alter table public.athlete_matches add constraint athlete_matches_sport_check
  check (sport in (
    'basketball', 'football', 'cricket', 'kabaddi', 'badminton',
    'tennis', 'volleyball', 'table_tennis', 'hockey', 'athletics',
    'running', 'swimming', 'cycling', 'boxing', 'other'
  ));

alter table public.achievement_definitions add constraint achievement_definitions_sport_check
  check (sport in (
    'basketball', 'football', 'cricket', 'kabaddi', 'badminton',
    'tennis', 'volleyball', 'table_tennis', 'hockey', 'athletics',
    'running', 'swimming', 'cycling', 'boxing', 'other'
  ));

insert into public.sport_stat_definitions
  (sport, stat_key, label, value_type, unit, aggregation, is_required, minimum_value, maximum_value, display_order)
values
  ('kabaddi', 'raid_points', 'Raid Points', 'integer', 'PTS', 'sum', true, 0, 100, 10),
  ('kabaddi', 'tackle_points', 'Tackle Points', 'integer', 'PTS', 'sum', true, 0, 50, 20),
  ('kabaddi', 'raids', 'Raids', 'integer', 'RDS', 'sum', true, 0, 100, 30),
  ('kabaddi', 'super_raids', 'Super Raids', 'integer', 'SR', 'sum', false, 0, 20, 40),
  ('kabaddi', 'super_tackles', 'Super Tackles', 'integer', 'ST', 'sum', false, 0, 20, 50),
  ('badminton', 'matches_won', 'Matches Won', 'integer', 'MW', 'sum', true, 0, 50, 10),
  ('badminton', 'games_won', 'Games Won', 'integer', 'GW', 'sum', true, 0, 100, 20),
  ('badminton', 'points_scored', 'Points Scored', 'integer', 'PTS', 'sum', true, 0, 1000, 30),
  ('badminton', 'aces', 'Aces', 'integer', 'ACE', 'sum', false, 0, 100, 40),
  ('tennis', 'aces', 'Aces', 'integer', 'ACE', 'sum', true, 0, 100, 10),
  ('tennis', 'first_serve_pct', 'First Serve %', 'decimal', '%', 'average', true, 0, 100, 20),
  ('tennis', 'double_faults', 'Double Faults', 'integer', 'DF', 'sum', false, 0, 50, 30),
  ('volleyball', 'kills', 'Kills', 'integer', 'K', 'sum', true, 0, 100, 10),
  ('volleyball', 'blocks', 'Blocks', 'integer', 'BLK', 'sum', true, 0, 50, 20),
  ('volleyball', 'aces', 'Aces', 'integer', 'ACE', 'sum', false, 0, 30, 30),
  ('table_tennis', 'matches_won', 'Matches Won', 'integer', 'MW', 'sum', true, 0, 50, 10),
  ('table_tennis', 'games_won', 'Games Won', 'integer', 'GW', 'sum', true, 0, 100, 20),
  ('table_tennis', 'points_scored', 'Points Scored', 'integer', 'PTS', 'sum', true, 0, 1000, 30),
  ('hockey', 'goals', 'Goals', 'integer', 'G', 'sum', true, 0, 50, 10),
  ('hockey', 'assists', 'Assists', 'integer', 'A', 'sum', true, 0, 50, 20),
  ('athletics', 'distance', 'Distance', 'decimal', 'M', 'maximum', false, 0, 1000, 10),
  ('athletics', 'time_seconds', 'Time', 'decimal', 'SEC', 'minimum', false, 0, 10000, 20),
  ('running', 'distance', 'Distance', 'decimal', 'KM', 'sum', true, 0, 1000, 10),
  ('running', 'duration_minutes', 'Duration', 'decimal', 'MIN', 'sum', true, 0, 1440, 20),
  ('swimming', 'distance', 'Distance', 'decimal', 'M', 'sum', true, 0, 10000, 10),
  ('swimming', 'time_seconds', 'Time', 'decimal', 'SEC', 'minimum', true, 0, 3600, 20),
  ('cycling', 'distance', 'Distance', 'decimal', 'KM', 'sum', true, 0, 1000, 10),
  ('cycling', 'avg_speed', 'Avg Speed', 'decimal', 'KM/H', 'average', true, 0, 100, 20),
  ('boxing', 'rounds_fought', 'Rounds Fought', 'integer', 'RND', 'sum', true, 0, 100, 10),
  ('boxing', 'knockouts', 'Knockouts', 'integer', 'KO', 'sum', false, 0, 50, 20),
  ('other', 'points', 'Points', 'integer', 'PTS', 'sum', true, 0, 1000, 10),
  ('other', 'games_played', 'Games Played', 'integer', 'GP', 'sum', false, 0, 500, 20)
on conflict (sport, stat_key) do update
set label = excluded.label,
    value_type = excluded.value_type,
    unit = excluded.unit,
    aggregation = excluded.aggregation,
    is_required = excluded.is_required,
    minimum_value = excluded.minimum_value,
    maximum_value = excluded.maximum_value,
    display_order = excluded.display_order,
    is_active = true;

insert into public.achievement_definitions
  (sport, achievement_key, title, description, badge, stat_key, metric, threshold)
values
  ('kabaddi', 'super_10', 'Super 10', 'Score at least 10 raid points in one match.', '🤼', 'raid_points', 'maximum', 10),
  ('kabaddi', 'high_5', 'High 5', 'Score at least 5 tackle points in one match.', '🛡️', 'tackle_points', 'maximum', 5),
  ('badminton', 'smash_master', 'Smash Master', 'Score 100 points in a season.', '🏸', 'points_scored', 'sum', 100),
  ('tennis', 'ace_king', 'Ace King', 'Serve 10 aces in a single match.', '🎾', 'aces', 'maximum', 10),
  ('volleyball', 'spike_specialist', 'Spike Specialist', 'Record 15 kills in a single match.', '🏐', 'kills', 'maximum', 15),
  ('table_tennis', 'rally_champ', 'Rally Champ', 'Score 100 points in a season.', '🏓', 'points_scored', 'sum', 100),
  ('hockey', 'hat_trick', 'Hockey Hat Trick', 'Score three goals in one match.', '🏒', 'goals', 'maximum', 3),
  ('running', 'marathoner', 'Marathoner', 'Run 42 KM total in a season.', '🏃', 'distance', 'sum', 42),
  ('swimming', 'water_dash', 'Century Swimmer', 'Swim 1000 meters in a season.', '🏊', 'distance', 'sum', 1000),
  ('cycling', 'century_ride', 'Century Ride', 'Ride 100 KM total in a season.', '🚴', 'distance', 'sum', 100),
  ('boxing', 'knockout_king', 'Knockout King', 'Record 5 knockouts in a season.', '🥊', 'knockouts', 'sum', 5),
  ('other', 'first_victory', 'Point Leader', 'Score 50 points in a season.', '🏆', 'points', 'sum', 50)
on conflict (sport, achievement_key) do update
set title = excluded.title,
    description = excluded.description,
    badge = excluded.badge,
    stat_key = excluded.stat_key,
    metric = excluded.metric,
    threshold = excluded.threshold,
    is_active = true;
