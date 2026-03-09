import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Fetch student progress and mastery data
  return NextResponse.json({ message: "Progress endpoint not yet implemented" }, { status: 501 });
}
