<script setup lang="ts">
const { t } = useSiteText(),
  tab = ref(0),
  revealed = ref(false),
  rating = ref<number | null>(null),
  translation = ref(false),
  root = ref<HTMLElement>();
const steps = [
  "official.c21b4022ef",
  "official.c9858c5f61",
  "official.cac91b5de0",
];
const panelId = useId();
async function focus(selector: string) {
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>(selector)
    ?.focus({ preventScroll: true });
}
function reset() {
  tab.value = 0;
  revealed.value = false;
  rating.value = null;
  translation.value = false;
  void focus("[data-reveal]");
}
function keys(e: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  tab.value =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? 2
        : (tab.value + (e.key === "ArrowRight" ? 1 : 2)) % 3;
  void focus("[role=tab][aria-selected=true]");
}
</script>
<template>
  <div class="practice-sample" ref="root">
    <div
      class="step-tabs"
      role="tablist"
      :aria-label="t('official.c5c3cd68c8')"
      @keydown="keys"
    >
      <button
        v-for="(step, i) in steps"
        :key="step"
        role="tab"
        :id="panelId + '-' + i"
        :aria-controls="panelId"
        :aria-selected="tab === i"
        :tabindex="tab === i ? 0 : -1"
        @click="tab = i"
      >
        <span>{{ i + 1 }}</span
        ><strong>{{ t(step) }}</strong>
      </button>
    </div>
    <div class="demo-stage">
      <div
        class="sample-card"
        :key="tab"
        :id="panelId"
        role="tabpanel"
        :aria-labelledby="panelId + '-' + tab"
      >
        <template v-if="tab === 0"
          ><span class="pill">{{ t("official.c330377992") }}</span>
          <div class="sample-word">latte</div>
          <span class="phonetic">/ˈlɑːteɪ/</span>
          <p v-if="!revealed" class="sample-hint">
            {{ t("official.c4e9197017") }}
          </p>
          <template v-else
            ><h3>{{ t("official.c771a89cb0") }}</h3>
            <p>I'd like a latte, please.</p></template
          ><button
            v-if="!revealed"
            class="btn btn-primary btn-wide"
            data-reveal
            @click="
              revealed = true;
              focus('[data-rate]');
            "
          >
            {{ t("official.c176d004bf") }}<SiteIcon name="arrow" />
          </button>
          <div v-else-if="rating === null" class="sample-ratings">
            <button
              data-rate
              class="btn btn-outline"
              @click="
                rating = 0;
                focus('[data-next]');
              "
            >
              {{ t("official.cbaeb282e7") }}</button
            ><button
              class="btn btn-primary"
              @click="
                rating = 1;
                focus('[data-next]');
              "
            >
              {{ t("official.caca165b08") }}
            </button>
          </div>
          <template v-else
            ><p class="sample-feedback" role="status">
              {{ t("official.c21f1c3225") }}
            </p>
            <button
              data-next
              class="btn btn-primary btn-wide"
              @click="
                tab = 1;
                focus('[data-phrase]');
              "
            >
              {{ t("official.c24f81e9d5")
              }}<SiteIcon name="arrow" /></button></template></template
        ><template v-else-if="tab === 1"
          ><span class="pill">{{ t("official.c9b1e6ed3f") }}</span>
          <div class="sample-sentence">
            Could I have a
            <button data-phrase @click="translation = !translation">
              latte to go</button
            >?
          </div>
          <p v-if="translation" role="status">{{ t("official.cbb5c29b41") }}</p>
          <p v-else>{{ t("official.c3dbe04fcf") }}</p>
          <button
            class="btn btn-primary btn-wide"
            @click="
              tab = 2;
              focus('[data-reset]');
            "
          >
            {{ t("official.cac91b5de0")
            }}<SiteIcon name="arrow" /></button></template
        ><template v-else
          ><span class="pill">{{ t("official.cec4992fc4") }}</span>
          <h3>{{ t("official.cb76fc45fd") }}</h3>
          <div class="review-list">
            <div>
              <strong>latte</strong><span>{{ t("official.c771a89cb0") }}</span>
            </div>
            <div>
              <strong>to go</strong><span>{{ t("official.c98ef12cdc") }}</span>
            </div>
            <div>
              <strong>order</strong><span>{{ t("official.ce0484738c") }}</span>
            </div>
          </div>
          <button data-reset class="btn btn-outline btn-wide" @click="reset">
            {{ t("official.cab6b7d8c4") }}<SiteIcon name="repeat" /></button
        ></template>
      </div>
      <p class="sample-caption">{{ t("official.c70e1eb4f6") }}</p>
    </div>
  </div>
</template>
