import { computed, ref, watch, type Ref } from "vue";
import { confirmDiscard, useUnsavedChanges } from "./unsaved";

export function useEditorGuard(
  open: Ref<boolean>,
  serialize: () => string,
  busy: Ref<boolean>,
) {
  const baseline = ref("");
  watch(
    open,
    (value) => {
      if (value) baseline.value = serialize();
    },
    { flush: "sync" },
  );
  const dirty = computed(() => open.value && baseline.value !== serialize());
  useUnsavedChanges(dirty);
  return async (done?: () => void) => {
    if (busy.value || !(await confirmDiscard(dirty.value))) return;
    if (done) done();
    else open.value = false;
  };
}
