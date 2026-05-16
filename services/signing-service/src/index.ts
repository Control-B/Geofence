import "dotenv/config";
import {query} from "../../shared/db";
import {createServiceApp, asyncHandler, errorHandler} from "../../shared/http";
import {isExpired} from "../../shared/tokens";
import {safeString, signatureSchema} from "../../shared/validation";

const app = createServiceApp("signing-service");

async function findCheckInByToken(token: string) {
  const result = await query(
    "select id, driver_name, carrier_name, load_number, token_expires_at from check_ins where signing_token = $1 limit 1",
    [token]
  );
  return result.rows[0];
}

async function hasSignature(checkInId: string) {
  const result = await query<{count: string}>("select count(*) from signatures where check_in_id = $1", [checkInId]);
  return Number(result.rows[0]?.count || 0) > 0;
}

app.get("/signatures/:token", asyncHandler(async (request, response) => {
  const checkIn = await findCheckInByToken(request.params.token);
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    response.status(404).json({error: "This signing link is invalid or expired."});
    return;
  }

  response.json({
    checkInId: checkIn.id,
    driverName: checkIn.driver_name,
    carrierName: checkIn.carrier_name,
    loadNumber: checkIn.load_number,
    title: "Warehouse Arrival / Departure Confirmation",
    expiresAt: checkIn.token_expires_at,
    signed: await hasSignature(checkIn.id)
  });
}));

app.post("/signatures/:token", asyncHandler(async (request, response) => {
  const parsed = signatureSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({error: parsed.error.errors[0]?.message || "Invalid signature."});
    return;
  }

  const checkIn = await findCheckInByToken(request.params.token);
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    response.status(404).json({error: "This signing link is invalid or expired."});
    return;
  }

  const ipAddress = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || request.ip || "unknown";
  const userAgent = request.headers["user-agent"] || "unknown";
  const input = parsed.data;
  await query(
    `insert into signatures (check_in_id, signer_name, signer_role, typed_signature, drawn_signature_url,
      consent_checked, ip_address, user_agent)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      checkIn.id,
      safeString(input.signerName),
      input.signerRole,
      safeString(input.typedSignature),
      input.drawnSignatureDataUrl || null,
      input.consentChecked,
      ipAddress,
      userAgent
    ]
  );

  response.json({message: "Signed successfully", pdf: {status: "stubbed", message: "Downloadable signed summary PDF will be generated in a later release."}});
}));

app.use(errorHandler);

const port = Number(process.env.PORT || 4004);
app.listen(port, () => console.log(`signing-service listening on ${port}`));
