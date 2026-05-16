import {appUrl} from "@/lib/config";
import {normalizePhoneForSms} from "@/lib/validation";

type SmsPayload = {
  warehousePhone: string;
  driverName: string;
  carrierName: string;
  truckNumber: string;
  trailerNumber: string;
  loadNumber: string;
  type: "arrival" | "departure";
  verifiedAt: string;
  documentToken: string;
  signingToken: string;
};

export function buildSmsMessage(payload: SmsPayload) {
  const status = payload.type === "arrival" ? "Arrived" : "Departed";
  return `Warehouse check-in verified.\nDriver: ${payload.driverName}\nCarrier: ${payload.carrierName}\nTruck: ${payload.truckNumber}\nTrailer: ${payload.trailerNumber}\nLoad: ${payload.loadNumber}\nStatus: ${status}\nVerified at: ${payload.verifiedAt}\nDocuments: ${appUrl}/docs/${payload.documentToken}\nSignature: ${appUrl}/sign/${payload.signingToken}`;
}

export function buildSmsLink(warehousePhone: string, message: string) {
  return `sms:${normalizePhoneForSms(warehousePhone)}?body=${encodeURIComponent(message)}`;
}