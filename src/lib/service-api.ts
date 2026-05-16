export const checkInServiceUrl = process.env.NEXT_PUBLIC_CHECKIN_API_URL || "";
export const dashboardServiceUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "";
export const docsServiceUrl = process.env.NEXT_PUBLIC_DOCS_API_URL || "";
export const signingServiceUrl = process.env.NEXT_PUBLIC_SIGNING_API_URL || "";

export function serviceUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
