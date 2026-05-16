import {S3Client, PutObjectCommand, GetObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

function spacesClient() {
  if (!process.env.DO_SPACES_ENDPOINT || !process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) return null;
  return new S3Client({
    region: process.env.DO_SPACES_REGION || "us-east-1",
    endpoint: process.env.DO_SPACES_ENDPOINT,
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET
    }
  });
}

export function validateUpload(file: Express.Multer.File) {
  if (!allowedTypes.has(file.mimetype)) return "Only PDF, JPG, and PNG files are allowed.";
  if (file.size > maxFileBytes) return "File is too large. Maximum size is 10MB.";
  return null;
}

export async function uploadPrivateDocument(file: Express.Multer.File, key: string) {
  const client = spacesClient();
  const bucket = process.env.DO_SPACES_BUCKET;
  if (!client || !bucket) return `local-private://${key}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "private"
  }));

  return `s3://${bucket}/${key}`;
}

export async function createPrivateReadUrl(storageUrl: string) {
  if (!storageUrl.startsWith("s3://")) return storageUrl;
  const client = spacesClient();
  if (!client) return null;
  const [, bucket, ...keyParts] = storageUrl.replace("s3://", "").split("/");
  return getSignedUrl(client, new GetObjectCommand({Bucket: bucket, Key: keyParts.join("/")}), {expiresIn: 900});
}
