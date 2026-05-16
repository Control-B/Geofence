import {NextRequest, NextResponse} from "next/server";
import {hasDatabase} from "@/lib/config";
import {query} from "@/lib/db";
import {devStore} from "@/lib/dev-store";
import {generateSignedSummaryPdf} from "@/lib/pdf";
import {isExpired} from "@/lib/tokens";
import {safeString, signatureSchema} from "@/lib/validation";

export const dynamic = "force-dynamic";

type CheckInTokenRow = {
  id: string;
  driver_name: string;
  carrier_name: string;
  load_number: string;
  token_expires_at: string;
};

async function hasSignature(checkInId: string) {
  if (!hasDatabase()) return devStore.signatures.some((signature) => signature.check_in_id === checkInId);
  const result = await query<{count: string}>("select count(*) from signatures where check_in_id = $1", [checkInId]);
  return Number(result.rows[0]?.count || 0) > 0;
}

export async function GET(_request: NextRequest, context: {params: Promise<{token: string}>}) {
  const {token} = await context.params;
  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.signing_token === token);
    if (!checkIn || isExpired(checkIn.token_expires_at)) {
      return NextResponse.json({error: "This signing link is invalid or expired."}, {status: 404});
    }
    return NextResponse.json({
      checkInId: checkIn.id,
      driverName: checkIn.driver_name,
      carrierName: checkIn.carrier_name,
      loadNumber: checkIn.load_number,
      title: "Warehouse Arrival / Departure Confirmation",
      expiresAt: checkIn.token_expires_at,
      signed: await hasSignature(checkIn.id)
    });
  }

  const checkInResult = await query<CheckInTokenRow>(
    "select id, driver_name, carrier_name, load_number, token_expires_at from check_ins where signing_token = $1 limit 1",
    [token]
  );
  const checkIn = checkInResult.rows[0];
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    return NextResponse.json({error: "This signing link is invalid or expired."}, {status: 404});
  }

  return NextResponse.json({
    checkInId: checkIn.id,
    driverName: checkIn.driver_name,
    carrierName: checkIn.carrier_name,
    loadNumber: checkIn.load_number,
    title: "Warehouse Arrival / Departure Confirmation",
    expiresAt: checkIn.token_expires_at,
    signed: await hasSignature(checkIn.id)
  });
}

export async function POST(request: NextRequest, context: {params: Promise<{token: string}>}) {
  const {token} = await context.params;
  const parsed = signatureSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({error: parsed.error.errors[0]?.message || "Invalid signature."}, {status: 400});
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const input = parsed.data;

  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.signing_token === token);
    if (!checkIn || isExpired(checkIn.token_expires_at)) {
      return NextResponse.json({error: "This signing link is invalid or expired."}, {status: 404});
    }
    devStore.signatures.unshift({
      id: crypto.randomUUID(),
      check_in_id: checkIn.id,
      signer_name: safeString(input.signerName),
      signer_role: input.signerRole,
      typed_signature: safeString(input.typedSignature),
      drawn_signature_url: input.drawnSignatureDataUrl || null,
      consent_checked: input.consentChecked,
      ip_address: ipAddress,
      user_agent: userAgent,
      signed_at: new Date().toISOString()
    });
    return NextResponse.json({message: "Signed successfully", pdf: await generateSignedSummaryPdf()});
  }

  const checkInResult = await query<CheckInTokenRow>("select id, token_expires_at from check_ins where signing_token = $1 limit 1", [token]);
  const checkIn = checkInResult.rows[0];
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    return NextResponse.json({error: "This signing link is invalid or expired."}, {status: 404});
  }

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

  return NextResponse.json({message: "Signed successfully", pdf: await generateSignedSummaryPdf()});
}