"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const IMG_W = 1672;
const IMG_H = 941;
// Must match .argus-intro-img's object-position vertical value in globals.css —
// the top eye sits close to the image's top edge, so cover-mode crops are
// biased upward (mostly trimming the bottom) instead of centered.
const IMG_POSITION_Y = 0.08;

const HALO = { x: 65.5, y: 23, size: 36 };
const CHEST = { x: 66.5, y: 68.5, size: 25 };
const EYES = [
  { x: 65.7, y: 4.8 },
  { x: 54.6, y: 10.6 },
  { x: 76.8, y: 10.6 },
  { x: 49.0, y: 26.0 },
  { x: 82.2, y: 26.0 },
  { x: 50.8, y: 41.4 },
  { x: 79.2, y: 41.4 },
];

function scrollToTarget(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
}

export function ArgusIntro({ targetId }: { targetId: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0, x: 0, y: 0 });
  const [activeEye, setActiveEye] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [entered, setEntered] = useState(false);
  const enteredRef = useRef(false);

  // Track the image's rendered "cover" box so the overlay rings stay pinned
  // to the art (background is object-fit:cover, so the crop shifts with viewport size).
  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    const update = () => {
      const { width: cw, height: ch } = el.getBoundingClientRect();
      const scale = Math.max(cw / IMG_W, ch / IMG_H);
      const w = IMG_W * scale;
      const h = IMG_H * scale;
      setFrame({ w, h, x: (cw - w) / 2, y: (ch - h) * IMG_POSITION_Y });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Intentional re-entry only (sidebar brand click) — organic scroll-up never
  // reopens it once retired, that's the point of the one-way lock above.
  useEffect(() => {
    const onReplay = () => {
      enteredRef.current = false;
      setEntered(false);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    };
    window.addEventListener("argus:replay-intro", onReplay);
    return () => window.removeEventListener("argus:replay-intro", onReplay);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setActiveEye((n) => (n + 1 + Math.floor(Math.random() * (EYES.length - 1))) % EYES.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setParallax({
          x: (e.clientX / window.innerWidth - 0.5) * 10,
          y: (e.clientY / window.innerHeight - 0.5) * 10,
        });
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const progress = Math.min(1, window.scrollY / window.innerHeight);
        sectionRef.current?.style.setProperty("--scroll", String(progress));
        // Once fully scrolled past (hero already covered/faded), retire it for
        // good so scrolling back up lands on the dashboard, not the intro.
        if (progress >= 1 && !enteredRef.current) {
          enteredRef.current = true;
          setEntered(true);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      className={`argus-intro${entered ? " argus-intro-retired" : ""}`}
      aria-label="ARGUS4626 introduction"
      aria-hidden={entered}
      ref={sectionRef}
    >
      <div className="argus-scroll-layer">
        <div
          className="argus-intro-image"
          ref={imageRef}
          style={{ transform: `translate3d(${parallax.x * -0.3}px, ${parallax.y * -0.3}px, 0)` }}
        >
          <Image
            src="/argus/argus-hero-v3.png"
            alt="Argus Panoptes guarding the ARGUS4626 ERC-4626 observability network"
            fill
            priority
            sizes="100vw"
            className="argus-intro-img"
          />
        </div>

        {frame.w > 0 && (
          <div
            className="argus-rings-frame"
            style={{
              width: frame.w,
              height: frame.h,
              left: frame.x,
              top: frame.y,
              transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
            }}
          >
            <div
              className="argus-ring-group"
              style={{ left: `${HALO.x}%`, top: `${HALO.y}%`, width: `${HALO.size}%` }}
            >
              <svg className="argus-ring argus-ring-outer" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(198,161,91,0.5)" strokeWidth="0.7" strokeDasharray="1 6" />
              </svg>
              <svg className="argus-ring argus-ring-inner" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(96,215,210,0.32)" strokeWidth="0.5" strokeDasharray="0.5 9" />
              </svg>
            </div>

            <div
              className="argus-ring-group argus-core"
              style={{ left: `${CHEST.x}%`, top: `${CHEST.y}%`, width: `${CHEST.size}%` }}
            >
              <svg className="argus-ring argus-core-outer" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(198,161,91,0.55)" strokeWidth="0.8" strokeDasharray="1 5" />
              </svg>
              <svg className="argus-ring argus-core-inner" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(96,215,210,0.4)" strokeWidth="0.6" strokeDasharray="0.5 8" />
              </svg>
              <span className="argus-core-pulse" />
            </div>

            {EYES.map((eye, i) => (
              <span
                key={i}
                className={`argus-eye-glow${activeEye === i ? " active" : ""}`}
                style={{ left: `${eye.x}%`, top: `${eye.y}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="argus-intro-overlay" />
      <button
        type="button"
        className="argus-intro-enter"
        aria-label="Enter ARGUS Control Plane"
        onClick={() => scrollToTarget(targetId)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </section>
  );
}
