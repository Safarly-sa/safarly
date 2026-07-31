/**
 * The control that produces the ranking signal.
 *
 * Optimistic: the count and fill flip immediately and roll back if the request
 * fails. A like is a low-stakes, high-frequency action — waiting on a round
 * trip to a free-tier API that can cold-start for tens of seconds would make
 * the feed feel broken.
 *
 * The server refuses a like on your own story with a 403, so that error is
 * surfaced rather than swallowed: silently reverting the heart with no
 * explanation reads as a bug.
 */
import { useState } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { setStoryLike } from "@/lib/posts-api";
import { cn } from "@/lib/utils";

export function LikeButton({
  postId,
  likeCount,
  likedByMe,
  onChange,
}: {
  postId: string;
  likeCount: number;
  likedByMe: boolean;
  onChange?: (likeCount: number, likedByMe: boolean) => void;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(likeCount);
  const [liked, setLiked] = useState(likedByMe);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(event: React.MouseEvent) {
    // Like controls sit inside story cards that are themselves links.
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));

    setLiked(nextLiked);
    setCount(nextCount);
    setPending(true);
    setError(null);

    const result = await setStoryLike(postId, nextLiked);
    setPending(false);

    if (result.ok) {
      // Trust the server's numbers over the optimistic guess — they diverge
      // whenever another reader liked the same story in between.
      setCount(result.likeCount);
      setLiked(result.likedByMe);
      onChange?.(result.likeCount, result.likedByMe);
      return;
    }

    setLiked(liked);
    setCount(count);
    setError(result.error);
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? t("stories.unlike") : t("stories.like")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
          liked
            ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
          pending && "opacity-60",
        )}
      >
        <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} aria-hidden />
        {count}
      </button>
      {error && <span className="text-[10px] text-destructive max-w-[14rem]">{error}</span>}
    </span>
  );
}
