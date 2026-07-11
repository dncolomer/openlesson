create unique index if not exists rabbit_hole_one_free_play_per_day_idx
  on public.rabbit_hole_plays(user_id, local_day)
  where used_bonus_play = false;
