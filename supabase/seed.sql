-- =========================================================================
-- seed.sql — demo data for the Hazeldenes client
-- =========================================================================
-- Run this AFTER 0001 and 0002. It creates one client with farms, houses,
-- flocks, recent visits, alerts and 14 days of daily records for the chart.
--
-- The seed does NOT create auth.users. After running this, create a user
-- via Supabase dashboard and link them with:
--   insert into client_members (client_id, user_id, role)
--   select id, '<USER-UUID>', 'admin' from clients where slug='hazeldenes';
-- =========================================================================

-- ----- Client ------------------------------------------------------------
insert into clients (id, name, slug, country) values
  ('11111111-1111-1111-1111-111111111111', 'Hazeldenes', 'hazeldenes', 'AU')
on conflict (id) do nothing;

-- ----- Catalogs ----------------------------------------------------------
insert into complexes (id, client_id, name, kind) values
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'RSPCA', 'rspca'),
  ('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Free Range', 'free_range');

insert into regions (id, client_id, name) values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Lockwood'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Bendigo'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Geelong'),
  ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Mornington');

insert into breeds (id, client_id, name) values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ross 308'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Cobb 500');

-- ----- Farms -------------------------------------------------------------
insert into farms (id, client_id, name, reference_id, complex_id, region_id) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Forest Edge',          'FE-001',  '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Channel',              'CH-014',  '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Foot South',           'FS-006',  '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Hazeldenes — Osborne', 'HZ-OS-1', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Gleeson',              'GL-002',  '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Agright',              'AG-001',  '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001');

-- ----- Houses ------------------------------------------------------------
-- Forest Edge: 3 houses
insert into houses (id, farm_id, name, capacity) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'House 1', 24000),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'House 2', 24000),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'House 3', 24000),
-- Channel: 3 houses
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'House 1', 22000),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', 'House 2', 22000),
  ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', 'House 3', 22000),
-- Foot South: 1 house
  ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000003', 'House 1', 18000),
-- Hazeldenes Osborne: 4 houses
  ('60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000004', 'Osborne 1', 26000),
  ('60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000004', 'Osborne 2', 26000),
  ('60000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000004', 'Osborne 3', 26000),
  ('60000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000004', 'Osborne 4', 26000),
-- Gleeson: 2 houses
  ('60000000-0000-0000-0000-00000000000c', '50000000-0000-0000-0000-000000000005', 'House 1', 20000),
  ('60000000-0000-0000-0000-00000000000d', '50000000-0000-0000-0000-000000000005', 'House 2', 20000);

-- ----- Active flocks (placement_date relative to today) -----------------
insert into flocks (id, house_id, reference, breed_id, placement_date, initial_count, active) values
  -- Forest Edge House 3 — 19d old (the one with the alert)
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', '#24-04', '40000000-0000-0000-0000-000000000002', current_date - interval '19 days', 23800, true),
  -- Channel H1
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', '#24-03', '40000000-0000-0000-0000-000000000001', current_date - interval '32 days', 21500, true),
  -- Foot South H1
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000007', '#24-02', '40000000-0000-0000-0000-000000000001', current_date - interval '27 days', 17600, true),
  -- Hazeldenes Osborne 1 — visited today
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000008', '#26-04', '40000000-0000-0000-0000-000000000001', current_date - interval '19 days', 25800, true),
  -- Gleeson H1
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-00000000000c', '#24-01', '40000000-0000-0000-0000-000000000002', current_date - interval '21 days', 19500, true);

-- ----- Today's visits ----------------------------------------------------
insert into visits (id, client_id, farm_id, scheduled_at, type, status) values
  -- 8:30 today, completed
  ('80000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000004',
   date_trunc('day', now()) + interval '8 hours 30 minutes', 'routine', 'completed'),
  -- 11:00 today, in progress
  ('80000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001',
   date_trunc('day', now()) + interval '11 hours', 'sanitary', 'in_progress'),
  -- 14:30 today, planned
  ('80000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002',
   date_trunc('day', now()) + interval '14 hours 30 minutes', 'post_mortem', 'planned'),
  -- yesterday completed
  ('80000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003',
   date_trunc('day', now()) - interval '1 day' + interval '9 hours', 'routine', 'completed');

-- ----- Open alerts (the dashboard reads these) ---------------------------
insert into alerts (client_id, farm_id, flock_id, severity, status, source, title, body, detected_at) values
  ('11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
   'critical', 'open', 'ai_predictive',
   'Mortality spike — Forest Edge H3',
   'Mortality at Forest Edge House 3 trended +18% over the last 48h relative to the flock baseline. Pattern matches early signs of necrotic enteritis seen in 4 of your 7 prior outbreaks.',
   now() - interval '2 hours'),

  ('11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002',
   'critical', 'open', 'rule_engine',
   'Water consumption drop — Channel H1',
   '−22% vs 24h baseline. Check drinker line pressure and clean nipples.',
   now() - interval '5 hours'),

  ('11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000006', null,
   'warning', 'open', 'overdue',
   'Visit overdue — Agright',
   'Last visit 11 days ago. Routine visit cadence is 7 days for Free Range complexes.',
   now() - interval '1 day'),

  ('11111111-1111-1111-1111-111111111111', '50000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003',
   'warning', 'open', 'ai_predictive',
   'Coccidia OPG rising — Foot South',
   'Eimeria acervulina trending. Recommend OPG count at next visit.',
   now() - interval '1 day'),

  ('11111111-1111-1111-1111-111111111111', null, null,
   'info', 'open', 'rule_engine',
   'APVMA report due — Q1 2026',
   'Quarterly antimicrobial use report is due in 6 days.',
   now() - interval '2 days');

-- ----- 14 days of daily mortality (for the chart) ------------------------
-- Generate roughly realistic daily mortality (~0.05% baseline with some noise).
do $$
declare
  d int;
  fl uuid;
  m int;
begin
  for fl in select id from flocks loop
    for d in 0..13 loop
      insert into daily_records (flock_id, date, age_days, mortality)
      values (
        fl,
        current_date - (d * interval '1 day'),
        d,
        greatest(0, (random() * 14 + 4 + (d*0.5))::int)   -- gentle upward trend
      )
      on conflict (flock_id, date) do nothing;
    end loop;
  end loop;
end $$;

-- ----- Scoring definitions (catalogue, shared) ---------------------------
insert into scoring_definitions (section, code, name, scale_max, ai_enabled, display_order) values
  ('Feet & legs', 'footpad_dermatitis', 'Footpad dermatitis', 2, true,  1),
  ('Feet & legs', 'hock_burn',          'Hock burn',          2, true,  2),
  ('Feet & legs', 'gait_score',         'Gait score',         5, false, 3),
  ('Coccidiosis', 'eimeria_acervulina', 'Eimeria acervulina', 4, true,  10),
  ('Coccidiosis', 'eimeria_maxima',     'Eimeria maxima',     4, true,  11),
  ('Coccidiosis', 'eimeria_tenella',    'Eimeria tenella',    4, true,  12),
  ('Intestinal',  'dysbacteriosis',     'Dysbacteriosis',     3, false, 20),
  ('Intestinal',  'litter_eater',       'Litter eater',       1, false, 21),
  ('Intestinal',  'gizzard_erosions',   'Gizzard erosions',   3, true,  22),
  ('Intestinal',  'proventriculitis',   'Proventriculitis',   2, false, 23)
on conflict (code) do nothing;
