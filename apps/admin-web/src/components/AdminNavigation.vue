<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useAdminStore } from "../stores/admin";
import { adminPages, ui } from "../platform/experience";
import AdminIcon from "./AdminIcon.vue";
import V2Icon from "./V2Icon.vue";
defineEmits<{ navigate: []; logout: [] }>();
const session = useAdminStore();
const route = useRoute();
const groups = computed(() =>
  ["overview", "content", "operations", "assurance"]
    .map((key) => ({
      key,
      pages: adminPages.filter(
        (page) => page.group === key && session.can(page.permission),
      ),
    }))
    .filter((group) => group.pages.length),
);
</script>
<template>
  <RouterLink
    class="admin-brand"
    :to="groups[0]?.pages[0]?.path ?? '/forbidden'"
    @click="$emit('navigate')"
    ><span class="admin-brand__mark"><AdminIcon name="spark" :size="23" /></span
    ><span
      ><strong>{{ ui("brand") }}</strong
      ><small>{{ ui("workspace") }}</small></span
    ></RouterLink
  >
  <nav class="admin-nav" :aria-label="ui('workspace')">
    <section v-for="group in groups" :key="group.key" class="admin-nav-group">
      <h2>{{ ui(`group.${group.key}`) }}</h2>
      <RouterLink
        v-for="page in group.pages"
        :key="page.path"
        :to="page.path"
        :class="['admin-nav-link', { active: route.path === page.path }]"
        :aria-current="route.path === page.path ? 'page' : undefined"
        @click="$emit('navigate')"
        ><V2Icon :name="page.icon" :size="19" /><span>{{
          ui(`nav.${page.key}.title`)
        }}</span
        ><span
          v-if="route.path === page.path"
          class="nav-active-dot"
          aria-hidden="true"
        ></span
      ></RouterLink>
    </section>
  </nav>
  <div class="admin-aside__footer">
    <span class="admin-avatar"><AdminIcon name="people" /></span>
    <div>
      <strong>{{ ui("workspace") }}</strong
      ><button type="button" class="text-button" @click="$emit('logout')">
        {{ ui("signOut") }} <span aria-hidden="true">↗</span>
      </button>
    </div>
  </div>
</template>
