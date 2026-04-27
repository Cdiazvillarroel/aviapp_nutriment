create table if not exists farm_contacts (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  role        text not null,
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  display_order int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists farm_contacts_farm_id_idx on farm_contacts(farm_id);

alter table farm_contacts enable row level security;

drop policy if exists "Farm contacts: members can read" on farm_contacts;
create policy "Farm contacts: members can read"
  on farm_contacts for select
  using (
    farm_id in (
      select id from farms
      where client_id in (select client_id from client_members where user_id = auth.uid())
    )
  );

drop policy if exists "Farm contacts: members can insert" on farm_contacts;
create policy "Farm contacts: members can insert"
  on farm_contacts for insert
  with check (
    farm_id in (
      select id from farms
      where client_id in (select client_id from client_members where user_id = auth.uid())
    )
  );

drop policy if exists "Farm contacts: members can update" on farm_contacts;
create policy "Farm contacts: members can update"
  on farm_contacts for update
  using (
    farm_id in (
      select id from farms
      where client_id in (select client_id from client_members where user_id = auth.uid())
    )
  );

drop policy if exists "Farm contacts: members can delete" on farm_contacts;
create policy "Farm contacts: members can delete"
  on farm_contacts for delete
  using (
    farm_id in (
      select id from farms
      where client_id in (select client_id from client_members where user_id = auth.uid())
    )
  );

do $$
declare
  v_farm_id uuid;
begin
  if not exists (select 1 from farm_contacts) then
    select id into v_farm_id
    from farms
    where client_id = '11111111-1111-1111-1111-111111111111'
    order by created_at
    limit 1;

    if v_farm_id is not null then
      insert into farm_contacts (farm_id, role, name, phone, email, display_order) values
        (v_farm_id, 'Farm Manager',  'David Robertson', '+61 412 345 678', 'd.robertson@bendigopoultry.au', 0),
        (v_farm_id, 'Owner',         'Margaret Chen',   '+61 423 567 890', 'm.chen@example.au',             1),
        (v_farm_id, 'Feed Supplier', 'Riverina Stockfeeds', '+61 3 5443 1100', 'orders@riverinastock.au',  2);
    end if;
  end if;
end $$;
