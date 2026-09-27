import { NextResponse } from "next/server";
import { blobDiagnostics } from "@/lib/videos";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(blobDiagnostics());
}
