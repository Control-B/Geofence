import {clerkMiddleware, createRouteMatcher} from "@clerk/nextjs/server";
import {NextResponse, type NextFetchEvent, type NextRequest} from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/dashboard(.*)"]);

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.DEV_AUTH_BYPASS === "true") return NextResponse.next();
  return clerkProxy(request, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};