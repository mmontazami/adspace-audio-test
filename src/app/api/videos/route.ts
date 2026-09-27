import { NextResponse } from "next/server";
import { listVideos } from "@/lib/videos";

export const runtime = "nodejs";

export async function GET() {
  try {
    const videos = await listVideos();
    return NextResponse.json({ videos });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to list videos" }, { status: 500 });
  }
}
