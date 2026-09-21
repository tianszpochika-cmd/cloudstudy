<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string; menu?: boolean }>(),
  emit = defineEmits<{ close: [] }>(),
  { t } = useSiteText();
const titleId = useId();
const element = ref<HTMLDialogElement>();
let opener: HTMLElement | null = null;
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      opener = document.activeElement as HTMLElement;
      if (!element.value?.open) element.value?.showModal();
    } else if (element.value?.open) element.value.close();
  },
);
function closed() {
  emit("close");
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}
function backdrop(event: MouseEvent) {
  if (event.target !== element.value) return;
  const r = element.value!.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    emit("close");
}
onBeforeUnmount(() => element.value?.close());
</script>
<template>
  <dialog
    ref="element"
    :class="{ 'nav-dialog': menu }"
    :aria-labelledby="titleId"
    @close="closed"
    @cancel="emit('close')"
    @click="backdrop"
  >
    <div class="dialog-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button
        class="round-button"
        :aria-label="t('official.c6c14bd7f6')"
        @click="emit('close')"
      >
        <SiteIcon name="close" />
      </button>
    </div>
    <div class="dialog-content"><slot /></div>
  </dialog>
</template>
