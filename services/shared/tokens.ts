import crypto from "node:crypto";
import {tokenTtlHours} from "./config";

export function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + tokenTtlHours);
  return expiresAt;
}

export function isExpired(value: string | Date) {
  return new Date(value).getTime() < Date.now();
}
