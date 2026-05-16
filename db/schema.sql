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

create index if not exists check_ins_created_at_idx on check_ins(created_at desc);
create index if not exists check_ins_status_idx on check_ins(geofence_status);
create index if not exists check_ins_type_idx on check_ins(type);
create index if not exists documents_check_in_id_idx on documents(check_in_id);
create index if not exists signatures_check_in_id_idx on signatures(check_in_id);