insert into warehouses (id, name, phone, latitude, longitude, radius_meters)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo Logistics Warehouse',
  '+15551234567',
  40.706001,
  -74.008800,
  150
)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_meters = excluded.radius_meters;