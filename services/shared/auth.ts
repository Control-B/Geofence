import {verifyToken} from "@clerk/backend";
import type {RequestHandler} from "express";

export const requireWarehouseAuth: RequestHandler = async (request, response, next) => {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    next();
    return;
  }

  if (!process.env.CLERK_SECRET_KEY) {
    next();
    return;
  }

  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    response.status(401).json({error: "Unauthorized"});
    return;
  }

  try {
    await verifyToken(token, {secretKey: process.env.CLERK_SECRET_KEY});
    next();
  } catch {
    response.status(401).json({error: "Unauthorized"});
  }
};
