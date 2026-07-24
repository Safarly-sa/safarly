/**
 * A reusable interactive hero backdrop: a slow-drifting aurora of brand-colour
 * blobs that also responds to the pointer, giving the hero real depth without a
 * background image to load.
 *
 * Two independent motions compose on each blob:
 *   - ambient drift via a CSS `transform` keyframe (GPU-composited, cheap);
 *   - pointer parallax via the CSS `translate` property, set from two custom
 *     properties updated on pointer move. `translate` and `transform` are
 *     separate CSS properties, so the keyframe and the parallax don't fight.
 *
 * Motion is opt-out, not opt-in: with prefers-reduced-motion the drift is
 * frozen by the app's global rule and the pointer listener is never attached,
 * leaving a still, perfectly usable gradient. Blobs are `pointer-events: none`
 * and `aria-hidden`, so nothing here reaches the keyboard or a screen reader —
 * it is pure decoration behind the real content.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

export function AuroraHero({
  children,
  minHeight = "clamp(460px, 72vh, 720px)",
  className,
}: {
  children: ReactNode;
  minHeight?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      // Coarse pointers (touch) fire this on every tap-drag; the parallax is a
      // fine-pointer nicety, so ignore anything that isn't a mouse/pen.
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el!.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
        const py = (e.clientY - r.top) / r.height - 0.5;
        el!.style.setProperty("--sf-px", px.toFixed(3));
        el!.style.setProperty("--sf-py", py.toFixed(3));
      });
    }
    function reset() {
      el!.style.setProperty("--sf-px", "0");
      el!.style.setProperty("--sf-py", "0");
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(raf);
    };
  }, [prefersReduced]);

  return (
    <section
      ref={ref}
      className={`sf-aurora${className ? ` ${className}` : ""}`}
      style={{ minHeight }}
    >
      <div className="sf-aurora-field" aria-hidden>
        <span className="sf-aurora-blob sf-aurora-blob-1" />
        <span className="sf-aurora-blob sf-aurora-blob-2" />
        <span className="sf-aurora-blob sf-aurora-blob-3" />
        <span className="sf-aurora-grid" />
      </div>
      <div className="sf-aurora-content">{children}</div>
    </section>
  );
}
