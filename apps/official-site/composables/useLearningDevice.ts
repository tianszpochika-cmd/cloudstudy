/** Same breakpoint as the mobile navigation and the public start page. */
export function useLearningDevice() {
  const mobile = useState("official:mobile-device", () => false);
  let media: MediaQueryList | undefined;
  const sync = () => {
    mobile.value = media?.matches ?? false;
  };
  onMounted(() => {
    media = matchMedia("(max-width:690px)");
    sync();
    media.addEventListener("change", sync);
  });
  onBeforeUnmount(() => media?.removeEventListener("change", sync));
  return mobile;
}
