# Backend teacher routes refactor

This refactor moves active teacher-side APIs out of `backend/src/app.js` and into `backend/src/routes/teacher.routes.js` while preserving the same public API paths used by the frontend.

## Moved endpoints

- `GET /api/teacher/group-card-pack-locks`
- `DELETE /api/teacher/group-card-pack-locks/:groupId`
- `DELETE /api/teacher/group-card-pack-locks`
- `GET /api/teacher/players`
- `PUT /api/teacher/players/groups`
- `GET /api/teacher/learning-dashboard`
- `DELETE /api/teacher/database-data`

## Notes

- Frontend request paths were not changed.
- Decision-card helper functions remain in `app.js` for now because the student card-pack lock endpoint still uses them.
- Learning-dashboard helper functions were moved with the route because they are only used by the teacher dashboard.
- Database-clear logic remains teacher-only and still publishes realtime reset events after clearing student data.

## Verification

Validated with:

```bash
npm run check
npm run build:frontend
```
