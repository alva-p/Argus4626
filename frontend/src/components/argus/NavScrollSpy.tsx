"use client";

import { useEffect } from "react";

const SECTION_IDS = ["overview", "vaults", "incidents", "pipeline"];

export function NavScrollSpy() {
  useEffect(() => {
    const links = new Map(
      SECTION_IDS.map((id) => [id, document.querySelector<HTMLAnchorElement>(`.nav a[href="#${id}"]`)])
    );
    const sections = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const setActive = (id: string) => {
      links.forEach((link, linkId) => link?.classList.toggle("active", linkId === id));
    };
    setActive(SECTION_IDS[0]);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
