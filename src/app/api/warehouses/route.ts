import {NextResponse} from "next/server";
import {mockWarehouse, hasDatabase} from "@/lib/config";
import {query} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({warehouses: [mockWarehouse]});
  }

  const result = await query<typeof mockWarehouse>(
    "select id, name, phone, latitude, longitude, radius_meters, created_at from warehouses order by created_at asc limit 20"
  );

  return NextResponse.json({warehouses: result.rows.length ? result.rows : [mockWarehouse]});
}