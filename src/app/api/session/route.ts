import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Retrieve tutoring sessions
  return NextResponse.json({ message: "Session endpoint not yet implemented" }, { status: 501 });
}

export async function POST() {
  // TODO: Create a new tutoring session
  return NextResponse.json({ message: "Session creation not yet implemented" }, { status: 501 });
}
