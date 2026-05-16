import {z} from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9][0-9().\-\s]{7,20}$/, "Enter a valid phone number");

const textField = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(1000).optional().default("");

export const checkInSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  warehouseName: textField,
  warehousePhone: phoneSchema,
  warehouseLatitude: z.coerce.number().min(-90).max(90),
  warehouseLongitude: z.coerce.number().min(-180).max(180),
  warehouseRadiusMeters: z.coerce.number().int().min(25).max(5000).default(150),
  driverName: textField,
  driverPhone: phoneSchema,
  carrierName: textField,
  truckNumber: textField,
  trailerNumber: textField,
  loadNumber: textField,
  type: z.enum(["arrival", "departure"]),
  notes: optionalText,
  latitude: z.coerce.number().min(-90).max(90).nullable(),
  longitude: z.coerce.number().min(-180).max(180).nullable(),
  permissionDenied: z.boolean().default(false)
});

export const signatureSchema = z.object({
  signerName: textField,
  signerRole: z.enum(["Driver", "Warehouse receiver", "Dispatcher", "Other"]),
  typedSignature: textField,
  drawnSignatureDataUrl: z.string().startsWith("data:image/png;base64,").optional().or(z.literal("")),
  consentChecked: z.literal(true)
});

export const documentCategories = [
  "BOL",
  "POD",
  "Rate confirmation",
  "Lumper receipt",
  "ID / license",
  "Other"
] as const;

export const documentCategorySchema = z.enum(documentCategories);

export function normalizePhoneForSms(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export function safeString(value: unknown) {
  return String(value ?? "").replace(/[<>]/g, "").trim();
}