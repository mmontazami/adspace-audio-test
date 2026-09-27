import { NextResponse } from "next/server";
import { createId, saveVideo } from "@/lib/videos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "File must be a video" }, { status: 400 });
    }

    const id = createId();
    const meta = await saveVideo(id, file);

    return NextResponse.json({
      id: meta.id,
      url: `/${meta.id}`,
      absoluteHint: "Open /{id} on this host to autoplay with sound",
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
