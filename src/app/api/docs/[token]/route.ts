import {NextRequest, NextResponse} from "next/server";
import {hasDatabase} from "@/lib/config";
import {query} from "@/lib/db";
import {devStore} from "@/lib/dev-store";
import {createPrivateReadUrl, uploadPrivateDocument, validateUpload} from "@/lib/documents";
import {isExpired} from "@/lib/tokens";
import {documentCategorySchema, safeString} from "@/lib/validation";

export const dynamic = "force-dynamic";

type CheckInTokenRow = {
  id: string;
  driver_name: string;
  carrier_name: string;
  load_number: string;
  token_expires_at: string;
};

type DocumentRow = {
  id: string;
  check_in_id: string;
  file_name: string;
  file_type: string;
  storage_url: string;
  document_category: string;
  uploaded_at: string;
};

async function addPrivateUrls(documents: DocumentRow[], warehouseView: boolean) {
  if (!warehouseView) return documents.map(({storage_url, ...document}) => ({...document}));

  return Promise.all(
    documents.map(async (document) => ({
      ...document,
      private_read_url: await createPrivateReadUrl(document.storage_url)
    }))
  );
}

export async function GET(request: NextRequest, context: {params: Promise<{token: string}>}) {
  const {token} = await context.params;
  const warehouseView = request.nextUrl.searchParams.get("view") === "warehouse";

  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.document_token === token);
    if (!checkIn || isExpired(checkIn.token_expires_at)) {
      return NextResponse.json({error: "This document link is invalid or expired."}, {status: 404});
    }
    const documents = devStore.documents.filter((document) => document.check_in_id === checkIn.id);
    return NextResponse.json({
      checkInId: checkIn.id,
      driverName: checkIn.driver_name,
      carrierName: checkIn.carrier_name,
      loadNumber: checkIn.load_number,
      expiresAt: checkIn.token_expires_at,
      warehouseView,
      documents: await addPrivateUrls(documents, warehouseView)
    });
  }

  const checkInResult = await query<CheckInTokenRow>(
    "select id, driver_name, carrier_name, load_number, token_expires_at from check_ins where document_token = $1 limit 1",
    [token]
  );
  const checkIn = checkInResult.rows[0];
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    return NextResponse.json({error: "This document link is invalid or expired."}, {status: 404});
  }

  const documentsResult = await query<DocumentRow>("select * from documents where check_in_id = $1 order by uploaded_at desc", [checkIn.id]);
  return NextResponse.json({
    checkInId: checkIn.id,
    driverName: checkIn.driver_name,
    carrierName: checkIn.carrier_name,
    loadNumber: checkIn.load_number,
    expiresAt: checkIn.token_expires_at,
    warehouseView,
    documents: await addPrivateUrls(documentsResult.rows, warehouseView)
  });
}

export async function POST(request: NextRequest, context: {params: Promise<{token: string}>}) {
  const {token} = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");
  const category = documentCategorySchema.safeParse(formData.get("category"));

  if (!(file instanceof File)) {
    return NextResponse.json({error: "A file is required."}, {status: 400});
  }
  if (!category.success) {
    return NextResponse.json({error: "Choose a valid document category."}, {status: 400});
  }
  const uploadError = validateUpload(file);
  if (uploadError) return NextResponse.json({error: uploadError}, {status: 400});

  if (!hasDatabase()) {
    const checkIn = devStore.checkIns.find((item) => item.document_token === token);
    if (!checkIn || isExpired(checkIn.token_expires_at)) {
      return NextResponse.json({error: "This document link is invalid or expired."}, {status: 404});
    }
    const key = `check-ins/${checkIn.id}/${crypto.randomUUID()}-${safeString(file.name)}`;
    const storageUrl = await uploadPrivateDocument(file, key);
    devStore.documents.unshift({
      id: crypto.randomUUID(),
      check_in_id: checkIn.id,
      file_name: safeString(file.name),
      file_type: file.type,
      storage_url: storageUrl,
      document_category: category.data,
      uploaded_at: new Date().toISOString()
    });
    const documents = devStore.documents.filter((document) => document.check_in_id === checkIn.id);
    return NextResponse.json({
      checkInId: checkIn.id,
      driverName: checkIn.driver_name,
      carrierName: checkIn.carrier_name,
      loadNumber: checkIn.load_number,
      expiresAt: checkIn.token_expires_at,
      warehouseView: false,
      documents: await addPrivateUrls(documents, false)
    });
  }

  const checkInResult = await query<CheckInTokenRow>(
    "select id, driver_name, carrier_name, load_number, token_expires_at from check_ins where document_token = $1 limit 1",
    [token]
  );
  const checkIn = checkInResult.rows[0];
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    return NextResponse.json({error: "This document link is invalid or expired."}, {status: 404});
  }

  const key = `check-ins/${checkIn.id}/${crypto.randomUUID()}-${safeString(file.name)}`;
  const storageUrl = await uploadPrivateDocument(file, key);
  await query(
    "insert into documents (check_in_id, file_name, file_type, storage_url, document_category) values ($1, $2, $3, $4, $5)",
    [checkIn.id, safeString(file.name), file.type, storageUrl, category.data]
  );

  return GET(request, {params: Promise.resolve({token})});
}