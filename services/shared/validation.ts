import {z} from "zod";

export const phoneSchema = z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Use a valid phone number with country code when possible.");

export const checkInSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  warehouseName: z.string().trim().min(2).max(120),
  warehousePhone: phoneSchema,
  warehouseLatitude: z.coerce.number().min(-90).max(90),
  warehouseLongitude: z.coerce.number().min(-180).max(180),
  warehouseRadiusMeters: z.coerce.number().min(25).max(5000).default(150),
  driverName: z.string().trim().min(2).max(120),
  driverPhone: phoneSchema,
  carrierName: z.string().trim().min(2).max(120),
  truckNumber: z.string().trim().min(1).max(60),
  trailerNumber: z.string().trim().min(1).max(60),
  loadNumber: z.string().trim().min(1).max(90),
  type: z.enum(["arrival", "departure"]),
  notes: z.string().trim().max(1000).optional().default(""),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  permissionDenied: z.boolean().optional().default(false)
});

export const documentCategorySchema = z.enum(["BOL", "POD", "Rate confirmation", "Lumper receipt", "ID / license", "Other"]);

export const signatureSchema = z.object({
  signerName: z.string().trim().min(2).max(120),
  signerRole: z.enum(["Driver", "Warehouse receiver", "Dispatcher", "Other"]),
  typedSignature: z.string().trim().min(2).max(120),
  drawnSignatureDataUrl: z.string().max(500000).nullable().optional(),
  consentChecked: z.literal(true)
});

export function safeString(value: unknown) {
  return String(value ?? "").replace(/[<>]/g, "").trim();
}
