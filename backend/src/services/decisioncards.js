/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 decisioncards 共用服務，集中處理可被多個 API 重用的資料庫或業務邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

function createDecisioncardService({ pool, GROUPS, parseJSON, tableExists, tableHasColumn }) {
  const CARD_COLUMNS = ["selected_card_id_1", "selected_card_id_2", "selected_card_id_3"];

  async function dropColumnIfExists(tableName, columnName) {
    if (await tableHasColumn(tableName, columnName)) {
      await pool.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
    }
  }

  async function renameTableIfNeeded(oldTableName, newTableName) {
    const oldTableExists = await tableExists(oldTableName);
    const newTableExists = await tableExists(newTableName);

    if (oldTableExists && !newTableExists) {
      await pool.query(`RENAME TABLE \`${oldTableName}\` TO \`${newTableName}\``);
    }
  }

  function normalizeCardIds(cardIds) {
    return Array.from(new Set(Array.isArray(cardIds) ? cardIds : []))
      .map((cardId) => String(cardId).trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  function padCardIds(cardIds) {
    const normalized = normalizeCardIds(cardIds);
    return [normalized[0] || null, normalized[1] || null, normalized[2] || null];
  }

  function parseLegacyCardIdsFromRow(row) {
    if (!row) return [];
    if (typeof row.selected_card_ids_text === "string" && row.selected_card_ids_text.trim()) {
      return normalizeCardIds(row.selected_card_ids_text.split("\n"));
    }
    const selectedCardIds = parseJSON(row.selected_card_ids, []);
    return normalizeCardIds(selectedCardIds);
  }

  function parseCardIdsFromRow(row) {
    if (!row) return [];
    const columnCardIds = CARD_COLUMNS
      .map((columnName) => row[columnName])
      .map((cardId) => (cardId == null ? "" : String(cardId).trim()))
      .filter(Boolean);
    if (columnCardIds.length > 0) return normalizeCardIds(columnCardIds);
    return parseLegacyCardIdsFromRow(row);
  }

  async function ensureCardColumns(tableName, afterColumnName) {
    let afterColumn = afterColumnName;
    for (const columnName of CARD_COLUMNS) {
      if (!(await tableHasColumn(tableName, columnName))) {
        await pool.query(
          `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` VARCHAR(100) NULL AFTER \`${afterColumn}\``
        );
      }
      afterColumn = columnName;
    }
  }

  async function migrateLegacySelectedCardIdsJson(tableName) {
    if (!(await tableHasColumn(tableName, "selected_card_ids"))) return;

    const [rows] = await pool.query(
      `SELECT id, selected_card_ids, selected_card_id_1, selected_card_id_2, selected_card_id_3
       FROM \`${tableName}\`
       WHERE selected_card_ids IS NOT NULL`
    );

    for (const row of rows) {
      const currentCardIds = parseCardIdsFromRow(row);
      if (currentCardIds.length > 0) continue;
      const cardIds = parseLegacyCardIdsFromRow(row);
      if (cardIds.length === 0) continue;
      await pool.query(
        `UPDATE \`${tableName}\`
         SET selected_card_id_1 = ?, selected_card_id_2 = ?, selected_card_id_3 = ?
         WHERE id = ?`,
        [...padCardIds(cardIds), row.id]
      );
    }
  }

  async function migrateLegacyChildTable({ parentTable, childTable, parentColumnName }) {
    if (!(await tableExists(childTable))) return;

    const [rows] = await pool.query(
      `SELECT \`${parentColumnName}\` AS parent_id,
              GROUP_CONCAT(card_id ORDER BY card_order ASC SEPARATOR '\n') AS selected_card_ids_text
       FROM \`${childTable}\`
       GROUP BY \`${parentColumnName}\``
    );

    for (const row of rows) {
      const cardIds = parseLegacyCardIdsFromRow(row);
      if (cardIds.length === 0) continue;
      await pool.query(
        `UPDATE \`${parentTable}\`
         SET selected_card_id_1 = ?, selected_card_id_2 = ?, selected_card_id_3 = ?
         WHERE id = ?`,
        [...padCardIds(cardIds), row.parent_id]
      );
    }

    await pool.query(`DROP TABLE IF EXISTS \`${childTable}\``);
  }

  async function ensureDecisioncardLogsTable() {
    await renameTableIfNeeded("group_card_pack_lock_logs", "decisioncard_logs");
    await renameTableIfNeeded("group_card_pack_lock_events", "decisioncard_logs");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        group_id VARCHAR(64) NOT NULL,
        action_type VARCHAR(64) NOT NULL DEFAULT 'lock',
        selected_card_id_1 VARCHAR(100) NULL,
        selected_card_id_2 VARCHAR(100) NULL,
        selected_card_id_3 VARCHAR(100) NULL,
        locked_by_user_id INT NULL,
        lock_reason TEXT NULL,
        locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_decisioncard_logs_group_id_created_at (group_id, created_at),
        KEY idx_decisioncard_logs_locked_by_user_id (locked_by_user_id),
        KEY idx_decisioncard_logs_action_type (action_type),
        KEY idx_decisioncard_logs_locked_at (locked_at),
        KEY idx_decisioncard_logs_card_1 (selected_card_id_1),
        KEY idx_decisioncard_logs_card_2 (selected_card_id_2),
        KEY idx_decisioncard_logs_card_3 (selected_card_id_3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    if (!(await tableHasColumn("decisioncard_logs", "action_type"))) {
      await pool.query("ALTER TABLE decisioncard_logs ADD COLUMN action_type VARCHAR(64) NOT NULL DEFAULT 'lock' AFTER group_id");
    }

    await ensureCardColumns("decisioncard_logs", "action_type");

    const requiredColumnSpecs = [
      ["locked_by_user_id", "ALTER TABLE decisioncard_logs ADD COLUMN locked_by_user_id INT NULL AFTER selected_card_id_3"],
      ["lock_reason", "ALTER TABLE decisioncard_logs ADD COLUMN lock_reason TEXT NULL AFTER locked_by_user_id"],
      ["locked_at", "ALTER TABLE decisioncard_logs ADD COLUMN locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER lock_reason"],
      ["created_at", "ALTER TABLE decisioncard_logs ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ];

    for (const [columnName, alterSql] of requiredColumnSpecs) {
      if (!(await tableHasColumn("decisioncard_logs", columnName))) {
        await pool.query(alterSql);
      }
    }

    await migrateLegacyChildTable({
      parentTable: "decisioncard_logs",
      childTable: "decisioncard_log_cards",
      parentColumnName: "decisioncard_log_id",
    });
    await migrateLegacySelectedCardIdsJson("decisioncard_logs");

    if (await tableHasColumn("decisioncard_logs", "actor_user_id")) {
      await pool.query(
        `UPDATE decisioncard_logs
         SET locked_by_user_id = COALESCE(locked_by_user_id, actor_user_id)
         WHERE actor_user_id IS NOT NULL`
      );
      await dropColumnIfExists("decisioncard_logs", "actor_user_id");
    }

    const duplicateColumns = [
      "selected_card_ids",
      "actor_username",
      "actor_role",
      "previous_selected_card_ids",
      "previous_lock_reason",
      "metadata",
    ];

    for (const columnName of duplicateColumns) {
      await dropColumnIfExists("decisioncard_logs", columnName);
    }
  }

  async function ensureDecisioncardsTable() {
    await renameTableIfNeeded("group_card_pack_locks", "decisioncards");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        group_id VARCHAR(64) NOT NULL,
        selected_card_id_1 VARCHAR(100) NULL,
        selected_card_id_2 VARCHAR(100) NULL,
        selected_card_id_3 VARCHAR(100) NULL,
        locked_by_user_id INT NOT NULL,
        lock_reason TEXT NULL,
        locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncards_group_id (group_id),
        KEY idx_decisioncards_locked_by_user_id (locked_by_user_id),
        KEY idx_decisioncards_card_1 (selected_card_id_1),
        KEY idx_decisioncards_card_2 (selected_card_id_2),
        KEY idx_decisioncards_card_3 (selected_card_id_3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await ensureCardColumns("decisioncards", "group_id");
    if (!(await tableHasColumn("decisioncards", "lock_reason"))) {
      await pool.query("ALTER TABLE decisioncards ADD COLUMN lock_reason TEXT NULL AFTER locked_by_user_id");
    }
    if (!(await tableHasColumn("decisioncards", "locked_at"))) {
      await pool.query("ALTER TABLE decisioncards ADD COLUMN locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER lock_reason");
    }
    if (!(await tableHasColumn("decisioncards", "updated_at"))) {
      await pool.query("ALTER TABLE decisioncards ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER locked_at");
    }

    await migrateLegacyChildTable({
      parentTable: "decisioncards",
      childTable: "decisioncard_cards",
      parentColumnName: "decisioncard_id",
    });
    await migrateLegacySelectedCardIdsJson("decisioncards");
    await dropColumnIfExists("decisioncards", "selected_card_ids");

    await ensureDecisioncardLogsTable();
  }

  function normalizeDecisioncardRow(row) {
    if (!row) return null;
    return {
      id: Number(row.id) || null,
      groupId: row.group_id,
      selectedCardIds: parseCardIdsFromRow(row),
      lockedBy: row.locked_by_user_id || null,
      lockedByName: row.locked_by_name || null,
      reason: row.lock_reason || "",
      lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  function buildDecisioncardSelectSql({ whereSql = "" } = {}) {
    return `SELECT l.id, l.group_id,
                   l.selected_card_id_1, l.selected_card_id_2, l.selected_card_id_3,
                   l.locked_by_user_id, u.username AS locked_by_name,
                   l.lock_reason, l.locked_at, l.updated_at
            FROM decisioncards l
            LEFT JOIN users u ON u.id = l.locked_by_user_id
            ${whereSql}`;
  }

  async function getDecisioncardByGroupId(groupId, { connection = pool, forUpdate = false } = {}) {
    if (!groupId) return null;
    await ensureDecisioncardsTable();
    const [rows] = await connection.query(
      `${buildDecisioncardSelectSql({ whereSql: "WHERE l.group_id = ?" })} ${forUpdate ? "FOR UPDATE" : ""}`,
      [groupId]
    );
    return normalizeDecisioncardRow(rows[0]);
  }

  async function getAllDecisioncards({ connection = pool, forUpdate = false } = {}) {
    await ensureDecisioncardsTable();
    const [rows] = await connection.query(
      `${buildDecisioncardSelectSql()} ORDER BY l.group_id ASC ${forUpdate ? "FOR UPDATE" : ""}`
    );
    return rows.map(normalizeDecisioncardRow).filter(Boolean);
  }

  async function upsertDecisioncard({ connection = pool, groupId, lockedByUserId, selectedCardIds, lockReason }) {
    const [cardId1, cardId2, cardId3] = padCardIds(selectedCardIds);
    const [result] = await connection.query(
      `INSERT INTO decisioncards (
         group_id, selected_card_id_1, selected_card_id_2, selected_card_id_3,
         locked_by_user_id, lock_reason, locked_at
       ) VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         selected_card_id_1 = VALUES(selected_card_id_1),
         selected_card_id_2 = VALUES(selected_card_id_2),
         selected_card_id_3 = VALUES(selected_card_id_3),
         locked_by_user_id = VALUES(locked_by_user_id),
         lock_reason = VALUES(lock_reason),
         locked_at = VALUES(locked_at),
         updated_at = CURRENT_TIMESTAMP`,
      [groupId, cardId1, cardId2, cardId3, lockedByUserId, lockReason]
    );

    return Number(result.insertId);
  }

  async function insertDecisioncardLog({
    connection = pool,
    groupId,
    actionType,
    lockedByUserId = null,
    selectedCardIds = null,
    lockReason = null,
  }) {
    if (!groupId || !actionType) return null;

    const [cardId1, cardId2, cardId3] = padCardIds(selectedCardIds);
    const [result] = await connection.query(
      `INSERT INTO decisioncard_logs (
        group_id, action_type, selected_card_id_1, selected_card_id_2, selected_card_id_3,
        locked_by_user_id, lock_reason, locked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [groupId, actionType, cardId1, cardId2, cardId3, lockedByUserId, lockReason]
    );

    return Number(result.insertId);
  }

  async function buildTeacherDecisioncardsPayload() {
    const locks = await getAllDecisioncards();
    const lockByGroupId = new Map(locks.map((lock) => [String(lock.groupId), lock]));

    return {
      groups: Object.entries(GROUPS).map(([groupId, group]) => {
        const lock = lockByGroupId.get(groupId);
        return {
          groupId,
          groupName: group.name,
          isLocked: Boolean(lock),
          selectedCardIds: lock?.selectedCardIds || [],
          reason: lock?.reason || "",
          lockedBy: lock?.lockedBy || null,
          lockedByName: lock?.lockedByName || null,
          lockedAt: lock?.lockedAt || null,
          updatedAt: lock?.updatedAt || null,
        };
      }),
    };
  }

  return {
    ensureDecisioncardsTable,
    normalizeDecisioncardRow,
    insertDecisioncardLog,
    buildTeacherDecisioncardsPayload,
    getDecisioncardByGroupId,
    getAllDecisioncards,
    upsertDecisioncard,
  };
}

module.exports = { createDecisioncardService };
