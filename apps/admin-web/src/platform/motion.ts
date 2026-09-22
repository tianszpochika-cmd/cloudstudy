import { createAdaptivePerformanceEngine } from "@englishflow/performance";
const media = matchMedia("(prefers-reduced-motion: reduce)");
export const adminPerformance = createAdaptivePerformanceEngine({
  storageKey: "yx.admin.performance",
  reducedMotion: media.matches,
});
adminPerformance.restore();
function sync() {
  document.documentElement.dataset.quality = adminPerformance.level;
  document.documentElement.dataset.motion =
    media.matches ||
    adminPerformance.state.motionDisabled ||
    adminPerformance.level === "Performance"
      ? "off"
      : "on";
}
const stop = adminPerformance.subscribe(sync);
const change = () => {
  adminPerformance.setMotionDisabled(media.matches, "auto");
  sync();
};
media.addEventListener("change", change);
sync();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stop();
    media.removeEventListener("change", change);
    adminPerformance.dispose();
  });
