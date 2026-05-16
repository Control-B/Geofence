import {createTokenExpiry} from "@/lib/tokens";

export type DevDocument = {
  id: string;
  check_in_id: string;
  file_name: string;
  file_type: string;
  storage_url: string;
  document_category: string;
  uploaded_at: string;
};

export type DevSignature = {
  id: string;
  check_in_id: string;
  signer_name: string;
  signer_role: string;
  typed_signature: string;
  drawn_signature_url: string | null;
  consent_checked: boolean;
  ip_address: string;
  user_agent: string;
  signed_at: string;
};

export type DevCheckIn = {
  id: string;
  warehouse_id: string;
  driver_name: string;
  driver_phone: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  load_number: string;
  type: "arrival" | "departure";
  notes: string;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  geofence_status: string;
  sms_message: string;
  document_token: string;
  signing_token: string;
  token_expires_at: string;
  created_at: string;
  verified_at: string | null;
};

const globalStore = globalThis as typeof globalThis & {
  gateVerifyStore?: {
    checkIns: DevCheckIn[];
    documents: DevDocument[];
    signatures: DevSignature[];
  };
};

export const devStore =
  globalStore.gateVerifyStore ||
  (globalStore.gateVerifyStore = {
    checkIns: [],
    documents: [],
    signatures: []
  });

export function addDevCheckIn(checkIn: Omit<DevCheckIn, "token_expires_at" | "created_at"> & {created_at?: string; token_expires_at?: string}) {
  const record: DevCheckIn = {
    ...checkIn,
    created_at: checkIn.created_at || new Date().toISOString(),
    token_expires_at: checkIn.token_expires_at || createTokenExpiry().toISOString()
  };
  devStore.checkIns.unshift(record);
  return record;
}