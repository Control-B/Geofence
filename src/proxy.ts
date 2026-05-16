import {clerkMiddleware, createRouteMatcher} from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const devAuthBypass = process.env.DEV_AUTH_BYPASS === "true";
  if (isProtectedRoute(req) && !devAuthBypass) await auth.protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};