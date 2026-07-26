import { useEffect } from "react";

const EMBED_SCRIPT_ID = "tiktok-embed-script";

/** TikTok's official oEmbed blockquote + script — same shape as embed.tiktok.com's own snippet. */
export function TikTokEmbed({ videoId, videoUrl }: { videoId: string; videoUrl: string }) {
  useEffect(() => {
    if (document.getElementById(EMBED_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = EMBED_SCRIPT_ID;
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="my-4 flex justify-center">
      <blockquote
        className="tiktok-embed"
        cite={videoUrl}
        data-video-id={videoId}
        style={{ maxWidth: "325px", minWidth: "325px" }}
      >
        <section>
          <a target="_blank" rel="noopener noreferrer" href={videoUrl}>
            Watch on TikTok
          </a>
        </section>
      </blockquote>
    </div>
  );
}
