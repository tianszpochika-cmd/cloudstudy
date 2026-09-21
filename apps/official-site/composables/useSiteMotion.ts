import {
  createAdaptivePerformanceEngine,
  type AdaptivePerformanceEngine,
  type PerformanceLevel,
} from "@englishflow/performance";
export function useSiteMotion() {
  const reduced = useState("official:reduced", () => false);
  const level = useState<PerformanceLevel>("official:quality", () => "High");
  return {
    reduced,
    level,
    allowsDepth: computed(
      () => level.value !== "Performance" && !reduced.value,
    ),
  };
}
export function installSiteMotion() {
  const state = useSiteMotion();
  let engine: AdaptivePerformanceEngine | undefined,
    media: MediaQueryList | undefined,
    unsubscribe: (() => void) | undefined;
  function sync() {
    state.reduced.value = media?.matches ?? false;
    document.documentElement.dataset.quality = state.level.value;
    document.documentElement.dataset.motion =
      !state.reduced.value && state.level.value !== "Performance"
        ? "on"
        : "off";
  }
  function changeReduced() {
    engine?.setLevel(media?.matches ? "Performance" : "High");
    engine?.setMotionDisabled(media?.matches ?? false, "auto");
    sync();
  }
  onMounted(() => {
    const storage = {
      getItem(key: string) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem(key: string, value: string) {
        try {
          localStorage.setItem(key, value);
        } catch {}
      },
    };
    media = matchMedia("(prefers-reduced-motion: reduce)");
    engine = createAdaptivePerformanceEngine({
      storage,
      storageKey: "yx.official.performance",
      reducedMotion: media.matches,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: Reflect.get(navigator, "deviceMemory"),
    });
    engine.restore();
    // The public toggle was removed. Ignore its retired pause preference,
    // while continuing to respect system accessibility and quality settings.
    engine.setMotionDisabled(media.matches, "auto");
    state.level.value = engine.level;
    unsubscribe = engine.subscribe((next) => {
      state.level.value = next.level;
      sync();
    });
    media.addEventListener("change", changeReduced);
    sync();
  });
  watch(state.level, (value) => {
    if (engine?.level !== value) engine?.setLevel(value);
    if (import.meta.client) sync();
  });
  onBeforeUnmount(() => {
    media?.removeEventListener("change", changeReduced);
    unsubscribe?.();
    engine?.dispose();
  });
  return state;
}
