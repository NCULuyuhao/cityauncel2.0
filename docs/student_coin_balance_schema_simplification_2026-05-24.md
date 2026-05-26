# Student coin balance schema simplification — 2026-05-24

## Decision

`student_coin_balances` has been removed from the active clean schema. The only value it stored was `barrage_coins`, and that value has a strict one-to-one relationship with `users.id`. Keeping a separate table forced every barrage / AI unlock / inquiry reward flow to perform extra `INSERT IGNORE`, `SELECT`, and `LEFT JOIN` operations.

The active schema now stores this state directly on `users`:

```sql
users.barrage_coins int NOT NULL DEFAULT 0
```

## Why this is still normalized

This does not duplicate data: each user has exactly one current coin balance. The value depends on the primary key of `users`, not on another repeating entity. Rewards, unlocked cards, inquiry records, and logs remain in child tables because they are one-to-many histories or many-to-many relationships.

## Code paths updated

- `backend/src/services/users.js`
- `backend/src/routes/barrage.routes.js`
- `backend/src/routes/ai.routes.js`
- `backend/src/routes/inquiry.routes.js`
- `backend/src/routes/teacher.routes.js`
- `database/cityauncel_database_rebuild_clean.sql`
- `database/cityauncel_game_system_users.sql`
- `database/cityauncel_game_system_routines.sql`
- `database/README.md`

## Migration

For an existing database, run:

```sql
SOURCE database/migrations/2026_05_24_merge_student_coin_balance_into_users.sql;
```

For a clean rebuild, run:

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```
