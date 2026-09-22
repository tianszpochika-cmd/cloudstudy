<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { fetchPreviewUrl, decodePeaks } from "../api/media-preview";

const props = defineProps<{ assetId: string }>();

const audioRef = ref<HTMLAudioElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const rate = ref(1);
const previewUrl = ref("");
const peaks = ref<number[]>([]);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
const message = ref("");

async function load(): Promise<void> {
  status.value = "loading";
  message.value = "";
  try {
    const signed = await fetchPreviewUrl(props.assetId);
    previewUrl.value = signed.url;
    status.value = "ready";
    try {
      peaks.value = await decodePeaks(signed.url);
      draw();
    } catch {
      peaks.value = [];
    }
  } catch (error) {
    status.value = "error";
    message.value = error instanceof Error ? error.message : "预览加载失败。";
  }
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas || !peaks.value.length) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--admin-accent")
    .trim();
  const bar = width / peaks.value.length;
  peaks.value.forEach((peak, index) => {
    const h = Math.max(2, peak * height);
    context.fillRect(
      index * bar + 1,
      (height - h) / 2,
      Math.max(1, bar - 2),
      h,
    );
  });
}

function setRate(value: number): void {
  rate.value = value;
  if (audioRef.value) audioRef.value.playbackRate = value;
}

watch(
  () => props.assetId,
  () => {
    void load();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  previewUrl.value = "";
});
</script>

<template>
  <div class="audio-preview">
    <el-space wrap>
      <el-button size="small" :loading="status === 'loading'" @click="load()"
        >加载预览</el-button
      >
      <el-button-group v-if="status === 'ready'">
        <el-button
          v-for="r in [0.5, 0.75, 1, 1.5, 2]"
          :key="r"
          size="small"
          :type="rate === r ? 'primary' : 'default'"
          @click="setRate(r)"
          >{{ r }}x</el-button
        >
      </el-button-group>
    </el-space>
    <canvas
      v-show="peaks.length"
      ref="canvasRef"
      width="360"
      height="56"
      class="waveform"
    />
    <audio
      v-if="previewUrl"
      ref="audioRef"
      :src="previewUrl"
      controls
      preload="none"
      class="player"
    />
    <el-alert
      v-if="status === 'error'"
      :title="message"
      type="error"
      :closable="false"
      show-icon
    />
  </div>
</template>

<style scoped>
.audio-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.waveform {
  width: 100%;
  max-width: 360px;
  border-radius: 6px;
  background: var(--admin-brand-soft);
}
.player {
  width: 100%;
  max-width: 360px;
}
</style>
