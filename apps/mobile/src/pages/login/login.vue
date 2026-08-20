<script setup lang="ts">
import { getUniRuntime } from '../../platform/uni-runtime'
import EmptyState from '../../components/EmptyState.vue'

function goBack(): void {
  getUniRuntime().navigateTo({ url: '/pages/home/home' })
}
</script>

<template>
  <view class="yx-page">
    <view class="yx-brand">
      <text class="yx-brand__mark" aria-hidden="true">✦</text>
      <text>语学星</text>
    </view>
    <text class="yx-eyebrow">ACCOUNT</text>
    <text class="yx-title">登录学习空间</text>
    <text class="yx-description">身份接口会严格按生成的认证契约接入。当前不提交未定义的账号字段，也不会伪造登录成功。</text>
    <view class="yx-card">
      <EmptyState title="身份契约尚未接入" description="认证 OpenAPI 与生成客户端就绪后，这里将替换为真实登录表单。" />
      <button class="yx-button yx-button--secondary" type="button" @click="goBack">返回学习首页</button>
    </view>
  </view>
</template>
