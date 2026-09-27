import { NextResponse } from "next/server";
import { getLocalVideo } from "@/lib/videos";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const video = await getLocalVideo(id);

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(video.data), {
    headers: {
      "Content-Type": video.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}
