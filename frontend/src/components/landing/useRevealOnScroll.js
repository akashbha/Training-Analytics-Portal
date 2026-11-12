import { useEffect, useRef, useState } from "react";

/**
 * Lightweight IntersectionObserver scroll-reveal hook with safe jsdom/reduced-motion fallbacks.
 */
export function useRevealOnScroll(options = {}) {
  const { threshold = 0.04, rootMargin = "0px 0px 40px 0px" } = options;
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === "undefined" || !ref.current) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible, threshold, rootMargin]);

  return [ref, visible];
}

