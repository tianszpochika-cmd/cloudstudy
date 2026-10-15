# Read-only restoration race review

Scope: `auth/navigation.ts`, current `stores/session.ts`, onboarding `onShow/loadResume` and settings access hook. No new browser group or product edits were made for this review.

The current session defines authentication as status exactly `authenticated` plus an established in-memory identity. `refreshSilently()` deliberately sets status `refreshing` before awaiting its request, so authentication is false during that interval. This is a valid closed gate and should not be relaxed to grant learner access.

`restore()` first returns when `restored` is already true, before considering an existing `refreshPromise`. Both `revalidateProtected()` and `resolveBlockedNavigation()` await `restore()` and then immediately route to login if authentication is false. Onboarding's `onShow → loadResume → refreshSilentlyForIdentity` may start a refresh while a hash/settings navigation revalidation remains queued. `gateTail` serializes navigation revalidations, but does not include the page's refresh operation. A revalidation that runs in that interval can therefore interpret a verified refresh still in flight as logged out and navigate to login even if refresh later succeeds.

This is a source-supported race candidate, not independent runtime proof of the reported restoring-success failure. A minimal metadata timeline should distinguish: route/guard phase, session status, identity revision, request method/path/status, refresh pending/released and login navigation order. Do not log identity values or credentials.

If that timeline confirms login navigation while status is refreshing before refresh200 settles, the smallest shared fix is for `restore()` or the guard's settle boundary to await the existing refresh promise before deciding authenticated versus login. Keep strict authenticated/owner/epoch checks after settlement, and keep 401, logout or owner changes closed. Do not skip the guard or treat refreshing as authenticated. Test both success and401, including concurrent hash/onShow revalidation and late responses after logout.
