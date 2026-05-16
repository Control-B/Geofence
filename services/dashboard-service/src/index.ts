import "dotenv/config";
import {query} from "../../shared/db";
import {requireWarehouseAuth} from "../../shared/auth";
import {createServiceApp, asyncHandler, errorHandler} from "../../shared/http";

const app = createServiceApp("dashboard-service");
app.use(requireWarehouseAuth);

const appUrl = process.env.APP_URL || "http://localhost:3000";

type CheckInRow = Record<string, string | number | null> & {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  warehouse_phone: string;
  warehouse_latitude: string;
  warehouse_longitude: string;
  warehouse_radius_meters: number;
  driver_name: string;
  driver_phone: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  load_number: string;
  type: "arrival" | "departure";
  geofence_status: string;
  document_token: string;
  signing_token: string;
  created_at: string;
  verified_at: string | null;
  document_count: string;
  signature_count: string;
};

function statusLabel(status?: string | null) {
  return status ? status.replaceAll("_", " ") : "pending";
}

function buildCheckoutLink(record: CheckInRow) {
  const params = new URLSearchParams({
    type: "departure",
    warehouseName: record.warehouse_name,
    warehousePhone: record.warehouse_phone,
    driverName: record.driver_name,
    driverPhone: record.driver_phone,
    carrierName: record.carrier_name,
    truckNumber: record.truck_number,
    trailerNumber: record.trailer_number,
    loadNumber: record.load_number,
    notes: `Check-out for load ${record.load_number}`
  });
  return `${appUrl}/check-in?${params.toString()}`;
}

function workflowStatus(arrival?: CheckInRow, departure?: CheckInRow, documentCount = 0, signatureCount = 0) {
  if (arrival?.geofence_status === "rejected" || departure?.geofence_status === "rejected") return "attention_required";
  if (departure?.geofence_status === "verified" || departure?.geofence_status === "manual_approved") return "checked_out";
  if (!arrival) return "awaiting_check_in";
  if (arrival.geofence_status !== "verified" && arrival.geofence_status !== "manual_approved") return "geofence_review";
  if (documentCount === 0) return "awaiting_documents";
  if (signatureCount === 0) return "awaiting_signature";
  return "ready_for_checkout";
}

app.get("/check-ins", asyncHandler(async (request, response) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({error: "DATABASE_URL is required for the dashboard service."});
    return;
  }

  const status = String(request.query.status || "all");
  const params: unknown[] = [];
  const statusClause = status && status !== "all" ? "where ci.geofence_status = $1 or ci.type = $1" : "";
  if (statusClause) params.push(status);

  const result = await query(
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

  response.json({checkIns: result.rows});
}));

app.get("/freight", asyncHandler(async (_request, response) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({error: "DATABASE_URL is required for the dashboard service."});
    return;
  }

  const result = await query<CheckInRow>(
    `select ci.*, w.name as warehouse_name, w.phone as warehouse_phone, w.latitude as warehouse_latitude,
       w.longitude as warehouse_longitude, w.radius_meters as warehouse_radius_meters,
       count(distinct d.id) as document_count, count(distinct s.id) as signature_count
     from check_ins ci
     join warehouses w on w.id = ci.warehouse_id
     left join documents d on d.check_in_id = ci.id
     left join signatures s on s.check_in_id = ci.id
     group by ci.id, w.id
     order by ci.created_at desc
     limit 300`
  );

  const grouped = new Map<string, {arrival?: CheckInRow; departure?: CheckInRow; documentCount: number; signatureCount: number}>();
  for (const row of result.rows) {
    const key = [row.warehouse_id, row.carrier_name, row.truck_number, row.trailer_number, row.load_number].join("::");
    const current = grouped.get(key) || {documentCount: 0, signatureCount: 0};
    if (row.type === "arrival" && (!current.arrival || row.created_at > current.arrival.created_at)) current.arrival = row;
    if (row.type === "departure" && (!current.departure || row.created_at > current.departure.created_at)) current.departure = row;
    current.documentCount += Number(row.document_count || 0);
    current.signatureCount += Number(row.signature_count || 0);
    grouped.set(key, current);
  }

  const freight = Array.from(grouped.values()).map((group) => {
    const primary = group.arrival || group.departure!;
    const documentSource = group.arrival || primary;
    const signingSource = group.arrival || primary;
    const status = workflowStatus(group.arrival, group.departure, group.documentCount, group.signatureCount);
    return {
      id: `${primary.warehouse_id}:${primary.carrier_name}:${primary.truck_number}:${primary.trailer_number}:${primary.load_number}`,
      warehouseName: primary.warehouse_name,
      driverName: primary.driver_name,
      driverPhone: primary.driver_phone,
      carrierName: primary.carrier_name,
      truckNumber: primary.truck_number,
      trailerNumber: primary.trailer_number,
      loadNumber: primary.load_number,
      workflowStatus: status,
      workflowLabel: statusLabel(status),
      arrival: group.arrival ? {
        id: group.arrival.id,
        geofenceStatus: group.arrival.geofence_status,
        statusLabel: statusLabel(group.arrival.geofence_status),
        distanceMeters: group.arrival.distance_meters,
        createdAt: group.arrival.created_at,
        verifiedAt: group.arrival.verified_at
      } : null,
      departure: group.departure ? {
        id: group.departure.id,
        geofenceStatus: group.departure.geofence_status,
        statusLabel: statusLabel(group.departure.geofence_status),
        distanceMeters: group.departure.distance_meters,
        createdAt: group.departure.created_at,
        verifiedAt: group.departure.verified_at
      } : null,
      documents: {
        count: group.documentCount,
        status: group.documentCount > 0 ? "received" : "needed",
        uploadLink: `${appUrl}/docs/${documentSource.document_token}`,
        warehouseViewLink: `${appUrl}/docs/${documentSource.document_token}?view=warehouse`
      },
      signing: {
        count: group.signatureCount,
        status: group.signatureCount > 0 ? "signed" : "pending",
        signingLink: `${appUrl}/sign/${signingSource.signing_token}`
      },
      checkoutLink: group.departure ? null : buildCheckoutLink(primary),
      detailLink: `/dashboard/${primary.id}`,
      lastActivityAt: group.departure?.created_at || group.arrival?.created_at || primary.created_at
    };
  });

  response.json({freight: freight.sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))});
}));

app.get("/check-ins/:id", asyncHandler(async (request, response) => {
  const checkInResult = await query("select * from check_ins where id = $1 limit 1", [request.params.id]);
  const checkIn = checkInResult.rows[0];
  if (!checkIn) {
    response.status(404).json({error: "Check-in not found."});
    return;
  }

  const documents = await query("select * from documents where check_in_id = $1 order by uploaded_at desc", [request.params.id]);
  const signatures = await query("select * from signatures where check_in_id = $1 order by signed_at desc", [request.params.id]);
  response.json({checkIn, documents: documents.rows, signatures: signatures.rows});
}));

app.patch("/check-ins/:id", asyncHandler(async (request, response) => {
  const action = request.body.action as "manual_approved" | "rejected";
  if (!["manual_approved", "rejected"].includes(action)) {
    response.status(400).json({error: "Invalid override action."});
    return;
  }

  const result = await query(
    "update check_ins set geofence_status = $1, verified_at = case when $1 = 'manual_approved' then coalesce(verified_at, now()) else verified_at end where id = $2 returning *",
    [action, request.params.id]
  );
  if (!result.rows[0]) {
    response.status(404).json({error: "Check-in not found."});
    return;
  }
  response.json({checkIn: result.rows[0]});
}));

app.use(errorHandler);

const port = Number(process.env.PORT || 4002);
app.listen(port, () => console.log(`dashboard-service listening on ${port}`));
