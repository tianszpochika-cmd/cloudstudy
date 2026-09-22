<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
<template>
  <div class="study-artwork" :class="{ 'study-artwork--compact': compact }" aria-hidden="true">
    <div class="study-artwork__orbit"></div><div class="study-artwork__star">✦</div><div class="study-artwork__star study-artwork__star--small">✧</div>
    <div class="study-artwork__window"><i></i><b></b></div>
    <div class="study-artwork__desk"></div>
    <div class="study-artwork__plant"><i></i><i></i><i></i><b></b></div>
    <div class="study-artwork__books"><i></i><i></i><i></i></div>
    <div class="study-artwork__cup"><i></i><b></b><span></span></div>
    <div class="study-artwork__note"><span>little by little</span><strong>grow.</strong><i>✦</i></div>
  </div>
</template>
