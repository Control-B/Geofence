create extension if not exists pgcrypto;

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  radius_meters integer not null default 150 check (radius_meters between 25 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  driver_name text not null,
  driver_phone text not null,
  carrier_name text not null,
  truck_number text not null,
  trailer_number text not null,
  load_number text not null,
  type text not null check (type in ('arrival', 'departure')),
  notes text not null default '',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  distance_meters integer,
  geofence_status text not null check (geofence_status in ('verified', 'outside_zone', 'denied', 'manual_approved', 'rejected', 'pending')),
  sms_message text not null,
  document_token text not null unique,
  signing_token text not null unique,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references check_ins(id) on delete cascade,
  file_name text not null,
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  storage_url text not null,
  document_category text not null check (document_category in ('BOL', 'POD', 'Rate confirmation', 'Lumper receipt', 'ID / license', 'Other')),
  uploaded_at timestamptz not null default now()
);

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references check_ins(id) on delete cascade,
  signer_name text not null,
  signer_role text not null check (signer_role in ('Driver', 'Warehouse receiver', 'Dispatcher', 'Other')),
  typed_signature text not null,
  drawn_signature_url text,
  consent_checked boolean not null default false,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  public_trip_token text not null unique,
  public_token_expires_at timestamptz not null,
  trip_reference text not null,
  driver_name text not null,
  driver_phone text not null,
  warehouse_name text not null,
  warehouse_lat numeric(10, 7) not null,
  warehouse_lng numeric(10, 7) not null,
  geofence_radius_meters integer not null default 250 check (geofence_radius_meters between 25 and 5000),
  scheduled_arrival_time timestamptz not null,
  status text not null check (status in ('CREATED', 'SMS_SENT', 'TRACKING_STARTED', 'ARRIVED', 'CONFIRMED', 'DOCKED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists location_pings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_meters numeric(10, 2) not null,
  speed numeric(10, 2),
  heading numeric(10, 2),
  timestamp timestamptz not null,
  distance_to_warehouse_meters integer not null,
  is_inside_geofence boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  event_type text not null,
  event_payload_json jsonb not null default '{}'::jsonb,
  created_by text not null,
  correlation_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  blob_url text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  status text not null check (status in ('PENDING', 'UPLOADED', 'REJECTED'))
);

create index if not exists check_ins_created_at_idx on check_ins(created_at desc);
create index if not exists check_ins_status_idx on check_ins(geofence_status);
create index if not exists check_ins_type_idx on check_ins(type);
create index if not exists documents_check_in_id_idx on documents(check_in_id);
create index if not exists signatures_check_in_id_idx on signatures(check_in_id);
create index if not exists trips_public_trip_token_idx on trips(public_trip_token);
create index if not exists trips_status_idx on trips(status);
create index if not exists location_pings_trip_id_timestamp_idx on location_pings(trip_id, timestamp desc);
create index if not exists trip_events_trip_id_created_at_idx on trip_events(trip_id, created_at desc);
create index if not exists trip_documents_trip_id_idx on trip_documents(trip_id);