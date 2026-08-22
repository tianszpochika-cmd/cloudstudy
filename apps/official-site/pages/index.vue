<script setup lang="ts">
import { computed } from 'vue'
import { usePublicProjection } from '~/composables/usePublicProjection'
import { resolvePublicPageState } from '~/utils/public-state.mjs'
import { absoluteSiteUrl, useOfficialSeo } from '~/utils/seo'

const { authLink, publicLink } = useOfficialSiteLinks()
const route = useRoute()
const { loadState, load } = usePublicProjection('home')
const publicCourses = computed(() => loadState.value.projection.courses)
const announcements = computed(() => loadState.value.projection.announcements)
const campaigns = computed(() => loadState.value.projection.campaigns)
const pageState = computed(() => resolvePublicPageState(route.query.state, loadState.value.state, publicCourses.value.length > 0 || campaigns.value.length > 0))

function announcementHref(href: string | null): string | undefined {
  return publicLink(href) || undefined
}

useOfficialSeo({
  title: '语学星｜让每一次学习都走向下一步',
  description: '语学星 EnglishFlow 面向成年用户与大学生，提供有目标、有练习、有反馈、有复习的语言学习闭环。',
  path: '/',
})

useHead({
  script: [
    {
      key: 'jsonld-home-organization',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '语学星 EnglishFlow',
        url: absoluteSiteUrl('/'),
        description: '面向成年用户与大学生的语言学习平台。',
      }),
    },
  ],
})
</script>

<template>
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="eyebrow">Adult learning · Phase 1</span>
        <h1>把学习拆成<br /><em>下一步</em>，每天都走得更远。</h1>
        <p class="hero-lede">
          语学星把目标、练习、反馈、复习和复盘连成一个可持续的学习闭环。先知道今天该做什么，再看见自己为什么进步。
        </p>
        <div class="hero-actions">
          <NuxtLink class="button button-primary" to="/courses">查看课程体系 →</NuxtLink>
          <a class="button button-secondary" :href="authLink('/onboarding?source=official-home')">开始学习</a>
        </div>
        <p class="hero-note"><span aria-hidden="true">✓</span> 当前面向成年用户与大学生，AI 与 K12 能力按阶段开放。</p>
      </div>

      <div class="hero-visual" aria-label="学习闭环预览">
        <div class="hero-orbit" aria-hidden="true"></div>
        <div class="floating-badge top">今日任务 · 3 个小步骤</div>
        <div class="learning-preview">
          <div class="preview-topline">
            <strong>今天的学习地图</strong>
            <span>星期三</span>
          </div>
          <div class="preview-progress" aria-label="今日学习进度 68%"><span></span></div>
          <div class="preview-progress-label"><span>闭环进度</span><strong>68%</strong></div>
          <div class="preview-lesson">
            <span class="preview-lesson-icon" aria-hidden="true">✦</span>
            <span><strong>复习 12 张词卡</strong><small>高频生活场景 · 约 8 分钟</small></span>
            <span>继续 →</span>
          </div>
          <div class="preview-lesson">
            <span class="preview-lesson-icon" aria-hidden="true">↗</span>
            <span><strong>听读精练</strong><small>带字幕回放 · 已保存进度</small></span>
            <span>稍后</span>
          </div>
        </div>
        <div class="floating-badge bottom">有反馈，才有下一次复习</div>
      </div>
    </div>
  </section>

  <section class="section section-tinted">
    <div class="container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Why EnglishFlow</span>
          <h2>每一步都留下可继续的线索。</h2>
        </div>
        <p>公开页面只介绍产品边界与课程，不读取登录后的学习数据。</p>
      </div>
      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-icon" aria-hidden="true">◎</span>
          <h3>从目标出发</h3>
          <p>把想学会的事情变成清晰、可安排、可复盘的学习目标。</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon" aria-hidden="true">↗</span>
          <h3>反馈不是终点</h3>
          <p>知道哪里错、为什么错，以及下一次应该练什么，学习才会继续。</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon" aria-hidden="true">⟳</span>
          <h3>复习回到闭环</h3>
          <p>把进度、复习和报告放回同一条路径，减少“学过但没留下”的断点。</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Public courses</span>
          <h2>从适合今天的课程开始。</h2>
        </div>
        <NuxtLink class="button button-secondary button-small" to="/courses">全部课程 →</NuxtLink>
      </div>
      <PublicStatus v-if="pageState !== 'ready'" :state="pageState" action-href="/courses" action-label="打开课程目录" @retry="load" />
      <div v-else-if="publicCourses.length" class="course-grid">
        <CourseCard v-for="course in publicCourses.slice(0, 4)" :key="course.id" :course="course" />
      </div>
      <PublicStatus v-else state="empty" action-href="/courses" action-label="查看课程状态" />
    </div>
  </section>

  <section v-if="announcements.length" class="section section-tinted">
    <div class="container">
      <div class="section-heading"><div><span class="eyebrow">Announcements</span><h2>公开版本与服务公告。</h2></div></div>
      <div class="announcement-list"><a v-for="announcement in announcements" :key="announcement.id" :href="announcementHref(announcement.href)" class="announcement-item"><strong>{{ announcement.title }}</strong><span>{{ announcement.summary }}</span></a></div>
    </div>
  </section>

  <section v-if="campaigns.length" class="section">
    <div class="container">
      <div class="section-heading">
        <div><span class="eyebrow">Public activities</span><h2>当前公开活动与体验入口。</h2></div>
        <p>活动资格、地区范围和开放时间以公开投影为准。</p>
      </div>
      <div class="campaign-grid">
        <PublicCampaignCard v-for="campaign in campaigns" :key="campaign.id" :campaign="campaign" />
      </div>
    </div>
  </section>

  <section class="section section-tinted">
    <div class="container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">The loop</span>
          <h2>四个动作，构成一次完整学习。</h2>
        </div>
      </div>
      <div class="journey-grid">
        <article class="journey-step">
          <span class="journey-number">01</span>
          <h3>定目标</h3>
          <p>明确想解决的场景与节奏。</p>
        </article>
        <article class="journey-step">
          <span class="journey-number">02</span>
          <h3>做练习</h3>
          <p>用短任务进入真实语境。</p>
        </article>
        <article class="journey-step">
          <span class="journey-number">03</span>
          <h3>看反馈</h3>
          <p>理解错误，而不是只看分数。</p>
        </article>
        <article class="journey-step">
          <span class="journey-number">04</span>
          <h3>再复习</h3>
          <p>把下一次练习接回今天。</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="cta-banner">
        <div>
          <h2>准备好走出下一步了吗？</h2>
          <p>先从公开课程了解学习方式，再安全跳转到学习 Web 完成登录和个性化设置。</p>
        </div>
        <a class="button" :href="authLink('/onboarding?source=official-cta')">进入学习 Web →</a>
      </div>
    </div>
  </section>
</template>
