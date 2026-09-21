<script setup lang="ts">
const { t } = useSiteText(),
  preferences = useState("official:preferences", () => false);
const groups = [
  {
    title: "official.cbd6578c0b",
    links: [
      ["/courses", "official.c36a0f1dc5"],
      ["/method", "official.c831468464"],
      ["/world", "official.cdf0fd9f57"],
      ["/start", "official.cd28ebd1dd"],
    ],
  },
  {
    title: "official.cc0c78a429",
    links: [
      ["/help", "official.c0adb1147b"],
      ["/about", "official.c3a9d26408"],
      ["/announcements", "official.c941d9548f"],
      ["/status", "official.cd42da9e2a"],
    ],
  },
  {
    title: "official.cfbcee5731",
    links: [
      ["/privacy", "official.c5c7d60537"],
      ["/terms", "official.c15683f6cd"],
      ["/minors", "official.c770693e4f"],
      ["/compliance", "official.cfbcee5731"],
    ],
  },
];
</script>
<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-main">
        <div class="footer-brand">
          <SiteBrand />
          <p>
            {{ t("official.c5af6c5d99") }}<br />{{ t("official.c1d29e2d17") }}
          </p>
          <span class="footer-caption">LEARN A LITTLE. EVERY DAY.</span>
        </div>
        <div v-for="group in groups" :key="group.title" class="footer-col">
          <h3>{{ t(group.title) }}</h3>
          <NuxtLink
            v-for="[path, label] in group.links"
            :key="path"
            :to="path"
            >{{ t(label) }}</NuxtLink
          >
        </div>
      </div>
      <div class="footer-bottom">
        <button class="footer-settings" @click="preferences = true">
          <SiteIcon name="globe" />{{ t("official.cf3b9e99ed") }}</button
        ><span>{{ t("official.cf7ce229f6") }}</span
        ><span>{{ t("official.c594f92349") }}</span>
      </div>
    </div>
  </footer>
</template>
