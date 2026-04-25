-- =========================================================================
-- 0002_rls.sql — Row-level security policies
-- =========================================================================
--
-- Strategy:
--   - Every table that holds tenant data gets RLS enabled.
--   - The single rule is: "you can see/modify rows of a client you belong to".
--   - Role-based restrictions (e.g. only vets can sign prescriptions)
--     are enforced at the application layer for now; we can tighten later.
--
-- Helper: is_client_member(client_id) returns boolean — keeps policies short.
-- =========================================================================

create or replace function public.is_client_member(c uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from client_members
    where client_id = c
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_client_member(uuid) to authenticated;

-- ----- Enable RLS on all client-scoped tables ----------------------------
alter table clients          enable row level security;
alter table client_members   enable row level security;
alter table complexes        enable row level security;
alter table regions          enable row level security;
alter table breeds           enable row level security;
alter table farms            enable row level security;
alter table houses           enable row level security;
alter table flocks           enable row level security;
alter table visits           enable row level security;
alter table visit_flocks     enable row level security;
alter table visit_scores     enable row level security;
alter table photos           enable row level security;
alter table daily_records    enable row level security;
alter table prescriptions    enable row level security;
alter table alerts           enable row level security;

-- scoring_definitions is a shared catalog (read-only for everyone signed in).
alter table scoring_definitions enable row level security;
create policy "anyone signed in can read scoring definitions"
on scoring_definitions for select
to authenticated
using (true);

-- ----- clients -----------------------------------------------------------
create policy "members can read their clients"
on clients for select
using (is_client_member(id));

-- ----- client_members ----------------------------------------------------
create policy "users can read their own memberships"
on client_members for select
using (user_id = auth.uid() or is_client_member(client_id));

-- ----- generic policy generator ------------------------------------------
-- Most tables follow the same pattern: select/insert/update/delete are
-- allowed if the row's client_id is one the user belongs to.
-- We expand them explicitly for clarity in the SQL editor.

-- complexes
create policy "rw complexes" on complexes
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- regions
create policy "rw regions" on regions
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- breeds
create policy "rw breeds" on breeds
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- farms
create policy "rw farms" on farms
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- houses (resolve client_id via the parent farm)
create policy "rw houses" on houses
  for all using (
    exists (select 1 from farms f
            where f.id = houses.farm_id and is_client_member(f.client_id))
  )
  with check (
    exists (select 1 from farms f
            where f.id = houses.farm_id and is_client_member(f.client_id))
  );

-- flocks
create policy "rw flocks" on flocks
  for all using (
    exists (select 1 from houses h join farms f on f.id = h.farm_id
            where h.id = flocks.house_id and is_client_member(f.client_id))
  )
  with check (
    exists (select 1 from houses h join farms f on f.id = h.farm_id
            where h.id = flocks.house_id and is_client_member(f.client_id))
  );

-- visits
create policy "rw visits" on visits
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- visit_flocks
create policy "rw visit_flocks" on visit_flocks
  for all using (
    exists (select 1 from visits v
            where v.id = visit_flocks.visit_id and is_client_member(v.client_id))
  )
  with check (
    exists (select 1 from visits v
            where v.id = visit_flocks.visit_id and is_client_member(v.client_id))
  );

-- visit_scores
create policy "rw visit_scores" on visit_scores
  for all using (
    exists (select 1 from visits v
            where v.id = visit_scores.visit_id and is_client_member(v.client_id))
  )
  with check (
    exists (select 1 from visits v
            where v.id = visit_scores.visit_id and is_client_member(v.client_id))
  );

-- photos
create policy "rw photos" on photos
  for all using (
    exists (
      select 1 from visit_scores vs
      join visits v on v.id = vs.visit_id
      where vs.id = photos.visit_score_id and is_client_member(v.client_id)
    )
  )
  with check (
    exists (
      select 1 from visit_scores vs
      join visits v on v.id = vs.visit_id
      where vs.id = photos.visit_score_id and is_client_member(v.client_id)
    )
  );

-- daily_records
create policy "rw daily_records" on daily_records
  for all using (
    exists (select 1 from flocks fl
            join houses h on h.id = fl.house_id
            join farms f on f.id = h.farm_id
            where fl.id = daily_records.flock_id and is_client_member(f.client_id))
  )
  with check (
    exists (select 1 from flocks fl
            join houses h on h.id = fl.house_id
            join farms f on f.id = h.farm_id
            where fl.id = daily_records.flock_id and is_client_member(f.client_id))
  );

-- prescriptions
create policy "rw prescriptions" on prescriptions
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));

-- alerts
create policy "rw alerts" on alerts
  for all using (is_client_member(client_id))
  with check (is_client_member(client_id));
