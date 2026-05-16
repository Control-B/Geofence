import {appUrl} from "./config";

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
  return [
    "Warehouse check-in verified.",
    `Driver: ${payload.driverName}`,
    `Carrier: ${payload.carrierName}`,
    `Truck: ${payload.truckNumber}`,
    `Trailer: ${payload.trailerNumber}`,
    `Load: ${payload.loadNumber}`,
    `Status: ${status}`,
    `Verified at: ${payload.verifiedAt}`,
    `Documents: ${appUrl}/docs/${payload.documentToken}`,
    `Signature: ${appUrl}/sign/${payload.signingToken}`
  ].join("\n");
}

export function buildSmsLink(warehousePhone: string, smsMessage: string) {
  return `sms:${warehousePhone}?body=${encodeURIComponent(smsMessage)}`;
}
