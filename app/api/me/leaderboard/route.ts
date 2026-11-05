import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { monthBoard } from "@/lib/leaderboard";

// The signed-in administrator's clinic: its best three administrators this month and their own place (lib/leaderboard.ts).
// The owner has no clinic and gets { board: null }.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  return NextResponse.json({ board: user.clinic ? monthBoard(user.clinic.id, user.id) : null });
}
