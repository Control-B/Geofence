import {GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

export const allowedFileTypes = ["application/pdf", "image/jpeg", "image/png"];
export const maxFileSizeBytes = 10 * 1024 * 1024;

function getSpacesClient() {
  const endpoint = process.env.DO_SPACES_ENDPOINT;
  const region = process.env.DO_SPACES_REGION;
  const accessKeyId = process.env.DO_SPACES_KEY;
  const secretAccessKey = process.env.DO_SPACES_SECRET;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !process.env.DO_SPACES_BUCKET) {
    return null;
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {accessKeyId, secretAccessKey}
  });
}

export function validateUpload(file: File) {
  if (!allowedFileTypes.includes(file.type)) {
    return "Only PDF, JPG, and PNG files are allowed.";
  }

  if (file.size > maxFileSizeBytes) {
    return "Files must be 10MB or smaller.";
  }

  return null;
}

export async function uploadPrivateDocument(file: File, key: string) {
  const client = getSpacesClient();
  if (!client || !process.env.DO_SPACES_BUCKET) {
    return `dev-private://${key}`;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: "private"
    })
  );

  return key;
}

export async function createPrivateReadUrl(storageKey: string) {
  const client = getSpacesClient();
  if (!client || !process.env.DO_SPACES_BUCKET || storageKey.startsWith("dev-private://")) {
    return null;
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({Bucket: process.env.DO_SPACES_BUCKET, Key: storageKey}),
    {expiresIn: 60 * 10}
  );
}