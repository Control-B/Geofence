import {auth} from "@clerk/nextjs/server";
import {NextRequest, NextResponse} from "next/server";
import {hasDatabase} from "@/lib/config";
import {query} from "@/lib/db";
import {devStore} from "@/lib/dev-store";

export const dynamic = "force-dynamic";

type Action = "manual_approved" | "rejected";

async function requireAuth() {
  const {userId} = await auth();
  return Boolean(userId);
}

export async function GET(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  if (!(await requireAuth())) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  const {id} = await context.params;

  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.id === id);
    if (!checkIn) return NextResponse.json({error: "Check-in not found."}, {status: 404});
    return NextResponse.json({
      checkIn,
      documents: devStore.documents.filter((document) => document.check_in_id === id),
      signatures: devStore.signatures.filter((signature) => signature.check_in_id === id)
    });
  }

  const checkInResult = await query("select * from check_ins where id = $1 limit 1", [id]);
  const checkIn = checkInResult.rows[0];
  if (!checkIn) return NextResponse.json({error: "Check-in not found."}, {status: 404});

  const documents = await query("select * from documents where check_in_id = $1 order by uploaded_at desc", [id]);
  const signatures = await query("select * from signatures where check_in_id = $1 order by signed_at desc", [id]);
  return NextResponse.json({checkIn, documents: documents.rows, signatures: signatures.rows});
}

export async function PATCH(request: NextRequest, context: {params: Promise<{id: string}>}) {
  if (!(await requireAuth())) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  const {id} = await context.params;
  const body = await request.json();
  const action = body.action as Action;
  if (!['manual_approved', 'rejected'].includes(action)) {
    return NextResponse.json({error: "Invalid override action."}, {status: 400});
  }

  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.id === id);
    if (!checkIn) return NextResponse.json({error: "Check-in not found."}, {status: 404});
    checkIn.geofence_status = action;
    checkIn.verified_at = action === "manual_approved" ? new Date().toISOString() : checkIn.verified_at;
    return NextResponse.json({checkIn});
  }

  const result = await query(
    "update check_ins set geofence_status = $1, verified_at = coalesce(verified_at, now()) where id = $2 returning *",
    [action, id]
  );
  return NextResponse.json({checkIn: result.rows[0]});
}