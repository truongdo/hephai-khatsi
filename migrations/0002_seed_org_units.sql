-- Generated from src/domain/orgUnitSeed.ts by scripts/generate-d1-org-unit-seed.ts; do not edit.
INSERT INTO org_units (id, code, name, kind, sort_order, allows_tang, allows_ni) VALUES
  ('gd-i', 'gd-i', 'Giáo đoàn I', 'giao_doan', 1, 1, 0),
  ('gd-ii', 'gd-ii', 'Giáo đoàn II', 'giao_doan', 2, 1, 0),
  ('gd-iii', 'gd-iii', 'Giáo đoàn III', 'giao_doan', 3, 1, 0),
  ('gd-iv', 'gd-iv', 'Giáo đoàn IV', 'giao_doan', 4, 1, 0),
  ('gd-v', 'gd-v', 'Giáo đoàn V', 'giao_doan', 5, 1, 0),
  ('gd-vi', 'gd-vi', 'Giáo đoàn VI', 'giao_doan', 6, 1, 0),
  ('ni-gd-i', 'ni-gd-i', 'Ni giới Giáo đoàn I', 'ni_gioi', 7, 0, 1),
  ('ni-gd-iii', 'ni-gd-iii', 'Ni giới Giáo đoàn III', 'ni_gioi', 8, 0, 1),
  ('ni-gd-iv', 'ni-gd-iv', 'Ni giới Giáo đoàn IV', 'ni_gioi', 9, 0, 1),
  ('ni-gd-vi', 'ni-gd-vi', 'Ni giới Giáo đoàn VI', 'ni_gioi', 10, 0, 1),
  ('ni-gioi', 'ni-gioi', 'Ni giới Hệ phái Khất sĩ', 'ni_gioi', 11, 0, 1)
ON CONFLICT (id) DO NOTHING;
