import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { userProgress } from "@/lib/trainings";

// The signed-in trainee's own summary; detailed statistics are the owner's (admin panel).
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  return NextResponse.json(userProgress(user.id));
}
