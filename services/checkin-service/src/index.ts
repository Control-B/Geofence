import "dotenv/config";
import {appUrl, mockWarehouse} from "../../shared/config";
import {query} from "../../shared/db";
import {calculateDistanceMeters, getGeofenceStatus} from "../../shared/geofence";
import {createServiceApp, asyncHandler, errorHandler} from "../../shared/http";
import {incrementRateLimit} from "../../shared/redis";
import {buildSmsLink, buildSmsMessage} from "../../shared/sms";
import {createToken, createTokenExpiry} from "../../shared/tokens";
import {checkInSchema, safeString} from "../../shared/validation";

const app = createServiceApp("checkin-service");

app.get("/warehouses", asyncHandler(async (_request, response) => {
  if (!process.env.DATABASE_URL) {
    response.json({warehouses: [mockWarehouse]});
    return;
  }

  const result = await query("select * from warehouses order by created_at asc limit 25");
  response.json({warehouses: result.rows.length ? result.rows : [mockWarehouse]});
}));

app.post("/check-ins", asyncHandler(async (request, response) => {
  const ipAddress = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || request.ip || "unknown";
  const rate = await incrementRateLimit(`checkin:${ipAddress}`, 60);
  if (rate.limited) {
    response.status(429).json({error: "Too many check-in attempts. Please wait a minute."});
    return;
  }

  const parsed = checkInSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({error: parsed.error.errors[0]?.message || "Invalid check-in details."});
    return;
  }

  if (!process.env.DATABASE_URL) {
    response.status(503).json({error: "DATABASE_URL is required for the check-in service."});
    return;
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

  const smsMessage = buildSmsMessage({
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
  });

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

  response.json({
    id: result.rows[0].id,
    geofenceStatus,
    distanceMeters,
    verifiedAt: verifiedAt?.toISOString() || null,
    smsMessage,
    smsLink: buildSmsLink(input.warehousePhone, smsMessage),
    documentUploadLink: `${appUrl}/docs/${documentToken}`,
    signingLink: `${appUrl}/sign/${signingToken}`
  });
}));

app.use(errorHandler);

const port = Number(process.env.PORT || 4001);
app.listen(port, () => console.log(`checkin-service listening on ${port}`));
