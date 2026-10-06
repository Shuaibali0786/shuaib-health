import { SESSION_COOKIE } from "@/admin/lib/cookie";
import { SessionIssuedSchema } from "@/admin/lib/schemas";
import { callAdminBackend } from "@/admin/lib/server";
import { cookieValue, isSameOrigin, sessionCookie } from "@/admin/lib/sessionRoute";
import { clientIpFrom } from "@/lib/booking/backend";

// "View Demo Dashboard" (contracts/website-admin.md §3): a plain HTML form POST from the public pages,
// so the public site ships no staff code. The backend returns the demo token to this server only; it goes
// into the __Host- cookie and the visitor lands on the Overview. A refusal comes back to the sign-in page
// with a calm message, never a raw error.

export const dynamic = "force-dynamic";

/**
 * The staff pages send `Referrer-Policy: no-referrer`, so a form posted from them carries `Origin: null`.
 * That is accepted only when the browser also says the request is same-origin (`Sec-Fetch-Site`, which a
 * page cannot forge); anything else must name this site.
 */
function isOwnRequest(request: Request): boolean {
  if (request.headers.get("origin") === "null") return request.headers.get("sec-fetch-site") === "same-origin";
  return isSameOrigin(request);
}

function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store", ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  if (!isOwnRequest(request)) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });

  let result;
  try {
    result = await callAdminBackend({
      method: "POST",
      path: "/admin/demo/start",
      template: "/admin/demo/start",
      // A session the browser still holds is passed on so the backend ends it first.
      sessionToken: cookieValue(request, SESSION_COOKIE),
      clientIp: clientIpFrom(request.headers),
      requestId: crypto.randomUUID(),
      timeoutMs: 10000,
    });
  } catch {
    return redirect("/admin/login?demo=unavailable");
  }

  if (result.status === 429) return redirect("/admin/login?demo=busy");
  if (result.status !== 200) return redirect("/admin/login?demo=unavailable");
  const issued = SessionIssuedSchema.safeParse(result.body);
  if (!issued.success || issued.data.viewer.kind !== "demo") return redirect("/admin/login?demo=unavailable");
  return redirect("/admin", { "set-cookie": sessionCookie(issued.data.token) });
}
