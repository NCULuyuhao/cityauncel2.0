# Inquiry snapshot card factory refactor

## What changed

This refactor extracts snapshot card construction from `frontend/src/pages/InquiryData.tsx` into:

- `frontend/src/features/inquiry/snapshots/snapshotCardFactory.ts`

The extracted module owns:

- Creating interactive snapshot game card objects.
- Compacting `snapshotMeta` before it is attached to a card.
- Choosing the persisted uploaded image URL before falling back to generated SVG preview data.
- Restoring dynamic snapshot cards from stored draft/unlocked-card data.
- Normalizing default snapshot card titles, source type, timestamps, and shared-card metadata.

## Why

`InquiryData.tsx` should coordinate the capture flow, user state, persistence calls, and UI. It should not also contain the card object factory rules. Keeping snapshot card construction in one module makes future changes safer, especially around:

- Snapshot title/id rules.
- Snapshot image URL vs SVG fallback behavior.
- `snapshotMeta` payload compaction.
- Compatibility with older stored card fields.

## Safety notes

The main snapshot flow remains in `InquiryData.tsx`:

- Opening capture mode.
- Capturing DOM/image data.
- Uploading snapshot images.
- Adding the created card to state.
- Logging activity and persisting investigation cards.

Only the pure card-object creation and restoration rules were moved.
