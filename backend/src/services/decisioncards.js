/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 decisioncards 共用服務，集中處理可被多個 API 重用的資料庫或業務邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

function createDecisioncardService({ pool, GROUPS, parseJSON, tableExists, tableHasColumn }) {
  const CARD_COLUMNS = ["selected_card_id_1", "selected_card_id_2", "selected_card_id_3"];
  const GROUPS_COUNT = Object.keys(GROUPS || {}).length || 6;
  let decisioncardsSchemaEnsured = false;


  async function ensureColumnIfMissing(tableName, columnName, alterSql) {
    if (!(await tableHasColumn(tableName, columnName))) {
      await pool.query(alterSql);
    }
  }

  async function modifyColumnIfExists(tableName, columnName, alterSql) {
    if (await tableHasColumn(tableName, columnName)) {
      await pool.query(alterSql);
    }
  }

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
        round_no INT NOT NULL DEFAULT 1,
        selected_card_id_1 VARCHAR(100) NULL,
        selected_card_id_2 VARCHAR(100) NULL,
        selected_card_id_3 VARCHAR(100) NULL,
        core_card_id VARCHAR(100) NULL,
        locked_by_user_id INT NULL,
        lock_reason TEXT NULL,
        locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_decisioncard_logs_group_id_created_at (group_id, created_at),
        KEY idx_decisioncard_logs_locked_by_user_id (locked_by_user_id),
        KEY idx_decisioncard_logs_action_type (action_type),
        KEY idx_decisioncard_logs_round (round_no),
        KEY idx_decisioncard_logs_locked_at (locked_at),
        KEY idx_decisioncard_logs_card_1 (selected_card_id_1),
        KEY idx_decisioncard_logs_card_2 (selected_card_id_2),
        KEY idx_decisioncard_logs_card_3 (selected_card_id_3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    if (!(await tableHasColumn("decisioncard_logs", "action_type"))) {
      await pool.query("ALTER TABLE decisioncard_logs ADD COLUMN action_type VARCHAR(64) NOT NULL DEFAULT 'lock' AFTER group_id");
    }

    await ensureColumnIfMissing("decisioncard_logs", "round_no", "ALTER TABLE decisioncard_logs ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER action_type");
    await ensureCardColumns("decisioncard_logs", "action_type");
    await ensureColumnIfMissing("decisioncard_logs", "core_card_id", "ALTER TABLE decisioncard_logs ADD COLUMN core_card_id VARCHAR(100) NULL AFTER selected_card_id_3");

    const requiredColumnSpecs = [
      ["locked_by_user_id", "ALTER TABLE decisioncard_logs ADD COLUMN locked_by_user_id INT NULL AFTER core_card_id"],
      ["lock_reason", "ALTER TABLE decisioncard_logs ADD COLUMN lock_reason TEXT NULL AFTER locked_by_user_id"],
      ["locked_at", "ALTER TABLE decisioncard_logs ADD COLUMN locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER lock_reason"],
      ["created_at", "ALTER TABLE decisioncard_logs ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ];

    for (const [columnName, alterSql] of requiredColumnSpecs) {
      if (!(await tableHasColumn("decisioncard_logs", columnName))) {
        await pool.query(alterSql);
      }
    }


    await ensureColumnIfMissing("decisioncard_group_scores", "round_no", "ALTER TABLE decisioncard_group_scores ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_group_scores", "group_id", "ALTER TABLE decisioncard_group_scores ADD COLUMN group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_group_scores", "accepted_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN accepted_count INT NOT NULL DEFAULT 0 AFTER group_id");
    await ensureColumnIfMissing("decisioncard_group_scores", "rejected_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN rejected_count INT NOT NULL DEFAULT 0 AFTER accepted_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "reserved_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN reserved_count INT NOT NULL DEFAULT 0 AFTER rejected_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "accepted_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN accepted_score INT NOT NULL DEFAULT 0 AFTER reserved_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "rejected_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN rejected_score INT NOT NULL DEFAULT 0 AFTER accepted_score");
    await ensureColumnIfMissing("decisioncard_group_scores", "core_bonus", "ALTER TABLE decisioncard_group_scores ADD COLUMN core_bonus INT NOT NULL DEFAULT 0 AFTER rejected_score");
    await ensureColumnIfMissing("decisioncard_group_scores", "score_delta", "ALTER TABLE decisioncard_group_scores ADD COLUMN score_delta INT NOT NULL DEFAULT 0 AFTER core_bonus");
    await ensureColumnIfMissing("decisioncard_group_scores", "cumulative_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN cumulative_score INT NOT NULL DEFAULT 0 AFTER score_delta");
    await ensureColumnIfMissing("decisioncard_group_scores", "settled_at", "ALTER TABLE decisioncard_group_scores ADD COLUMN settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER cumulative_score");

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

  async function ensureDecisioncardsTable({ force = false } = {}) {
    if (decisioncardsSchemaEnsured && !force) return;
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
    if (!(await tableHasColumn("decisioncards", "round_no"))) {
      await pool.query("ALTER TABLE decisioncards ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER group_id");
    }
    if (!(await tableHasColumn("decisioncards", "core_card_id"))) {
      await pool.query("ALTER TABLE decisioncards ADD COLUMN core_card_id VARCHAR(100) NULL AFTER selected_card_id_3");
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_votes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        proposal_group_id VARCHAR(64) NOT NULL,
        card_id VARCHAR(100) NOT NULL,
        voter_group_id VARCHAR(64) NOT NULL,
        voter_user_id INT NOT NULL,
        vote_type ENUM('agree','reject') NOT NULL,
        voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_vote (round_no, card_id, voter_group_id),
        KEY idx_decisioncard_votes_round_card (round_no, card_id),
        KEY idx_decisioncard_votes_voter_group (voter_group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_vote_submissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        voter_group_id VARCHAR(64) NOT NULL,
        voter_user_id INT NOT NULL,
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_vote_submission (round_no, voter_group_id),
        KEY idx_decisioncard_vote_submissions_round (round_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_vote_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        proposal_group_id VARCHAR(64) NOT NULL,
        card_id VARCHAR(100) NOT NULL,
        voter_group_id VARCHAR(64) NOT NULL,
        voter_user_id INT NOT NULL,
        vote_type ENUM('agree','reject','keep') NOT NULL DEFAULT 'keep',
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_vote_record (round_no, card_id, voter_group_id),
        KEY idx_decisioncard_vote_records_round_card (round_no, card_id),
        KEY idx_decisioncard_vote_records_voter_group (voter_group_id),
        KEY idx_decisioncard_vote_records_proposal_group (proposal_group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_accepted_cards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        group_id VARCHAR(64) NOT NULL,
        card_id VARCHAR(100) NOT NULL,
        core_card TINYINT(1) NOT NULL DEFAULT 0,
        agree_count INT NOT NULL DEFAULT 0,
        reject_count INT NOT NULL DEFAULT 0,
        accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_accepted_card (card_id),
        KEY idx_decisioncard_accepted_round (round_no),
        KEY idx_decisioncard_accepted_group (group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );


    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_round_state (
        id TINYINT NOT NULL DEFAULT 1,
        current_round_no INT NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await pool.query("INSERT IGNORE INTO decisioncard_round_state (id, current_round_no) VALUES (1, 1)");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_round_results (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        group_id VARCHAR(64) NOT NULL,
        card_id VARCHAR(100) NOT NULL,
        core_card TINYINT(1) NOT NULL DEFAULT 0,
        agree_count INT NOT NULL DEFAULT 0,
        reject_count INT NOT NULL DEFAULT 0,
        keep_count INT NOT NULL DEFAULT 0,
        result ENUM('accepted','rejected','reserved') NOT NULL DEFAULT 'reserved',
        reason TEXT NULL,
        settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_round_result (round_no, card_id),
        KEY idx_decisioncard_round_results_round (round_no),
        KEY idx_decisioncard_round_results_group (group_id),
        KEY idx_decisioncard_round_results_result (result)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );



    await pool.query(
      `CREATE TABLE IF NOT EXISTS decisioncard_group_scores (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        round_no INT NOT NULL,
        group_id VARCHAR(64) NOT NULL,
        accepted_count INT NOT NULL DEFAULT 0,
        rejected_count INT NOT NULL DEFAULT 0,
        reserved_count INT NOT NULL DEFAULT 0,
        accepted_score INT NOT NULL DEFAULT 0,
        rejected_score INT NOT NULL DEFAULT 0,
        core_bonus INT NOT NULL DEFAULT 0,
        score_delta INT NOT NULL DEFAULT 0,
        cumulative_score INT NOT NULL DEFAULT 0,
        settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_decisioncard_group_score_round (round_no, group_id),
        KEY idx_decisioncard_group_scores_group (group_id),
        KEY idx_decisioncard_group_scores_round (round_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await ensureColumnIfMissing("decisioncard_votes", "round_no", "ALTER TABLE decisioncard_votes ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_votes", "proposal_group_id", "ALTER TABLE decisioncard_votes ADD COLUMN proposal_group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_votes", "card_id", "ALTER TABLE decisioncard_votes ADD COLUMN card_id VARCHAR(100) NOT NULL DEFAULT '' AFTER proposal_group_id");
    await ensureColumnIfMissing("decisioncard_votes", "voter_group_id", "ALTER TABLE decisioncard_votes ADD COLUMN voter_group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER card_id");
    await ensureColumnIfMissing("decisioncard_votes", "voter_user_id", "ALTER TABLE decisioncard_votes ADD COLUMN voter_user_id INT NOT NULL DEFAULT 0 AFTER voter_group_id");
    await ensureColumnIfMissing("decisioncard_votes", "vote_type", "ALTER TABLE decisioncard_votes ADD COLUMN vote_type ENUM('agree','reject') NOT NULL DEFAULT 'agree' AFTER voter_user_id");
    await ensureColumnIfMissing("decisioncard_votes", "voted_at", "ALTER TABLE decisioncard_votes ADD COLUMN voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER vote_type");
    await ensureColumnIfMissing("decisioncard_votes", "updated_at", "ALTER TABLE decisioncard_votes ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER voted_at");
    await modifyColumnIfExists("decisioncard_votes", "vote_type", "ALTER TABLE decisioncard_votes MODIFY COLUMN vote_type ENUM('agree','reject') NOT NULL");

    await ensureColumnIfMissing("decisioncard_vote_submissions", "round_no", "ALTER TABLE decisioncard_vote_submissions ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_vote_submissions", "voter_group_id", "ALTER TABLE decisioncard_vote_submissions ADD COLUMN voter_group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_vote_submissions", "voter_user_id", "ALTER TABLE decisioncard_vote_submissions ADD COLUMN voter_user_id INT NOT NULL DEFAULT 0 AFTER voter_group_id");
    await ensureColumnIfMissing("decisioncard_vote_submissions", "submitted_at", "ALTER TABLE decisioncard_vote_submissions ADD COLUMN submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER voter_user_id");
    await ensureColumnIfMissing("decisioncard_vote_submissions", "updated_at", "ALTER TABLE decisioncard_vote_submissions ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at");


    await ensureColumnIfMissing("decisioncard_vote_records", "round_no", "ALTER TABLE decisioncard_vote_records ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_vote_records", "proposal_group_id", "ALTER TABLE decisioncard_vote_records ADD COLUMN proposal_group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_vote_records", "card_id", "ALTER TABLE decisioncard_vote_records ADD COLUMN card_id VARCHAR(100) NOT NULL DEFAULT '' AFTER proposal_group_id");
    await ensureColumnIfMissing("decisioncard_vote_records", "voter_group_id", "ALTER TABLE decisioncard_vote_records ADD COLUMN voter_group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER card_id");
    await ensureColumnIfMissing("decisioncard_vote_records", "voter_user_id", "ALTER TABLE decisioncard_vote_records ADD COLUMN voter_user_id INT NOT NULL DEFAULT 0 AFTER voter_group_id");
    await ensureColumnIfMissing("decisioncard_vote_records", "vote_type", "ALTER TABLE decisioncard_vote_records ADD COLUMN vote_type ENUM('agree','reject','keep') NOT NULL DEFAULT 'keep' AFTER voter_user_id");
    await ensureColumnIfMissing("decisioncard_vote_records", "submitted_at", "ALTER TABLE decisioncard_vote_records ADD COLUMN submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER vote_type");
    await ensureColumnIfMissing("decisioncard_vote_records", "updated_at", "ALTER TABLE decisioncard_vote_records ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at");
    await modifyColumnIfExists("decisioncard_vote_records", "vote_type", "ALTER TABLE decisioncard_vote_records MODIFY COLUMN vote_type ENUM('agree','reject','keep') NOT NULL DEFAULT 'keep'");

    await ensureColumnIfMissing("decisioncard_accepted_cards", "round_no", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "group_id", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "card_id", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN card_id VARCHAR(100) NOT NULL DEFAULT '' AFTER group_id");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "core_card", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN core_card TINYINT(1) NOT NULL DEFAULT 0 AFTER card_id");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "agree_count", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN agree_count INT NOT NULL DEFAULT 0 AFTER core_card");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "reject_count", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN reject_count INT NOT NULL DEFAULT 0 AFTER agree_count");
    await ensureColumnIfMissing("decisioncard_accepted_cards", "accepted_at", "ALTER TABLE decisioncard_accepted_cards ADD COLUMN accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER reject_count");

    await ensureColumnIfMissing("decisioncard_round_state", "current_round_no", "ALTER TABLE decisioncard_round_state ADD COLUMN current_round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_round_state", "updated_at", "ALTER TABLE decisioncard_round_state ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER current_round_no");

    await ensureColumnIfMissing("decisioncard_round_results", "round_no", "ALTER TABLE decisioncard_round_results ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_round_results", "group_id", "ALTER TABLE decisioncard_round_results ADD COLUMN group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_round_results", "card_id", "ALTER TABLE decisioncard_round_results ADD COLUMN card_id VARCHAR(100) NOT NULL DEFAULT '' AFTER group_id");
    await ensureColumnIfMissing("decisioncard_round_results", "core_card", "ALTER TABLE decisioncard_round_results ADD COLUMN core_card TINYINT(1) NOT NULL DEFAULT 0 AFTER card_id");
    await ensureColumnIfMissing("decisioncard_round_results", "agree_count", "ALTER TABLE decisioncard_round_results ADD COLUMN agree_count INT NOT NULL DEFAULT 0 AFTER core_card");
    await ensureColumnIfMissing("decisioncard_round_results", "reject_count", "ALTER TABLE decisioncard_round_results ADD COLUMN reject_count INT NOT NULL DEFAULT 0 AFTER agree_count");
    await ensureColumnIfMissing("decisioncard_round_results", "keep_count", "ALTER TABLE decisioncard_round_results ADD COLUMN keep_count INT NOT NULL DEFAULT 0 AFTER reject_count");
    await ensureColumnIfMissing("decisioncard_round_results", "result", "ALTER TABLE decisioncard_round_results ADD COLUMN result ENUM('accepted','rejected','reserved') NOT NULL DEFAULT 'reserved' AFTER keep_count");
    await ensureColumnIfMissing("decisioncard_round_results", "reason", "ALTER TABLE decisioncard_round_results ADD COLUMN reason TEXT NULL AFTER result");
    await ensureColumnIfMissing("decisioncard_round_results", "settled_at", "ALTER TABLE decisioncard_round_results ADD COLUMN settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER reason");
    await modifyColumnIfExists("decisioncard_round_results", "result", "ALTER TABLE decisioncard_round_results MODIFY COLUMN result ENUM('accepted','rejected','reserved') NOT NULL DEFAULT 'reserved'");


    await ensureColumnIfMissing("decisioncard_group_scores", "round_no", "ALTER TABLE decisioncard_group_scores ADD COLUMN round_no INT NOT NULL DEFAULT 1 AFTER id");
    await ensureColumnIfMissing("decisioncard_group_scores", "group_id", "ALTER TABLE decisioncard_group_scores ADD COLUMN group_id VARCHAR(64) NOT NULL DEFAULT '' AFTER round_no");
    await ensureColumnIfMissing("decisioncard_group_scores", "accepted_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN accepted_count INT NOT NULL DEFAULT 0 AFTER group_id");
    await ensureColumnIfMissing("decisioncard_group_scores", "rejected_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN rejected_count INT NOT NULL DEFAULT 0 AFTER accepted_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "reserved_count", "ALTER TABLE decisioncard_group_scores ADD COLUMN reserved_count INT NOT NULL DEFAULT 0 AFTER rejected_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "accepted_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN accepted_score INT NOT NULL DEFAULT 0 AFTER reserved_count");
    await ensureColumnIfMissing("decisioncard_group_scores", "rejected_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN rejected_score INT NOT NULL DEFAULT 0 AFTER accepted_score");
    await ensureColumnIfMissing("decisioncard_group_scores", "core_bonus", "ALTER TABLE decisioncard_group_scores ADD COLUMN core_bonus INT NOT NULL DEFAULT 0 AFTER rejected_score");
    await ensureColumnIfMissing("decisioncard_group_scores", "score_delta", "ALTER TABLE decisioncard_group_scores ADD COLUMN score_delta INT NOT NULL DEFAULT 0 AFTER core_bonus");
    await ensureColumnIfMissing("decisioncard_group_scores", "cumulative_score", "ALTER TABLE decisioncard_group_scores ADD COLUMN cumulative_score INT NOT NULL DEFAULT 0 AFTER score_delta");
    await ensureColumnIfMissing("decisioncard_group_scores", "settled_at", "ALTER TABLE decisioncard_group_scores ADD COLUMN settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER cumulative_score");

    await migrateLegacyChildTable({
      parentTable: "decisioncards",
      childTable: "decisioncard_cards",
      parentColumnName: "decisioncard_id",
    });
    await migrateLegacySelectedCardIdsJson("decisioncards");
    await dropColumnIfExists("decisioncards", "selected_card_ids");

    await ensureDecisioncardLogsTable();
    decisioncardsSchemaEnsured = true;
  }

  function normalizeDecisioncardRow(row) {
    if (!row) return null;
    return {
      id: Number(row.id) || null,
      groupId: row.group_id,
      selectedCardIds: parseCardIdsFromRow(row),
      roundNo: Number(row.round_no) || 1,
      coreCardId: row.core_card_id || null,
      lockedBy: row.locked_by_user_id || null,
      lockedByName: row.locked_by_name || null,
      reason: row.lock_reason || "",
      lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  function buildDecisioncardSelectSql({ whereSql = "" } = {}) {
    return `SELECT l.id, l.group_id, l.round_no, l.core_card_id,
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

  async function upsertDecisioncard({ connection = pool, groupId, lockedByUserId, selectedCardIds, lockReason, coreCardId = null, roundNo = 1 }) {
    const [cardId1, cardId2, cardId3] = padCardIds(selectedCardIds);
    const [result] = await connection.query(
      `INSERT INTO decisioncards (
         group_id, round_no, selected_card_id_1, selected_card_id_2, selected_card_id_3, core_card_id,
         locked_by_user_id, lock_reason, locked_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         round_no = VALUES(round_no),
         selected_card_id_1 = VALUES(selected_card_id_1),
         selected_card_id_2 = VALUES(selected_card_id_2),
         selected_card_id_3 = VALUES(selected_card_id_3),
         core_card_id = VALUES(core_card_id),
         locked_by_user_id = VALUES(locked_by_user_id),
         lock_reason = VALUES(lock_reason),
         locked_at = VALUES(locked_at),
         updated_at = CURRENT_TIMESTAMP`,
      [groupId, Number(roundNo) || 1, cardId1, cardId2, cardId3, coreCardId, lockedByUserId, lockReason]
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
    coreCardId = null,
    roundNo = 1,
  }) {
    if (!groupId || !actionType) return null;

    const [cardId1, cardId2, cardId3] = padCardIds(selectedCardIds);
    const [result] = await connection.query(
      `INSERT INTO decisioncard_logs (
        group_id, action_type, round_no, selected_card_id_1, selected_card_id_2, selected_card_id_3,
        core_card_id, locked_by_user_id, lock_reason, locked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [groupId, actionType, Number(roundNo) || 1, cardId1, cardId2, cardId3, coreCardId || null, lockedByUserId, lockReason]
    );

    return Number(result.insertId);
  }

  async function buildTeacherDecisioncardsPayload() {
    const locks = await getAllDecisioncards();
    const lockByGroupId = new Map(locks.map((lock) => [String(lock.groupId), lock]));

    return {
      groupScores: await getDecisioncardGroupScores(),
      groups: Object.entries(GROUPS).map(([groupId, group]) => {
        const lock = lockByGroupId.get(groupId);
        return {
          groupId,
          groupName: group.name,
          isLocked: Boolean(lock),
          selectedCardIds: lock?.selectedCardIds || [],
          coreCardId: lock?.coreCardId || null,
          roundNo: lock?.roundNo || 1,
          reason: lock?.reason || "",
          lockedBy: lock?.lockedBy || null,
          lockedByName: lock?.lockedByName || null,
          lockedAt: lock?.lockedAt || null,
          updatedAt: lock?.updatedAt || null,
        };
      }),
    };
  }


  async function getCurrentDecisionRound({ connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const [[stateRow]] = await connection.query("SELECT current_round_no AS roundNo FROM decisioncard_round_state WHERE id = 1");
    const stateRound = Number(stateRow?.roundNo) || 1;
    return Math.max(1, stateRound);
  }

  async function setCurrentDecisionRound(roundNo, { connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const nextRoundNo = Math.max(1, Number(roundNo) || 1);
    await connection.query(
      `INSERT INTO decisioncard_round_state (id, current_round_no)
       VALUES (1, ?)
       ON DUPLICATE KEY UPDATE current_round_no = VALUES(current_round_no), updated_at = CURRENT_TIMESTAMP`,
      [nextRoundNo]
    );
    return nextRoundNo;
  }

  async function getAcceptedDecisioncards({ connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const [rows] = await connection.query(
      `SELECT round_no AS roundNo, group_id AS groupId, card_id AS cardId,
              core_card AS coreCard, agree_count AS agreeCount, reject_count AS rejectCount,
              accepted_at AS acceptedAt
       FROM decisioncard_accepted_cards
       ORDER BY round_no ASC, id ASC`
    );
    return rows.map((row) => ({
      roundNo: Number(row.roundNo) || 1,
      groupId: row.groupId,
      cardId: row.cardId,
      coreCard: Boolean(row.coreCard),
      agreeCount: Number(row.agreeCount) || 0,
      rejectCount: Number(row.rejectCount) || 0,
      acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
    }));
  }

  async function getDecisioncardVoteSubmissions({ connection = pool, roundNo = null } = {}) {
    await ensureDecisioncardsTable();
    const params = [];
    const where = roundNo ? "WHERE round_no = ?" : "";
    if (roundNo) params.push(Number(roundNo));
    const [rows] = await connection.query(
      `SELECT round_no AS roundNo, voter_group_id AS voterGroupId, voter_user_id AS voterUserId, submitted_at AS submittedAt
       FROM decisioncard_vote_submissions ${where}
       ORDER BY submitted_at ASC`,
      params
    );
    return rows.map((row) => ({
      roundNo: Number(row.roundNo) || 1,
      voterGroupId: row.voterGroupId,
      voterUserId: row.voterUserId,
      submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    }));
  }

  async function upsertDecisioncardVoteSubmission({ connection = pool, roundNo, voterGroupId, voterUserId }) {
    await ensureDecisioncardsTable();
    await connection.query(
      `INSERT INTO decisioncard_vote_submissions (round_no, voter_group_id, voter_user_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE voter_user_id = VALUES(voter_user_id), submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      [Number(roundNo) || 1, voterGroupId, voterUserId]
    );
  }

  async function getDecisioncardVotes({ connection = pool, roundNo = null, voterGroupId = null } = {}) {
    await ensureDecisioncardsTable();
    const params = [];
    const conditions = [];
    if (roundNo) {
      conditions.push("round_no = ?");
      params.push(Number(roundNo));
    }
    if (voterGroupId) {
      conditions.push("voter_group_id = ?");
      params.push(String(voterGroupId));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await connection.query(
      `SELECT round_no AS roundNo, proposal_group_id AS proposalGroupId, card_id AS cardId,
              voter_group_id AS voterGroupId, voter_user_id AS voterUserId, vote_type AS voteType,
              voted_at AS votedAt
       FROM decisioncard_votes ${where}`,
      params
    );
    return rows.map((row) => ({
      roundNo: Number(row.roundNo) || 1,
      proposalGroupId: row.proposalGroupId,
      cardId: row.cardId,
      voterGroupId: row.voterGroupId,
      voterUserId: row.voterUserId,
      voteType: row.voteType,
      votedAt: row.votedAt ? new Date(row.votedAt).toISOString() : null,
    }));
  }

  async function getDecisioncardVoteCounts({ connection = pool, roundNo = null } = {}) {
    await ensureDecisioncardsTable();
    const params = [];
    const where = roundNo ? "WHERE round_no = ?" : "";
    if (roundNo) params.push(Number(roundNo));
    const [rows] = await connection.query(
      `SELECT card_id AS cardId,
              SUM(CASE WHEN vote_type = 'agree' THEN 1 ELSE 0 END) AS agree,
              SUM(CASE WHEN vote_type = 'reject' THEN 1 ELSE 0 END) AS reject
       FROM decisioncard_votes
       ${where}
       GROUP BY card_id`,
      params
    );
    return rows.map((row) => {
      const agree = Number(row.agree) || 0;
      const reject = Number(row.reject) || 0;
      return {
        cardId: row.cardId,
        agree,
        reject,
        keep: Math.max(0, GROUPS_COUNT - 1 - agree - reject),
      };
    });
  }

  async function upsertDecisioncardVote({ connection = pool, roundNo, proposalGroupId, cardId, voterGroupId, voterUserId, voteType }) {
    await ensureDecisioncardsTable();
    await connection.query(
      `INSERT INTO decisioncard_votes (round_no, proposal_group_id, card_id, voter_group_id, voter_user_id, vote_type)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vote_type = VALUES(vote_type), voter_user_id = VALUES(voter_user_id), updated_at = CURRENT_TIMESTAMP`,
      [Number(roundNo) || 1, proposalGroupId, cardId, voterGroupId, voterUserId, voteType]
    );
  }

  function calculateRoundScores(proposals, votes) {
    const votesByCard = new Map();
    for (const vote of votes) {
      if (!votesByCard.has(vote.cardId)) votesByCard.set(vote.cardId, []);
      votesByCard.get(vote.cardId).push(vote);
    }
    const cardResults = [];
    for (const proposal of proposals) {
      const selectedCardIds = Array.isArray(proposal.selectedCardIds) ? proposal.selectedCardIds : [];
      for (const cardId of selectedCardIds) {
        const cardVotes = votesByCard.get(cardId) || [];
        const agreeCount = cardVotes.filter((vote) => vote.voteType === "agree").length;
        const rejectCount = cardVotes.filter((vote) => vote.voteType === "reject").length;
        const result = agreeCount >= 3 ? "accepted" : rejectCount >= 3 ? "rejected" : "reserved";
        const keepCount = Math.max(0, GROUPS_COUNT - 1 - agreeCount - rejectCount);
        cardResults.push({
          groupId: proposal.groupId,
          roundNo: proposal.roundNo || 1,
          cardId,
          coreCard: String(proposal.coreCardId || "") === String(cardId),
          agreeCount,
          rejectCount,
          keepCount,
          result,
          reason: proposal.reason || "",
        });
      }
    }

    const scoresByGroup = {};
    for (const proposal of proposals) {
      const groupResults = cardResults.filter((item) => item.groupId === proposal.groupId);
      const acceptedCount = groupResults.filter((item) => item.result === "accepted").length;
      const rejectedCount = groupResults.filter((item) => item.result === "rejected").length;
      const reservedCount = groupResults.filter((item) => item.result === "reserved").length;
      const acceptedScore = acceptedCount > 0 ? acceptedCount * 10 * acceptedCount : 0;
      // 小組分數分開計算：
      // 1 張通過 +10；2 張通過 (10+10)*2=40；3 張通過 (10+10+10)*3=90。
      // 1 張拒絕 -5；2 張拒絕 (-5-5)*2=-20；3 張拒絕 (-5-5-5)*3=-45。
      // 保留牌不加分也不扣分；核心牌只有通過才 +10。
      const rejectedScore = rejectedCount > 0 ? -5 * rejectedCount * rejectedCount : 0;
      const coreBonus = groupResults.some((item) => item.coreCard && item.result === "accepted") ? 10 : 0;
      scoresByGroup[proposal.groupId] = {
        acceptedCount,
        rejectedCount,
        reservedCount,
        acceptedScore,
        rejectedScore,
        coreBonus,
        scoreDelta: acceptedScore + rejectedScore + coreBonus,
      };
    }
    return { cardResults, scoresByGroup };
  }

  async function getDecisioncardRoundHistory({ connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const [rows] = await connection.query(
      `SELECT round_no AS roundNo, group_id AS groupId, card_id AS cardId,
              core_card AS coreCard, agree_count AS agreeCount, reject_count AS rejectCount,
              keep_count AS keepCount, result, reason, settled_at AS settledAt
       FROM decisioncard_round_results
       ORDER BY round_no DESC, id ASC`
    );
    return rows.map((row) => ({
      roundNo: Number(row.roundNo) || 1,
      groupId: row.groupId,
      cardId: row.cardId,
      coreCard: Boolean(row.coreCard),
      agreeCount: Number(row.agreeCount) || 0,
      rejectCount: Number(row.rejectCount) || 0,
      keepCount: Number(row.keepCount) || 0,
      result: row.result || "reserved",
      reason: row.reason || "",
      settledAt: row.settledAt ? new Date(row.settledAt).toISOString() : null,
    }));
  }


  async function saveDecisioncardGroupScores({ connection = pool, roundNo, scoresByGroup = {} }) {
    await ensureDecisioncardsTable();
    const normalizedRoundNo = Math.max(1, Number(roundNo) || 1);
    await connection.query("DELETE FROM decisioncard_group_scores WHERE round_no = ?", [normalizedRoundNo]);

    const entries = Object.entries(scoresByGroup);
    for (const [groupId, score] of entries) {
      const [[previousRow]] = await connection.query(
        `SELECT COALESCE(SUM(score_delta), 0) AS previousScore
         FROM decisioncard_group_scores
         WHERE group_id = ? AND round_no < ?`,
        [groupId, normalizedRoundNo]
      );
      const previousScore = Number(previousRow?.previousScore) || 0;
      const scoreDelta = Number(score?.scoreDelta) || 0;
      const cumulativeScore = previousScore + scoreDelta;
      await connection.query(
        `INSERT INTO decisioncard_group_scores (
          round_no, group_id, accepted_count, rejected_count, reserved_count,
          accepted_score, rejected_score, core_bonus, score_delta, cumulative_score, settled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          normalizedRoundNo,
          groupId,
          Number(score?.acceptedCount) || 0,
          Number(score?.rejectedCount) || 0,
          Number(score?.reservedCount) || 0,
          Number(score?.acceptedScore) || 0,
          Number(score?.rejectedScore) || 0,
          Number(score?.coreBonus) || 0,
          scoreDelta,
          cumulativeScore,
        ]
      );
      score.cumulativeScore = cumulativeScore;
    }

    return scoresByGroup;
  }

  async function getDecisioncardGroupScores({ connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const [rows] = await connection.query(
      `SELECT round_no AS roundNo, group_id AS groupId,
              accepted_count AS acceptedCount, rejected_count AS rejectedCount, reserved_count AS reservedCount,
              accepted_score AS acceptedScore, rejected_score AS rejectedScore, core_bonus AS coreBonus,
              score_delta AS scoreDelta, cumulative_score AS cumulativeScore, settled_at AS settledAt
       FROM decisioncard_group_scores
       ORDER BY round_no ASC, group_id ASC`
    );
    return rows.map((row) => ({
      roundNo: Number(row.roundNo) || 1,
      groupId: row.groupId,
      acceptedCount: Number(row.acceptedCount) || 0,
      rejectedCount: Number(row.rejectedCount) || 0,
      reservedCount: Number(row.reservedCount) || 0,
      acceptedScore: Number(row.acceptedScore) || 0,
      rejectedScore: Number(row.rejectedScore) || 0,
      coreBonus: Number(row.coreBonus) || 0,
      scoreDelta: Number(row.scoreDelta) || 0,
      cumulativeScore: Number(row.cumulativeScore) || 0,
      settledAt: row.settledAt ? new Date(row.settledAt).toISOString() : null,
    }));
  }

  async function settleCurrentDecisionRound({ connection = pool } = {}) {
    await ensureDecisioncardsTable();
    const proposals = await getAllDecisioncards({ connection, forUpdate: true });
    const stateRoundNo = await getCurrentDecisionRound({ connection });

    // 以前幾版曾經可能發生「狀態表已進到第 N 輪，但公告欄仍留在第 N-1 輪」的狀況。
    // 教師按下開始下一輪時，應該結算「目前公告欄上實際存在的提案」，不能因 round_state 不同步而看起來沒反應。
    const proposalRoundNos = proposals
      .map((proposal) => Number(proposal.roundNo) || 1)
      .filter((roundNo) => roundNo > 0);
    const hasStateRoundProposal = proposalRoundNos.includes(stateRoundNo);
    const roundNo = hasStateRoundProposal
      ? stateRoundNo
      : proposalRoundNos.length > 0
        ? Math.max(...proposalRoundNos)
        : stateRoundNo;
    const currentProposals = proposals.filter((proposal) => (Number(proposal.roundNo) || 1) === roundNo);
    const votes = await getDecisioncardVotes({ connection, roundNo });
    const result = calculateRoundScores(currentProposals, votes);

    for (const card of result.cardResults) {
      await connection.query(
        "DELETE FROM decisioncard_round_results WHERE round_no = ? AND card_id = ?",
        [roundNo, card.cardId]
      );
      await connection.query(
        `INSERT INTO decisioncard_round_results (
          round_no, group_id, card_id, core_card, agree_count, reject_count, keep_count, result, reason, settled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [roundNo, card.groupId, card.cardId, card.coreCard ? 1 : 0, card.agreeCount, card.rejectCount, card.keepCount || 0, card.result, card.reason || ""]
      );
    }

    for (const card of result.cardResults.filter((item) => item.result === "accepted")) {
      const [[existingAccepted]] = await connection.query(
        "SELECT id FROM decisioncard_accepted_cards WHERE card_id = ? LIMIT 1",
        [card.cardId]
      );
      if (existingAccepted) continue;
      await connection.query(
        `INSERT INTO decisioncard_accepted_cards (round_no, group_id, card_id, core_card, agree_count, reject_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [roundNo, card.groupId, card.cardId, card.coreCard ? 1 : 0, card.agreeCount, card.rejectCount]
      );
    }

    await saveDecisioncardGroupScores({ connection, roundNo, scoresByGroup: result.scoresByGroup });

    // 結算完成後清空目前公告欄；通過牌已被存到決策區，拒絕/保留牌則因不在決策區，會回到各組手牌。
    await connection.query("DELETE FROM decisioncards WHERE round_no = ?", [roundNo]);
    const nextRoundNo = Math.max(stateRoundNo, roundNo) + 1;
    await setCurrentDecisionRound(nextRoundNo, { connection });

    return {
      roundNo,
      nextRoundNo,
      ...result,
      acceptedCards: await getAcceptedDecisioncards({ connection }),
      roundHistory: await getDecisioncardRoundHistory({ connection }),
      groupScores: await getDecisioncardGroupScores({ connection }),
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
    getCurrentDecisionRound,
    setCurrentDecisionRound,
    getAcceptedDecisioncards,
    getDecisioncardVotes,
    getDecisioncardVoteCounts,
    getDecisioncardVoteSubmissions,
    upsertDecisioncardVote,
    upsertDecisioncardVoteSubmission,
    calculateRoundScores,
    getDecisioncardRoundHistory,
    saveDecisioncardGroupScores,
    getDecisioncardGroupScores,
    settleCurrentDecisionRound,
  };
}

module.exports = { createDecisioncardService };
