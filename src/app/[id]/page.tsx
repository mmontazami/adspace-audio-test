"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Meta = {
  id: string;
  url: string;
  contentType: string;
  filename: string;
};

type PlayStatus = "pending" | "ok" | "blocked" | "error";

function WatchPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const videoRef = useRef<HTMLVideoElement>(null);

  const via = searchParams.get("via");
  const viaLabel = useMemo(() => {
    if (via === "click") return "Opened via: same-tab click (gesture)";
    return "Opened via: direct URL / paste (no gesture)";
  }, [via]);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<PlayStatus>("pending");
  const [detail, setDetail] = useState("Trying unmuted autoplay...");
  const [mutedFallback, setMutedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/meta/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Video not found");
        const data = (await res.json()) as Meta;
        if (!cancelled) setMeta(data);
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setDetail(err instanceof Error ? err.message : "Failed to load");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !meta) return;

    let cancelled = false;

    async function tryPlay() {
      if (!video) return;

      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      video.removeAttribute("muted");

      try {
        await video.play();
        if (cancelled) return;

        if (video.muted || video.volume === 0) {
          setStatus("blocked");
          setDetail(
            "play() succeeded but the video is muted — the browser blocked sound."
          );
          setMutedFallback(true);
          return;
        }

        setStatus("ok");
        setDetail(
          via === "click"
            ? "Unmuted autoplay succeeded — likely because of the click gesture."
            : "Unmuted autoplay succeeded — no click and no extra permission."
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "autoplay blocked";

        try {
          video.muted = true;
          await video.play();
          setMutedFallback(true);
          setStatus("blocked");
          setDetail(
            `Unmuted autoplay was blocked (${message}). Muted autoplay worked.`
          );
        } catch (mutedErr) {
          setStatus("blocked");
          setDetail(
            `Even muted autoplay was blocked: ${
              mutedErr instanceof Error ? mutedErr.message : message
            }`
          );
        }
      }
    }

    const onCanPlay = () => {
      void tryPlay();
    };

    video.addEventListener("canplay", onCanPlay, { once: true });
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [meta, via]);

  const unmuteManually = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      setStatus("ok");
      setDetail(
        "Sound enabled after a user click (this is no longer pure autoplay)."
      );
      setMutedFallback(false);
    } catch (err) {
      setStatus("error");
      setDetail(err instanceof Error ? err.message : "Could not unmute");
    }
  };

  return (
    <div className="watch-shell">
      <header>
        <div>
          <div>Short link: /{id}</div>
          <div style={{ color: "#888", marginTop: 4 }}>{viaLabel}</div>
        </div>
        <div
          className={`status ${
            status === "ok" ? "ok" : status === "pending" ? "pending" : "blocked"
          }`}
        >
          {status === "ok"
            ? "SOUND AUTOPLAY OK"
            : status === "pending"
              ? "TRYING..."
              : status === "error"
                ? "ERROR"
                : "BLOCKED"}
        </div>
      </header>

      <div className="video-wrap">
        {meta ? (
          <video
            ref={videoRef}
            src={meta.url}
            playsInline
            autoPlay
            preload="auto"
            controls
          />
        ) : status === "error" ? (
          <p style={{ color: "#fb7185" }}>{detail}</p>
        ) : (
          <p style={{ color: "#aaa" }}>Loading video...</p>
        )}
      </div>

      <footer>
        <div>{detail}</div>
        {mutedFallback ? (
          <div style={{ marginTop: 8 }}>
            <button className="primary" type="button" onClick={unmuteManually}>
              Enable sound with a click (for comparison)
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="watch-shell">
          <header>Loading...</header>
          <div className="video-wrap">
            <p style={{ color: "#aaa" }}>Loading video...</p>
          </div>
          <footer />
        </div>
      }
    >
      <WatchPageInner />
    </Suspense>
  );
}
