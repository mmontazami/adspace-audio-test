"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VideoMeta = {
  id: string;
  url: string;
  contentType: string;
  createdAt: string;
  filename: string;
};

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [pasteCountdown, setPasteCountdown] = useState<number | null>(null);
  const [pasteTarget, setPasteTarget] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const pasteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setVideos(data.videos ?? []);
    } catch {
      // keep previous list on refresh failure
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadVideos();
    return () => {
      if (pasteTimerRef.current) clearInterval(pasteTimerRef.current);
    };
  }, [loadVideos]);

  const fileLabel = useMemo(() => {
    if (!file) return null;
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return `${file.name} (${mb} MB)`;
  }, [file]);

  const absoluteFor = useCallback(
    (id: string) => `${origin || ""}/${id}`,
    [origin]
  );

  const onPick = useCallback((next: File | null | undefined) => {
    setError(null);
    setShortUrl(null);
    setPasteCountdown(null);
    setPasteTarget(null);
    if (!next) return;
    if (!next.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }
    setFile(next);
  }, []);

  const upload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setShortUrl(null);
    setPasteCountdown(null);
    setPasteTarget(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const absolute = `${window.location.origin}${data.url}`;
      setShortUrl(absolute);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file, loadVideos]);

  const copy = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url);
  }, []);

  const openWithClick = useCallback((url: string) => {
    window.location.assign(`${url}?via=click`);
  }, []);

  const openLikePaste = useCallback(
    async (url: string) => {
      if (pasteCountdown !== null) return;

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard may fail without permission; navigation test still continues.
      }

      let left = 5;
      setPasteTarget(url);
      setPasteCountdown(left);

      if (pasteTimerRef.current) clearInterval(pasteTimerRef.current);
      pasteTimerRef.current = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (pasteTimerRef.current) clearInterval(pasteTimerRef.current);
          pasteTimerRef.current = null;
          window.location.assign(`${url}?via=paste`);
          return;
        }
        setPasteCountdown(left);
      }, 1000);
    },
    [pasteCountdown]
  );

  return (
    <main>
      <div className="badge">AUTOPLAY + SOUND TEST</div>
      <h1>Upload a video, get a short link</h1>
      <p className="lead">
        Upload a video, then compare the two open modes: same-tab click (gesture)
        vs delayed open (like copy-paste, no gesture).
      </p>

      <section className="panel">
        <label
          className={`drop${dragOver ? " active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onPick(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <strong>{fileLabel || "Drop a video here or click to choose"}</strong>
          <span>mp4 / webm / mov — keep under 4.5MB for Vercel testing</span>
        </label>

        <div className="actions">
          <button
            className="primary"
            type="button"
            disabled={!file || uploading}
            onClick={upload}
          >
            {uploading ? "Uploading..." : "Upload & create link"}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {shortUrl ? (
          <div className="result">
            <p className="note">Short link ready — only the id is at the end of the URL:</p>
            <div className="link-box">
              <input readOnly value={shortUrl} onFocus={(e) => e.target.select()} />
              <button className="ghost" type="button" onClick={() => copy(shortUrl)}>
                Copy
              </button>
            </div>

            <div className="test-grid">
              <button
                className="primary test-btn"
                type="button"
                onClick={() => openWithClick(shortUrl)}
                disabled={pasteCountdown !== null}
              >
                Open in this tab (with click)
              </button>
              <button
                className="ghost test-btn"
                type="button"
                onClick={() => openLikePaste(shortUrl)}
                disabled={pasteCountdown !== null}
              >
                {pasteCountdown !== null && pasteTarget === shortUrl
                  ? `Opening like paste in ${pasteCountdown}s...`
                  : "Open like copy-paste (no gesture)"}
              </button>
            </div>

            <p className="note">
              <strong>With click:</strong> navigates immediately in this tab — browser
              may allow sound.
              <br />
              <strong>Like copy-paste:</strong> copies the link, waits 5s so the click
              gesture expires, then opens — usually muted-only / blocked sound.
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel list-panel">
        <div className="list-header">
          <h2>Uploaded videos</h2>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setListLoading(true);
              void loadVideos();
            }}
          >
            Refresh
          </button>
        </div>

        {listLoading ? (
          <p className="note">Loading...</p>
        ) : videos.length === 0 ? (
          <p className="note">No uploads yet.</p>
        ) : (
          <ul className="video-list">
            {videos.map((video) => {
              const link = absoluteFor(video.id);
              const when = new Date(video.createdAt).toLocaleString();
              return (
                <li key={video.id} className="video-item">
                  <div className="video-item-main">
                    <div className="video-item-title">
                      <code>/{video.id}</code>
                      <span>{video.filename}</span>
                    </div>
                    <div className="video-item-meta">{when}</div>
                    <div className="link-box">
                      <input
                        readOnly
                        value={link || `/${video.id}`}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => copy(link || `/${video.id}`)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="test-grid">
                    <button
                      className="primary test-btn"
                      type="button"
                      onClick={() => openWithClick(link || `/${video.id}`)}
                      disabled={pasteCountdown !== null}
                    >
                      Open with click
                    </button>
                    <button
                      className="ghost test-btn"
                      type="button"
                      onClick={() => openLikePaste(link || `/${video.id}`)}
                      disabled={pasteCountdown !== null}
                    >
                      {pasteCountdown !== null &&
                      pasteTarget === (link || `/${video.id}`)
                        ? `Paste-like in ${pasteCountdown}s...`
                        : "Open like paste"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
