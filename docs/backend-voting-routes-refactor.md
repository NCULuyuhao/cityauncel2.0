# Backend voting routes refactor

## Summary

This refactor moves suspect voting and final decision settlement APIs out of `backend/src/app.js` into `backend/src/routes/voting.routes.js`.

## Moved API endpoints

- `GET /api/final-decision-settlement`
- `POST /api/final-decision-settlement`
- `POST /api/final-decision-settlement/close`
- `GET /api/suspect-voting-status`
- `PUT /api/suspect-voting-status`
- `POST /api/suspect-votes`
- `POST /api/suspect-voting-finish`

## Moved logic

- Suspect role definitions and ranking validation
- Suspect votes table creation / migration compatibility
- Suspect voting payload calculation
- Suspect voting winner resolution
- Decision card scoring metadata
- Final decision settlement calculation

## Notes

Frontend API paths remain unchanged. The database cleanup flow in `app.js` still uses `votingService.buildSuspectVotingPayload()` so realtime updates after clearing data continue to work.
