import {auth} from "@clerk/nextjs/server";
import {NextRequest, NextResponse} from "next/server";
import {appUrl, hasDatabase, mockWarehouse} from "@/lib/config";
import {query} from "@/lib/db";
import {addDevCheckIn, devStore} from "@/lib/dev-store";
import {calculateDistanceMeters, getGeofenceStatus} from "@/lib/geofence";
import {incrementRateLimit} from "@/lib/redis";
import {buildSmsMessage, buildSmsLink} from "@/lib/sms";
import {createToken, createTokenExpiry} from "@/lib/tokens";
import {checkInSchema, safeString} from "@/lib/validation";

export const dynamic = "force-dynamic";

type CheckInRow = {
  id: string;
  status: string;
  driver_name: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  load_number: string;
  type: "arrival" | "departure";
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  geofence_status: string;
  sms_message: string;
  document_token: string;
  signing_token: string;
  created_at: string;
  verified_at: string | null;
  document_count: string;
  signature_count: string;
};

export async function GET(request: NextRequest) {
  const {userId} = await auth();
  if (!userId) return NextResponse.json({error: "Unauthorized"}, {status: 401});

  if (!hasDatabase()) {
    const status = request.nextUrl.searchParams.get("status");
    const rows = devStore.checkIns
      .filter((item) => !status || status === "all" || item.geofence_status === status || item.type === status)
      .map((item) => ({
        ...item,
        document_count: String(devStore.documents.filter((document) => document.check_in_id === item.id).length),
        signature_count: String(devStore.signatures.filter((signature) => signature.check_in_id === item.id).length)
      }));
    return NextResponse.json({checkIns: rows});
  }

  const status = request.nextUrl.searchParams.get("status");
  const params: unknown[] = [];
  const statusClause = status && status !== "all" ? "where ci.geofence_status = $1 or ci.type = $1" : "";
  if (statusClause) params.push(status);

  const result = await query<CheckInRow>(
    `select ci.*, count(distinct d.id) as document_count, count(distinct s.id) as signature_count
     from check_ins ci
     left join documents d on d.check_in_id = ci.id
     left join signatures s on s.check_in_id = ci.id
     ${statusClause}
     group by ci.id
     order by ci.created_at desc
     limit 200`,
    params
  );

  return NextResponse.json({checkIns: result.rows});
}

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await incrementRateLimit(`checkin:${ipAddress}`, 60);
  if (rate.limited) {
    return NextResponse.json({error: "Too many check-in attempts. Please wait a minute."}, {status: 429});
  }

  const json = await request.json();
  const parsed = checkInSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({error: parsed.error.errors[0]?.message || "Invalid check-in details."}, {status: 400});
  }

  const input = parsed.data;
  const documentToken = createToken();
  const signingToken = createToken();
  const tokenExpiresAt = createTokenExpiry();
  const createdAt = new Date();
  const hasCoordinates = typeof input.latitude === "number" && typeof input.longitude === "number";
  const distanceMeters = hasCoordinates
    ? calculateDistanceMeters(input.latitude!, input.longitude!, input.warehouseLatitude, input.warehouseLongitude)
    : null;
  const geofenceStatus = input.permissionDenied
    ? "denied"
    : distanceMeters === null
      ? "pending"
      : getGeofenceStatus(distanceMeters, input.warehouseRadiusMeters);
  const verifiedAt = geofenceStatus === "verified" ? createdAt : null;

  const basePayload = {
    warehousePhone: input.warehousePhone,
    driverName: safeString(input.driverName),
    carrierName: safeString(input.carrierName),
    truckNumber: safeString(input.truckNumber),
    trailerNumber: safeString(input.trailerNumber),
    loadNumber: safeString(input.loadNumber),
    type: input.type,
    verifiedAt: createdAt.toISOString(),
    documentToken,
    signingToken
  };
  const smsMessage = buildSmsMessage(basePayload);

  if (!hasDatabase()) {
    const id = crypto.randomUUID();
    addDevCheckIn({
      id,
      warehouse_id: input.warehouseId || mockWarehouse.id,
      driver_name: input.driverName,
      driver_phone: input.driverPhone,
      carrier_name: input.carrierName,
      truck_number: input.truckNumber,
      trailer_number: input.trailerNumber,
      load_number: input.loadNumber,
      type: input.type,
      notes: input.notes,
      latitude: input.latitude,
      longitude: input.longitude,
      distance_meters: distanceMeters,
      geofence_status: geofenceStatus,
      sms_message: smsMessage,
      document_token: documentToken,
      signing_token: signingToken,
      verified_at: verifiedAt?.toISOString() || null
    });
    return NextResponse.json({
      id,
      geofenceStatus,
      distanceMeters,
      verifiedAt: verifiedAt?.toISOString() || null,
      smsMessage,
      smsLink: buildSmsLink(input.warehousePhone, smsMessage),
      documentUploadLink: `${appUrl}/docs/${documentToken}`,
      signingLink: `${appUrl}/sign/${signingToken}`
    });
  }

  const warehouse = await query<{id: string}>(
    `insert into warehouses (id, name, phone, latitude, longitude, radius_meters)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set name = excluded.name, phone = excluded.phone, latitude = excluded.latitude,
       longitude = excluded.longitude, radius_meters = excluded.radius_meters
     returning id`,
    [input.warehouseId || mockWarehouse.id, input.warehouseName, input.warehousePhone, input.warehouseLatitude, input.warehouseLongitude, input.warehouseRadiusMeters]
  );

  const result = await query<{id: string}>(
    `insert into check_ins (
      warehouse_id, driver_name, driver_phone, carrier_name, truck_number, trailer_number, load_number,
      type, notes, latitude, longitude, distance_meters, geofence_status, sms_message,
      document_token, signing_token, token_expires_at, verified_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    returning id`,
    [
      warehouse.rows[0].id,
      input.driverName,
      input.driverPhone,
      input.carrierName,
      input.truckNumber,
      input.trailerNumber,
      input.loadNumber,
      input.type,
      input.notes,
      input.latitude,
      input.longitude,
      distanceMeters,
      geofenceStatus,
      smsMessage,
      documentToken,
      signingToken,
      tokenExpiresAt,
      verifiedAt
    ]
  );

  return NextResponse.json({
    id: result.rows[0].id,
    geofenceStatus,
    distanceMeters,
    verifiedAt: verifiedAt?.toISOString() || null,
    smsMessage,
    smsLink: buildSmsLink(input.warehousePhone, smsMessage),
    documentUploadLink: `${appUrl}/docs/${documentToken}`,
    signingLink: `${appUrl}/sign/${signingToken}`
  });
}