import cors from "cors";
import express, {type ErrorRequestHandler, type RequestHandler} from "express";
import helmet from "helmet";
import morgan from "morgan";

export function createServiceApp(serviceName: string) {
  const app = express();
  app.use(helmet());
  app.use(cors({origin: process.env.CORS_ORIGIN?.split(",") || true, credentials: true}));
  app.use(morgan("tiny"));
  app.use(express.json({limit: "1mb"}));
  app.get("/health", (_request, response) => response.json({service: serviceName, ok: true}));
  return app;
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({error: "Internal service error."});
};
