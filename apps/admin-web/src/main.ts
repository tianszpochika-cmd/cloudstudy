import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { router } from "./router";
import { pinia } from "./stores/admin";
import App from "./App.vue";
import "./styles.css";
import "./platform/motion";
import {
  adminI18nAdapter,
  adminThemeAdapter,
  adminThemeController,
} from "./platform/v2-foundation";

adminI18nAdapter.restore();
adminThemeController.restore();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(ElementPlus);
app.provide("i18n", adminI18nAdapter);
app.provide("theme", adminThemeAdapter);
// Mount immediately so an unavailable Gateway still exposes a visible
// startup state while the guarded initial navigation is restoring a session.
app.mount("#app");
void router.isReady().catch((error) => {
  console.error("[语学星 Admin] 初始路由恢复失败。", error);
});
