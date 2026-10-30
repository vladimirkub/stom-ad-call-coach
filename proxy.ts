import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { FEATURES, FEATURE_APIS, OFF_MESSAGE } from "@/lib/features";

// Every API call needs a signed-in, active user; the login window in the UI is only the front of this check.
// /api/auth/* stays open (login, logout, owner setup). Admin routes also check the owner role themselves.
// APIs of switched-off sections (lib/features.ts) are refused for everyone.
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/auth/")) return NextResponse.next();
  if (!sessionUser(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Войдите в систему", auth: "required" }, { status: 401 });
  }
  if (FEATURE_APIS.some((f) => path.startsWith(f.prefix) && !FEATURES[f.feature])) {
    return NextResponse.json({ error: OFF_MESSAGE }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
