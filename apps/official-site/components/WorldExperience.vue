<script setup lang="ts">
const { t } = useSiteText(),
  { allowsDepth } = useSiteMotion(),
  root = ref<HTMLElement>(),
  tab = ref("room"),
  requestedView = ref("3d"),
  room = ref("night"),
  avatar = ref(0),
  outfit = ref(0),
  message = ref("");
const view = computed(() => (allowsDepth.value ? requestedView.value : "2d")),
  avatars = [
    "official.cec04eb643",
    "official.c06983fadc",
    "official.c59f38a3e4",
  ],
  outfits = [
    "official.c867f34682",
    "official.c4d090be1d",
    "official.cfbd3bb8e6",
  ],
  tabs = [
    ["room", "room", "official.ccd6fd5dd5"],
    ["game", "train", "official.c938464507"],
    ["wall", "wall", "official.c3f0597c2e"],
  ];
const round = ref(0),
  selected = ref<number[]>([]),
  hint = ref(false);
const prompts = [
    {
      cn: "official.c47344da85",
      words: ["English", "every", "I", "day.", "learn"],
      order: [2, 4, 0, 1, 3],
    },
    {
      cn: "official.c17ae73593",
      words: ["coffee,", "A", "please."],
      order: [1, 0, 2],
    },
  ],
  question = computed(() => prompts[round.value]!),
  done = computed(
    () =>
      selected.value.length === question.value.order.length &&
      selected.value.every((v, i) => v === question.value.order[i]),
  );
async function focus(selector: string) {
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>(selector)
    ?.focus({ preventScroll: true });
}
function selectWord(index: number) {
  if (selected.value.includes(index)) return;
  selected.value.push(index);
  void focus(
    done.value
      ? "[data-next-train]"
      : selected.value.length === question.value.order.length
        ? "[data-remove-word]"
        : "[data-word]:not(:disabled)",
  );
}
function reset() {
  selected.value = [];
  hint.value = false;
  void focus("[data-word]");
}
function next() {
  if (round.value === 0) {
    round.value = 1;
    reset();
  } else {
    tab.value = "room";
    round.value = 0;
    reset();
    void focus("[role=tab][aria-selected=true]");
  }
}
function keys(e: KeyboardEvent) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const i = tabs.findIndex((x) => x[0] === tab.value);
  tab.value =
    tabs[
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3
    ]![0]!;
  void focus("[role=tab][aria-selected=true]");
}
let observer: IntersectionObserver | undefined;
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (root.value)
        root.value.dataset.inView = String(entries[0]?.isIntersecting);
    },
    { threshold: 0.05 },
  );
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());
const panelId = useId();
</script>
<template>
  <div class="world-widget" ref="root" :data-tab="tab" :data-view="view">
    <div class="world-toolbar">
      <div
        class="world-tabs"
        role="tablist"
        :aria-label="t('official.c674932103')"
        @keydown="keys"
      >
        <button
          v-for="[key, icon, label] in tabs"
          :key="key"
          :id="panelId + '-' + key"
          role="tab"
          :aria-controls="panelId"
          :aria-selected="tab === key"
          :tabindex="tab === key ? 0 : -1"
          @click="
            tab = key!;
            message = '';
          "
        >
          <SiteIcon :name="icon!" />{{ t(label!) }}
        </button>
      </div>
      <div
        class="world-view"
        role="group"
        :aria-label="t('official.c2818d5907')"
      >
        <button
          v-for="mode in ['2d', '3d']"
          :key="mode"
          :aria-pressed="view === mode"
          :disabled="mode === '3d' && !allowsDepth"
          @click="requestedView = mode"
        >
          {{ mode.toUpperCase() }}
        </button>
      </div>
    </div>
    <div
      :id="panelId"
      class="world-panel"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="panelId + '-' + tab"
    >
      <div v-if="tab === 'room'" class="world-room-panel">
        <RoomScene
          :room="room"
          :view="view"
          :avatar="avatar"
          :outfit="outfit"
        />
        <div class="world-side">
          <span class="eyebrow">{{ t("official.c1986763e8") }}</span>
          <h3>
            {{ t("official.c8c3557847") }}<br />{{ t("official.c1974f87c5") }}
          </h3>
          <p>
            {{ t("official.ca89703a4c") }}<br />{{ t("official.c9f2db41e1") }}
          </p>
          <div class="world-options">
            <div>
              <span class="option-label">{{ t("official.cffd5005a2") }}</span>
              <div
                class="world-choice"
                role="group"
                :aria-label="t('official.cffd5005a2')"
              >
                <button
                  :aria-pressed="room === 'night'"
                  @click="room = 'night'"
                >
                  {{ t("official.cf2c99dfdd") }}</button
                ><button
                  :aria-pressed="room === 'morning'"
                  @click="room = 'morning'"
                >
                  {{ t("official.ce0928b373") }}
                </button>
              </div>
            </div>
            <div>
              <span class="option-label">{{ t("official.ca0a2709d9") }}</span>
              <div
                class="outfit-options"
                role="group"
                :aria-label="t('official.ce0b17bd23')"
              >
                <button
                  v-for="(label, i) in outfits"
                  :key="label"
                  :class="'outfit-' + i"
                  :aria-label="t(label)"
                  :aria-pressed="outfit === i"
                  @click="
                    outfit = i;
                    message = t('official.c20f0c2e36');
                  "
                >
                  <i /><SiteIcon v-if="outfit === i" name="check" /></button
                ><span>{{ t(outfits[outfit]!) }}</span>
              </div>
            </div>
          </div>
          <button
            class="link-arrow"
            @click="
              tab = 'wall';
              focus('[role=tab][aria-selected=true]');
            "
          >
            {{ t("official.cc4ae2ab7d") }}<SiteIcon name="right" /></button
          ><small class="world-sample-note">{{
            t("official.ced74efe86")
          }}</small>
        </div>
      </div>
      <div v-else-if="tab === 'game'" class="train-panel" :data-view="view">
        <div class="train-landscape" aria-hidden="true">
          <span class="train-moon" /><span class="train-hill one" /><span
            class="train-hill two"
          />
          <div class="train-track" />
          <div class="tiny-train" :class="{ 'train-arrived': done }">
            <SiteIcon name="train" /><i /><i />
          </div>
          <span class="train-station">NEXT STOP · A LITTLE PROGRESS</span>
        </div>
        <div class="train-play">
          <div class="train-prompt">
            <span class="pill"
              >{{ t("official.c9af62ec41") }}{{ round + 1 }} / 2</span
            ><button class="link-arrow" @click="hint = !hint">
              {{ t(hint ? "official.cb4af4c952" : "official.c5c6ebe068") }}
            </button>
          </div>
          <h3>{{ t(question.cn) }}</h3>
          <p>{{ t(hint ? "official.c6df7807c1" : "official.c94fd41826") }}</p>
          <div
            class="train-slots"
            role="group"
            :aria-label="t('official.c95376ee94')"
          >
            <template v-for="(_, i) in question.order" :key="i"
              ><button
                v-if="selected[i] !== undefined"
                data-remove-word
                :aria-label="
                  t('official.c8eaf4ad62') + ' ' + question.words[selected[i]!]
                "
                @click="
                  selected.splice(i, 1);
                  focus('[data-word]:not(:disabled)');
                "
              >
                {{ question.words[selected[i]!] }}</button
              ><span v-else>{{ i + 1 }}</span></template
            >
          </div>
          <div
            class="train-words"
            role="group"
            :aria-label="t('official.c38eb6a6cb')"
          >
            <button
              v-for="(word, i) in question.words"
              :key="word"
              data-word
              :disabled="selected.includes(i)"
              @click="selectWord(i)"
            >
              {{ word }}
            </button>
          </div>
          <div class="train-bottom">
            <button class="link-arrow" @click="reset">
              <SiteIcon name="undo" />{{ t("official.c4835094aa") }}</button
            ><button
              v-if="done"
              data-next-train
              class="btn btn-primary btn-small"
              @click="next"
            >
              {{ t(round === 0 ? "official.c48788da78" : "official.c9581561d7")
              }}<SiteIcon name="right" /></button
            ><span v-else
              >{{ selected.length }} / {{ question.order.length }}</span
            >
          </div>
          <p class="world-feedback" :class="{ correct: done }" role="status">
            {{
              t(
                done
                  ? "official.cf979f202c"
                  : selected.length === question.order.length
                    ? "official.cea5df72a8"
                    : "official.c6a599efcf",
              )
            }}
          </p>
        </div>
      </div>
      <div v-else class="wall-panel">
        <div class="wall-heading">
          <div>
            <span class="eyebrow">{{ t("official.cfaf63b600") }}</span>
            <h3>{{ t("official.c6d4517aed") }}</h3>
          </div>
          <p>{{ t("official.c63a350e09") }}</p>
        </div>
        <div class="character-wall">
          <button
            v-for="(name, i) in avatars"
            :key="name"
            class="character-card"
            :class="{ chosen: avatar === i }"
            :aria-pressed="avatar === i"
            @click="
              avatar = i;
              message = t('official.c9ccc865bb');
            "
          >
            <span class="character-number">0{{ i + 1 }}</span
            ><span class="character-portrait"
              ><SiteAvatar :index="i" :outfit="outfit" /></span
            ><span class="character-name"
              >{{ t(name)
              }}<span
                ><SiteIcon v-if="avatar === i" name="check" /><template
                  v-else
                  >{{ t("official.c70b208202") }}</template
                ></span
              ></span
            >
          </button>
        </div>
        <div class="wall-bottom">
          <div class="world-options">
            <div>
              <span class="option-label">{{ t("official.ca0a2709d9") }}</span>
              <div
                class="outfit-options"
                role="group"
                :aria-label="t('official.ce0b17bd23')"
              >
                <button
                  v-for="(label, i) in outfits"
                  :key="label"
                  :class="'outfit-' + i"
                  :aria-label="t(label)"
                  :aria-pressed="outfit === i"
                  @click="outfit = i"
                >
                  <i /><SiteIcon v-if="outfit === i" name="check" /></button
                ><span>{{ t(outfits[outfit]!) }}</span>
              </div>
            </div>
          </div>
          <button
            class="btn btn-primary"
            @click="
              tab = 'room';
              focus('[role=tab][aria-selected=true]');
            "
          >
            {{ t("official.ca2c5263da") }}<SiteIcon name="right" />
          </button>
        </div>
        <div class="growth-shelf">
          <span><SiteIcon name="star" />{{ t("official.cad7ed5da1") }}</span
          ><button @click="message = t('official.c90b8276e7')">
            <SiteIcon name="book" />{{ t("official.c7c1c37191") }}</button
          ><button @click="message = t('official.c6de185c51')">
            <SiteIcon name="star" />{{ t("official.c4483924f3") }}</button
          ><button @click="message = t('official.ca55e4c86a')">
            <SiteIcon name="wall" />{{ t("official.c93a41f509") }}
          </button>
        </div>
        <p class="world-sample-note">{{ t("official.cb0995dded") }}</p>
      </div>
    </div>
    <div class="world-live" role="status" aria-live="polite">{{ message }}</div>
  </div>
</template>
