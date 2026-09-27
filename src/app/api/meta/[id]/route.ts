import { NextResponse } from "next/server";
import { getVideoMeta } from "@/lib/videos";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const meta = await getVideoMeta(id);

  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(meta);
}
