<script setup lang="ts">
const props = defineProps<{
    room: string;
    view: string;
    avatar: number;
    outfit: number;
  }>(),
  { t } = useSiteText(),
  angle = ref(0),
  dragging = ref(false);
let drag: {
  id: number;
  x: number;
  y: number;
  angle: number;
  element: HTMLElement;
} | null = null;
function turn(direction: number) {
  angle.value =
    direction === 0
      ? 0
      : Math.max(-22, Math.min(22, angle.value + direction * 11));
}
function pointerDown(e: PointerEvent) {
  if (props.view !== "3d" || e.button !== 0) return;
  drag = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    angle: angle.value,
    element: e.currentTarget as HTMLElement,
  };
}
function pointerMove(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (!dragging.value) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
      drag = null;
      return;
    }
    if (Math.abs(dx) < 7) return;
    dragging.value = true;
    drag.element.setPointerCapture(e.pointerId);
  }
  angle.value = Math.max(-22, Math.min(22, drag.angle + dx / 5));
}
function pointerUp() {
  if (drag?.element.hasPointerCapture(drag.id))
    drag.element.releasePointerCapture(drag.id);
  drag = null;
  dragging.value = false;
}
watch(() => props.view, pointerUp);
onBeforeUnmount(pointerUp);
</script>
<template>
  <div class="room-stage" :class="'room-' + room" :data-view="view">
    <div class="scene-specks" aria-hidden="true">
      ✦ <span>✧</span> · <i>✦</i>
    </div>
    <div
      class="room-perspective"
      :class="{ 'is-dragging': dragging }"
      :style="{ '--room-angle': angle + 'deg' }"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
    >
      <div class="room-composition">
        <svg class="room-architecture" viewBox="0 0 640 440" aria-hidden="true">
          <ellipse
            cx="320"
            cy="371"
            rx="246"
            ry="47"
            fill="var(--scene-shadow)"
            opacity=".1"
          />
          <path
            d="M85 266 327 374l231-108v18L327 397 85 286Z"
            fill="var(--room-edge)"
          />
          <path d="M85 258 322 150l236 108-231 114Z" fill="var(--room-floor)" />
          <path d="M85 258V79L322 8v191Z" fill="var(--room-wall-left)" />
          <path d="M322 8 558 94v164l-236-59Z" fill="var(--room-wall-right)" />
          <path
            d="m85 258 241 113 232-113M322 11v184"
            fill="none"
            stroke="var(--room-edge)"
            stroke-width="3"
          />
          <path
            d="m130 105 116-34v110l-116 32Z"
            fill="var(--room-window-rim)"
          />
          <path d="m140 112 96-28v89l-96 27Z" fill="var(--room-window)" />
          <path
            d="m188 98 1 88m-46-41 90-27"
            stroke="var(--room-window-rim)"
            stroke-width="6"
          />
          <circle cx="214" cy="108" r="12" fill="var(--room-moon)" />
          <path d="m382 71 66 24v58l-66-24Z" fill="var(--room-frame)" />
          <path d="m390 83 50 18v40l-50-18Z" fill="var(--room-window-rim)" />
          <path
            d="m415 98 5 11 10 6-10 1-5 8-4-12-10-7 10-1Z"
            fill="var(--purple)"
          />
          <path d="m370 176 152 49v9l-152-48Z" fill="var(--room-edge)" />
          <path
            d="m394 137 13 4v46l-13-4m18-39 12 4v44l-12-4m19-29 12 4v36l-12-4"
            fill="var(--room-book)"
          />
          <path d="m455 166 18 7v33l-18-7" fill="var(--room-frame)" />
          <path d="m176 281 136-60 129 53-135 63Z" fill="var(--room-rug)" />
          <path
            d="m190 282 121-52 112 45-116 52Z"
            fill="none"
            stroke="var(--room-window-rim)"
            opacity=".5"
            stroke-width="2"
          />
          <path d="m489 272 26 10-3 30-21-7Z" fill="var(--room-pot)" />
          <path
            d="M502 277q-35-20-21-44 25 7 21 44m0 0q-6-41 16-45 14 20-16 45m0 0q10-26 30-18 1 21-30 18"
            fill="var(--room-leaf)"
          /></svg
        ><svg class="room-desk" viewBox="0 0 640 440" aria-hidden="true">
          <path
            d="m146 212 145-51 111 44-139 61Z"
            fill="var(--room-desk-top)"
          />
          <path
            d="m146 212 117 54 139-61v10l-139 60-117-52Z"
            fill="var(--room-edge)"
          />
          <path
            d="M160 225v76l12 5v-76m79 44v77l13 6v-82m124-51v68l-11 5v-69"
            fill="var(--room-edge)"
          />
          <path d="m265 211 42-15 34 12-43 18Z" fill="var(--room-window-rim)" />
          <path d="m269 207 17-11 26 5-14 17Z" fill="var(--room-book)" />
          <path d="m298 218 14-17 24 7-13 13Z" fill="var(--room-frame)" />
          <ellipse cx="206" cy="207" rx="17" ry="7" fill="var(--room-edge)" />
          <path
            d="m204 207 3-41 26-15"
            fill="none"
            stroke="var(--room-edge)"
            stroke-width="5"
          />
          <path d="m219 148 27-5 7 19-39 8Z" fill="var(--room-lamp)" />
          <path
            class="lamp-glow"
            d="m217 168-27 40 75-4-14-42Z"
            fill="var(--room-light)"
            opacity=".18"
          />
        </svg>
        <div class="room-avatar">
          <SiteAvatar :index="avatar" :outfit="outfit" />
        </div>
        <div class="room-floating-tag">
          <SiteIcon name="spark" />{{ t("official.cb3939b2d4") }}
        </div>
      </div>
    </div>
    <div class="scene-label">
      <span class="live-dot"></span
      >{{ t(room === "night" ? "official.cf2c99dfdd" : "official.ce0928b373")
      }}<span>·</span
      >{{ t(view === "3d" ? "official.c60d91d61f" : "official.c23c796c0a") }}
    </div>
    <div v-if="view === '3d'" class="room-view-controls">
      <button @click="turn(-1)" :aria-label="t('official.c4bec426b7')">
        <SiteIcon name="left" /></button
      ><button @click="turn(0)" :aria-label="t('official.c0a1486030')">
        <SiteIcon name="rotate" /></button
      ><button @click="turn(1)" :aria-label="t('official.c3c5a1458f')">
        <SiteIcon name="right" />
      </button>
    </div>
  </div>
</template>
