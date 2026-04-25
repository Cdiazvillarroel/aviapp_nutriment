-- =========================================================================
-- 0001_init.sql — Initial schema for Nutriment Portal
-- =========================================================================
--
-- Conventions:
--   - All client-scoped tables include a `client_id` for RLS filtering.
--   - All timestamps are timestamptz, default now().
--   - Soft-deletable tables use `archived_at` rather than hard deletes
--     (keeps audit trails clean — important for APVMA reports).
-- =========================================================================

create extension if not exists "pgcrypto";

-- ----- Enums --------------------------------------------------------------
create type member_role     as enum ('admin', 'vet', 'tech', 'producer');
create type complex_kind    as enum ('rspca', 'free_range', 'conventional');
create type visit_type      as enum ('routine', 'sanitary', 'post_mortem', 'audit');
create type visit_status    as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type alert_severity  as enum ('info', 'warning', 'critical');
create type alert_status    as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type alert_source    as enum ('ai_predictive', 'rule_engine', 'manual', 'overdue');

-- ----- Multi-tenancy ------------------------------------------------------

create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  country     text not null default 'AU',
  created_at  timestamptz not null default now()
);

-- Map between auth.users and clients with a role.
-- A user can belong to multiple clients (e.g. a vet who serves several producers).
create table client_members (
  client_id   uuid not null references clients(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'tech',
  display_name text,
  joined_at   timestamptz not null default now(),
  primary key (client_id, user_id)
);

create index on client_members(user_id);

-- ----- Reference catalogs (per client) -----------------------------------

create table complexes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  kind        complex_kind,
  created_at  timestamptz not null default now()
);
create index on complexes(client_id);

create table regions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null
);
create index on regions(client_id);

create table breeds (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null
);

-- ----- Core entities ------------------------------------------------------

create table farms (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,
  reference_id  text,
  complex_id    uuid references complexes(id),
  region_id     uuid references regions(id),
  address       text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on farms(client_id) where archived_at is null;
create index on farms(complex_id);
create index on farms(region_id);

create table houses (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references farms(id) on delete cascade,
  name            text not null,
  custom_id       text,
  dimensions      text,
  drink_system    text,
  feed_system     text,
  housing_system  text,
  capacity        int,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on houses(farm_id) where archived_at is null;

create table flocks (
  id              uuid primary key default gen_random_uuid(),
  house_id        uuid not null references houses(id) on delete cascade,
  reference       text,                 -- '#24-04'
  breed_id        uuid references breeds(id),
  placement_date  date not null,
  expected_clearout date,
  initial_count   int,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on flocks(house_id) where active = true;
create index on flocks(placement_date);

-- ----- Visits & scoring ---------------------------------------------------

create table visits (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  farm_id       uuid not null references farms(id) on delete cascade,
  scheduled_at  timestamptz not null,
  type          visit_type not null default 'routine',
  status        visit_status not null default 'planned',
  technician_id uuid references auth.users(id),
  notes         text,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on visits(client_id, scheduled_at desc);
create index on visits(farm_id, scheduled_at desc);
create index on visits(status) where status in ('planned', 'in_progress');

-- A visit can cover multiple flocks (typical when scoring a whole shed).
create table visit_flocks (
  visit_id  uuid not null references visits(id) on delete cascade,
  flock_id  uuid not null references flocks(id) on delete cascade,
  primary key (visit_id, flock_id)
);

-- Catalogue of scorable items (shared across clients; managed by Nutriment).
create table scoring_definitions (
  id            uuid primary key default gen_random_uuid(),
  section       text not null,             -- 'Coccidiosis', 'External', etc.
  code          text unique not null,      -- 'eimeria_acervulina'
  name          text not null,             -- 'Eimeria acervulina'
  scale_max     int  not null default 4,   -- 0..scale_max
  description   text,
  display_order int  not null default 0,
  ai_enabled    boolean not null default false
);
create index on scoring_definitions(section, display_order);

-- Per-visit, per-flock, per-item score.
create table visit_scores (
  id                    uuid primary key default gen_random_uuid(),
  visit_id              uuid not null references visits(id) on delete cascade,
  flock_id              uuid references flocks(id),
  definition_id         uuid not null references scoring_definitions(id),
  score                 int,                 -- nullable until scored
  notes                 text,
  scored_by             uuid references auth.users(id),
  scored_at             timestamptz,
  ai_suggested_score    int,
  ai_confidence         numeric(4,3),        -- 0.000..1.000
  ai_accepted           boolean,
  created_at            timestamptz not null default now(),
  unique (visit_id, flock_id, definition_id)
);
create index on visit_scores(visit_id);

-- Photos attached to a score (for AI training + audit).
create table photos (
  id              uuid primary key default gen_random_uuid(),
  visit_score_id  uuid references visit_scores(id) on delete cascade,
  storage_path    text not null,        -- path in Supabase Storage
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now(),
  ai_processed_at timestamptz
);
create index on photos(visit_score_id);

-- ----- Daily records (mortality, water, feed) -----------------------------

create table daily_records (
  id            uuid primary key default gen_random_uuid(),
  flock_id      uuid not null references flocks(id) on delete cascade,
  date          date not null,
  age_days      int,
  mortality     int default 0,
  water_liters  numeric,
  feed_kg       numeric,
  recorded_by   uuid references auth.users(id),
  unique (flock_id, date)
);
create index on daily_records(flock_id, date desc);

-- ----- Prescriptions (for APVMA reports) ---------------------------------

create table prescriptions (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  flock_id          uuid not null references flocks(id) on delete cascade,
  vet_id            uuid references auth.users(id),
  drug_name         text not null,
  dose              text,
  start_date        date not null,
  end_date          date not null,
  withdrawal_days   int default 0,
  reason            text,
  created_at        timestamptz not null default now()
);
create index on prescriptions(client_id, start_date desc);
create index on prescriptions(flock_id);

-- ----- Alerts -------------------------------------------------------------

create table alerts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  farm_id       uuid references farms(id),
  flock_id      uuid references flocks(id),
  severity      alert_severity not null,
  status        alert_status not null default 'open',
  source        alert_source not null,
  title         text not null,
  body          text,
  detected_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id)
);
create index on alerts(client_id, status, detected_at desc);
create index on alerts(farm_id) where status = 'open';
