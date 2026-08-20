/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json

import type { AuthRefreshResponse, B1AnyData, B1AssessmentStartResponse, B1AssessmentStepResponse, B1AuthTokenResponse, B1ContentDiff, B1DeviceListResponse, B1ImportReport, B1MediaAsset, B1MediaUploadIntent, B1OfflineManifest, B1PrivacyExportResponse, B1SignedMediaAccess, HealthResponse } from '@englishflow/contracts';

export interface GeneratedApiOperationRegistry {
  getHealth: { method: "GET"; path: "/api/v1/health"; response: HealthResponse; };
  refreshAuthSession: { method: "POST"; path: "/api/v1/auth/refresh"; response: AuthRefreshResponse; };
  createContentEntity: { method: "POST"; path: "/api/v1/content"; response: unknown; };
  createContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions"; response: unknown; };
  previewContentVersion: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/preview"; response: unknown; };
  diffContentVersions: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/diff"; response: B1ContentDiff; };
  submitContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/submit"; response: unknown; };
  decideContentVersionReview: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/review"; response: unknown; };
  publishContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/publish"; response: unknown; };
  archiveContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/archive"; response: unknown; };
  restoreContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/restore"; response: unknown; };
  importContentBatch: { method: "POST"; path: "/api/v1/content/imports"; response: B1ImportReport; };
  createContentMediaUploadIntent: { method: "POST"; path: "/api/v1/content/media/upload-intents"; response: B1MediaUploadIntent; };
  completeContentMediaUpload: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/complete"; response: B1MediaAsset; };
  signContentMediaAccess: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/signed-access"; response: B1SignedMediaAccess; };
  getContentOfflineManifest: { method: "GET"; path: "/api/v1/content/offline/manifests/{manifestCode}"; response: B1OfflineManifest; };
  getPublishedContent: { method: "GET"; path: "/api/v1/content/{contentId}"; response: unknown; };
  startPlacementSession: { method: "POST"; path: "/api/v1/assessment/placement/start"; response: B1AssessmentStartResponse; };
  submitPlacementStep: { method: "POST"; path: "/api/v1/assessment/placement/submit-step"; response: B1AssessmentStepResponse; };
  listUserDevices: { method: "GET"; path: "/api/v1/user/devices"; response: B1DeviceListResponse; };
  kickoutUserDevice: { method: "POST"; path: "/api/v1/user/devices/kickout"; response: unknown; };
  createPrivacyExport: { method: "POST"; path: "/api/v1/privacy/export"; response: B1PrivacyExportResponse; };
  sendB1SmsCode: { method: "POST"; path: "/api/v1/auth/sms/send-code"; response: B1AnyData; };
  loginB1Phone: { method: "POST"; path: "/api/v1/auth/login/phone"; response: B1AuthTokenResponse; };
  registerB1Phone: { method: "POST"; path: "/api/v1/auth/register"; response: B1AuthTokenResponse; };
  logoutB1Session: { method: "POST"; path: "/api/v1/auth/logout"; response: B1AnyData; };
  listB1AuthSessions: { method: "GET"; path: "/api/v1/auth/sessions"; response: B1AnyData; };
  revokeB1AuthSession: { method: "POST"; path: "/api/v1/auth/sessions/{sessionId}/revoke"; response: B1AnyData; };
  getB1OnboardingOptions: { method: "GET"; path: "/api/v1/onboarding/options"; response: B1AnyData; };
  getB1OnboardingProfile: { method: "GET"; path: "/api/v1/onboarding/profile"; response: B1AnyData; };
  saveB1OnboardingProfile: { method: "POST"; path: "/api/v1/onboarding/profile"; response: B1AnyData; };
  patchB1OnboardingProfile: { method: "PATCH"; path: "/api/v1/onboarding/profile"; response: B1AnyData; };
  createB1FirstGoal: { method: "POST"; path: "/api/v1/onboarding/goals/first"; response: B1AnyData; };
  getB1DailyTasks: { method: "GET"; path: "/api/v1/onboarding/daily-tasks/today"; response: B1AnyData; };
  completeB1DailyTask: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/{taskId}/complete"; response: B1AnyData; };
  reorderB1DailyTasks: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/reorder"; response: B1AnyData; };
  skipB1Placement: { method: "POST"; path: "/api/v1/assessment/placement/skip"; response: B1AnyData; };
  getB1PlacementReport: { method: "GET"; path: "/api/v1/assessment/placement/report/{sessionId}"; response: B1AnyData; };
  getB1HomeFeed: { method: "GET"; path: "/api/v1/home/feed"; response: B1AnyData; };
  getB1ContinueContext: { method: "GET"; path: "/api/v1/learning/continue-context"; response: B1AnyData; };
  saveB1ContinueContext: { method: "PUT"; path: "/api/v1/learning/continue-context"; response: B1AnyData; };
  saveB1LearningCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{lessonId}"; response: B1AnyData; };
  getB1UserProfile: { method: "GET"; path: "/api/v1/user/profile"; response: B1AnyData; };
  patchB1UserProfile: { method: "PATCH"; path: "/api/v1/user/profile"; response: B1AnyData; };
  getB1LearningPreferences: { method: "GET"; path: "/api/v1/user/learning-preferences"; response: B1AnyData; };
  patchB1LearningPreferences: { method: "PATCH"; path: "/api/v1/user/learning-preferences"; response: B1AnyData; };
  getB1PrivacySettings: { method: "GET"; path: "/api/v1/user/privacy"; response: B1AnyData; };
  patchB1PrivacySettings: { method: "PATCH"; path: "/api/v1/user/privacy"; response: B1AnyData; };
  getB1NotificationPreferences: { method: "GET"; path: "/api/v1/user/notifications"; response: B1AnyData; };
  patchB1NotificationPreferences: { method: "PATCH"; path: "/api/v1/user/notifications"; response: B1AnyData; };
  kickB1UserDevice: { method: "POST"; path: "/api/v1/user/devices/{devicePublicId}/kick"; response: B1AnyData; };
  listB1LoginAlerts: { method: "GET"; path: "/api/v1/user/login-alerts"; response: B1AnyData; };
  getB1DeletionStatus: { method: "GET"; path: "/api/v1/user/deletion"; response: B1AnyData; };
  requestB1Deletion: { method: "POST"; path: "/api/v1/user/deletion"; response: B1AnyData; };
  cancelB1Deletion: { method: "DELETE"; path: "/api/v1/user/deletion"; response: B1AnyData; };
}

export type GeneratedApiOperationId = keyof GeneratedApiOperationRegistry;
