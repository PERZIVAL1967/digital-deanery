// POST /theme: switches the day/night cookie. Works as a plain form (no JS) and from ThemeButton (fetch).
import { cookieSecure } from "../../lib/guard";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const asked = form?.get("to");
  const current = request.headers.get("cookie")?.match(/(?:^|;\s*)theme=(night|day)/)?.[1] ?? "day";
  const next = asked === "night" || asked === "day" ? asked : current === "night" ? "day" : "night";

  // go back to the page the form was on (same origin only)
  let back = "/";
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const from = new URL(referer);
      if (from.host === new URL(request.url).host || from.host === request.headers.get("host")) back = from.pathname + from.search;
    } catch { /* keep "/" */ }
  }
  if (!back.startsWith("/") || back.startsWith("//") || back.startsWith("/\\")) back = "/";
  const headers = new Headers({ Location: back, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${cookieSecure() ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers });
}
