<script setup lang="ts">
import { avatarMarkup } from '../art/avatar-art'
// Decorative, locally authored SVG; never renders remote or user-provided markup.
const artwork = avatarMarkup(0, 0)
</script>
<template><div class="learner-avatar-art" aria-hidden="true" v-html="artwork"></div></template>
