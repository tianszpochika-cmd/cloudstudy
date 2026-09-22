import { onMounted, onUnmounted, type Ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { ElMessageBox } from "element-plus";
import { ui } from "./experience";
export async function confirmDiscard(dirty: boolean): Promise<boolean> {
  if (!dirty) return true;
  try {
    await ElMessageBox.confirm(ui("unsaved"), ui("unsavedTitle"), {
      type: "warning",
      confirmButtonText: ui("leave"),
      cancelButtonText: ui("stay"),
      distinguishCancelAndClose: true,
    });
    return true;
  } catch {
    return false;
  }
}
export function useUnsavedChanges(dirty: Ref<boolean>) {
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (dirty.value) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  onBeforeRouteLeave(() => confirmDiscard(dirty.value));
  onMounted(() => window.addEventListener("beforeunload", beforeUnload));
  onUnmounted(() => window.removeEventListener("beforeunload", beforeUnload));
}
