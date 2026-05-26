# Frontend API / draft storage refactor v20

## Scope

This refactor continues the frontend API/storage consolidation after v19.

## Added modules

- `frontend/src/api/cardPackApi.ts`
  - wraps `/api/me`
  - wraps `/api/group-card-pack-lock` read/write
- `frontend/src/api/teacherDashboardApi.ts`
  - wraps `/api/teacher/learning-dashboard`
- `frontend/src/storage/inquiryDraftStorage.ts`
  - centralizes inquiry draft JSON read/save/remove helpers
  - preserves the minimal fallback save path for localStorage quota failures

## Updated pages

- `CardPackPage.tsx`
  - removed page-local API base/path helper
  - removed direct fetch calls for current user and group card pack lock
- `BehaviorRecord.tsx`
  - removed page-local API base and direct fetch
- `InquiryData.tsx`
  - inquiry draft localStorage access now goes through `inquiryDraftStorage`

## Behavior

No API routes were changed. This is an internal organization refactor only.
