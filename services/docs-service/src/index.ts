import "dotenv/config";
import multer from "multer";
import {query} from "../../shared/db";
import {createPrivateReadUrl, uploadPrivateDocument, validateUpload} from "../../shared/documents";
import {createServiceApp, asyncHandler, errorHandler} from "../../shared/http";
import {isExpired} from "../../shared/tokens";
import {documentCategorySchema, safeString} from "../../shared/validation";

const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024)}});
const app = createServiceApp("docs-service");

type DocumentRow = {
  id: string;
  check_in_id: string;
  file_name: string;
  file_type: string;
  storage_url: string;
  document_category: string;
  uploaded_at: string;
};

async function findCheckInByToken(token: string) {
  const result = await query(
    "select id, driver_name, carrier_name, load_number, token_expires_at from check_ins where document_token = $1 limit 1",
    [token]
  );
  return result.rows[0];
}

async function responseForToken(token: string, warehouseView: boolean) {
  const checkIn = await findCheckInByToken(token);
  if (!checkIn || isExpired(checkIn.token_expires_at)) return null;
  const documentsResult = await query<DocumentRow>("select * from documents where check_in_id = $1 order by uploaded_at desc", [checkIn.id]);
  const documents = await Promise.all(documentsResult.rows.map(async ({storage_url, ...document}) => ({
    ...document,
    ...(warehouseView ? {private_read_url: await createPrivateReadUrl(storage_url)} : {})
  })));

  return {
    checkInId: checkIn.id,
    driverName: checkIn.driver_name,
    carrierName: checkIn.carrier_name,
    loadNumber: checkIn.load_number,
    expiresAt: checkIn.token_expires_at,
    warehouseView,
    documents
  };
}

app.get("/documents/:token", asyncHandler(async (request, response) => {
  const payload = await responseForToken(request.params.token, request.query.view === "warehouse");
  if (!payload) {
    response.status(404).json({error: "This document link is invalid or expired."});
    return;
  }
  response.json(payload);
}));

app.post("/documents/:token", upload.single("file"), asyncHandler(async (request, response) => {
  const file = request.file;
  const category = documentCategorySchema.safeParse(request.body.category);
  if (!file) {
    response.status(400).json({error: "A file is required."});
    return;
  }
  if (!category.success) {
    response.status(400).json({error: "Choose a valid document category."});
    return;
  }
  const uploadError = validateUpload(file);
  if (uploadError) {
    response.status(400).json({error: uploadError});
    return;
  }

  const checkIn = await findCheckInByToken(request.params.token);
  if (!checkIn || isExpired(checkIn.token_expires_at)) {
    response.status(404).json({error: "This document link is invalid or expired."});
    return;
  }

  const key = `check-ins/${checkIn.id}/${crypto.randomUUID()}-${safeString(file.originalname)}`;
  const storageUrl = await uploadPrivateDocument(file, key);
  await query(
    "insert into documents (check_in_id, file_name, file_type, storage_url, document_category) values ($1, $2, $3, $4, $5)",
    [checkIn.id, safeString(file.originalname), file.mimetype, storageUrl, category.data]
  );

  response.json(await responseForToken(request.params.token, false));
}));

app.use(errorHandler);

const port = Number(process.env.PORT || 4003);
app.listen(port, () => console.log(`docs-service listening on ${port}`));
