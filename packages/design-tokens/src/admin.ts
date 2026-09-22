import { officialSitePalette as p } from "./official-site";
import type { ResolvedTheme } from "./index";

/** Admin semantic roles reuse the approved website palette without changing other apps. */
export function adminThemeVariables(
  theme: ResolvedTheme,
): Record<string, string> {
  const dark = theme !== "light";
  const contrast = theme === "high-contrast";
  return {
    "--admin-brand": p["--yx-palette-006"],
    "--admin-brand-hover": p["--yx-palette-041"],
    "--admin-on-brand": p["--yx-palette-002"],
    "--admin-accent": p[dark ? "--yx-palette-025" : "--yx-palette-006"],
    "--admin-brand-soft": p[dark ? "--yx-palette-026" : "--yx-palette-007"],
    "--admin-canvas":
      p[
        contrast
          ? "--yx-palette-149"
          : dark
            ? "--yx-palette-020"
            : "--yx-palette-001"
      ],
    "--admin-surface":
      p[
        contrast
          ? "--yx-palette-149"
          : dark
            ? "--yx-palette-021"
            : "--yx-palette-002"
      ],
    "--admin-raised": p[dark ? "--yx-palette-027" : "--yx-palette-002"],
    "--admin-ink":
      p[
        contrast
          ? "--yx-palette-150"
          : dark
            ? "--yx-palette-022"
            : "--yx-palette-003"
      ],
    "--admin-muted":
      p[
        contrast
          ? "--yx-palette-151"
          : dark
            ? "--yx-palette-023"
            : "--yx-palette-004"
      ],
    "--admin-line":
      p[
        contrast
          ? "--yx-palette-150"
          : dark
            ? "--yx-palette-024"
            : "--yx-palette-005"
      ],
    "--admin-soft": p[dark ? "--yx-palette-027" : "--yx-palette-008"],
    "--admin-sage": p[dark ? "--yx-palette-028" : "--yx-palette-009"],
    "--admin-success": p[dark ? "--yx-palette-029" : "--yx-palette-010"],
    "--admin-apricot": p[dark ? "--yx-palette-030" : "--yx-palette-011"],
    "--admin-warning": p[dark ? "--yx-palette-031" : "--yx-palette-012"],
    "--admin-hero": `linear-gradient(125deg,${p["--yx-palette-015"]},${p["--yx-palette-016"]} 65%,${p["--yx-palette-017"]})`,
    "--admin-hero-muted": p["--yx-palette-056"],
    "--admin-radius-card": "24px",
    "--admin-radius-control": "12px",
    "--admin-motion": "180ms",
  };
}
