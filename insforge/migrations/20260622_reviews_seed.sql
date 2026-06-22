-- Seed reviews from existing static testimonials (all published, display_order 1–12)
-- age stores just the number; the display label ("Age X" / "X años") is formatted at render time.
INSERT INTO reviews (quote, name, age, initials, display_order, status) VALUES
  ('Essentia changed how I think about time. Not just living longer — living better, right now.',                                                                                'Marcus V.',    '47', 'MV', 1,  'published'),
  ('The combination of medical protocols and the community here is unlike anything I''ve experienced.',                                                                         'Claudia R.',   '39', 'CR', 2,  'published'),
  ('I came for the therapies. I stayed for the people. The running club has transformed my relationship with movement.',                                                         'James H.',     '52', 'JH', 3,  'published'),
  ('The hyperbaric sessions combined with personalized protocols have made a measurable difference in my recovery.',                                                             'Dr. Sofia M.', '44', 'SM', 4,  'published'),
  ('Coming here twice a week has become non-negotiable. It''s where I reset and come back sharper.',                                                                             'Elena K.',     '41', 'EK', 5,  'published'),
  ('The IV protocols and cold exposure have genuinely shifted my energy levels. Science-backed and results-driven.',                                                             'Thomas B.',    '55', 'TB', 6,  'published'),
  ('I never expected to find a real community in a wellness club. The people here are extraordinary.',                                                                           'Natalie W.',   '36', 'NW', 7,  'published'),
  ('As a physician, I''m selective about longevity claims. Essentia delivers evidence-based care with real integrity.',                                                          'Dr. Rafael A.','49', 'RA', 8,  'published'),
  ('The space itself inspires. Every detail — the light, the materials, the quiet — tells you this place is serious.',                                                           'Isabelle D.',  '43', 'ID', 9,  'published'),
  ('Red light therapy and contrast bathing have become my weekly anchor. My recovery has never been this consistent.',                                                           'Oliver P.',    '38', 'OP', 10, 'published'),
  ('Founding membership was the best investment I''ve made in myself. The access and the advisor relationship are unmatched.',                                                   'Caroline F.',  '46', 'CF', 11, 'published'),
  ('I''ve been to wellness clubs across Europe. Nothing compares to what Essentia has built in Tenerife.',                                                                       'Marco L.',     '51', 'ML', 12, 'published')
ON CONFLICT DO NOTHING;
