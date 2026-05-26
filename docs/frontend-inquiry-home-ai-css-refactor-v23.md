# Frontend inquiry/home/AI/CSS refactor v23

## Summary

This pass continues the safe refactor from v22. The goals were to reduce large page responsibilities, move flow logic into hooks, split AI helper UI, extract home realtime/task synchronization, and split the global CSS file while preserving behavior and API routes.

## Changes

### InquiryData

Added:

- `frontend/src/features/inquiry/hooks/useInquirySubmission.ts`
- `frontend/src/features/inquiry/hooks/useInquiryIntroFlow.ts`

Moved out of `InquiryData.tsx`:

- Final inquiry summary submission flow
- Persist-current-investigation flow
- Current-round investigation card building
- Intro stage record construction
- Intro follow-up reset logic
- Suspect/target toggle logic
- Finish intro and ready-stage transition logic

`InquiryData.tsx` is now primarily responsible for wiring state to UI and invoking the hooks.

### AI helper

Added:

- `AiHelperCoinPrompt.tsx`
- `AiHelperNeedOptionPanel.tsx`
- `AiHelperToggleButton.tsx`

Moved out of `AiInquiryAssistant.tsx`:

- Coin prompt UI
- Need option selection UI
- Floating toggle button UI

### HomePage

Added:

- `frontend/src/features/home/hooks/useHomeTeacherControlState.ts`
- `frontend/src/features/home/hooks/useHomeRealtime.ts`

Moved out of `HomePage.tsx`:

- Teacher task-state polling/focus refresh
- SSE realtime event handling
- Database-clear reset handling wrapper

### CSS

Split `frontend/src/styles/global.css` into smaller ordered files:

- `font.css`
- `responsive-safety.css`
- `game-theme.css`
- `readability.css`
- `pastel-theme.css`
- `responsive-layout.css`
- `desktop-layout.css`

`global.css` is now an import hub that preserves the original cascade order.

## Verification

Passed:

```bash
npm run check
npm run build:frontend
```
