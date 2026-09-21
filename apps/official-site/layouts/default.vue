<script setup lang="ts">
const { t } = useSiteText(),
  route = useRoute(),
  sticky = ref(false),
  main = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
function observe() {
  observer?.disconnect();
  let primaryVisible = false,
    worldVisible = false;
  const update = () =>
    (sticky.value =
      !["/start", "/world"].includes(route.path) &&
      !primaryVisible &&
      !worldVisible);
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.target.classList.contains("world-widget"))
          worldVisible = e.isIntersecting;
        else primaryVisible = e.isIntersecting;
      }
      update();
    },
    { threshold: 0.05 },
  );
  const primary = main.value?.querySelector("[data-primary]");
  if (primary) observer.observe(primary);
  const world = main.value?.querySelector(".world-widget");
  if (world) observer.observe(world);
  if (!primary) sticky.value = false;
}
onMounted(observe);
watch(
  () => route.path,
  async () => {
    sticky.value = false;
    await nextTick();
    observe();
    main.value?.focus({ preventScroll: true });
  },
);
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">{{ t("official.cd42c35cd6") }}</a
    ><SiteHeader />
    <main id="main-content" ref="main" tabindex="-1"><slot /></main>
    <SiteFooter />
    <div v-if="sticky" class="mobile-cta">
      <div>
        <strong>{{ t("official.ce46a39b05") }}</strong
        ><small>{{ t("official.c930b5e016") }}</small>
      </div>
      <SiteStartButton :label="t('official.cd28ebd1dd')" />
    </div>
  </div>
</template>
