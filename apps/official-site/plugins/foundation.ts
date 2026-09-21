import { createOfficialFoundation } from "~/utils/v2-foundation";
import { resolvePublicThemeMode } from "~/utils/public-projection";
export default defineNuxtPlugin(() => {
  const locale = useCookie<string>("yx.public.locale"),
    theme = useCookie<string>("yx.public.theme");
  return {
    provide: {
      foundation: createOfficialFoundation(
        locale.value || "zh-CN",
        resolvePublicThemeMode(theme.value),
      ),
    },
  };
});
