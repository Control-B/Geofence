import crypto from "crypto";
import {tokenTtlHours} from "@/lib/config";

export function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createTokenExpiry(hours = tokenTtlHours) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
}

export function isExpired(expiresAt?: string | Date | null) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}