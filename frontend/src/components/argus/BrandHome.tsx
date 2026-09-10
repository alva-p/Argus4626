"use client";

export function BrandHome({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <button
      type="button"
      className="brand"
      onClick={() => window.dispatchEvent(new Event("argus:replay-intro"))}
      title="Argus4626 — back to the intro"
    >
      {collapsed ? (
        <img className="brand-icon" src="/brand/argus4626-icon.png" alt="Argus4626" />
      ) : (
        <>
          <img className="brand-logo" src="/brand/argus4626-horizontal.png" alt="Argus4626" />
          <p className="brand-tagline">See the vault before the risk sees you.</p>
        </>
      )}
    </button>
  );
}
