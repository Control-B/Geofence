export const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const tokenTtlHours = Number(process.env.TOKEN_TTL_HOURS || 72);

export const mockWarehouse = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Demo Logistics Warehouse",
  phone: "+15551234567",
  latitude: 40.706001,
  longitude: -74.0088,
  radius_meters: 150,
  created_at: new Date().toISOString()
};

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}