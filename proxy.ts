import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";

// Every API call needs a signed-in, active user; the login window in the UI is only the front of this check.
// /api/auth/* stays open (login, logout, owner setup). Admin routes also check the owner role themselves.
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (!sessionUser(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Войдите в систему", auth: "required" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
