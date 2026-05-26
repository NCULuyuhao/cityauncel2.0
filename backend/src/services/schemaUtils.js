const pool = require("../db");

function parseJSON(data, fallback) {
  if (data == null) return fallback;
  if (typeof data === "object") return data;
  try {
    return JSON.parse(data);
  } catch (error) {
    return fallback;
  }
}

function stringify(value) {
  return JSON.stringify(value ?? null);
}

async function tableHasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count) > 0;
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function tableHasIndex(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function ensureDataCardSourcesTable(connection = pool) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS data_card_sources (
      card_id varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      category varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      source_type varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixedImage',
      source_payload json DEFAULT NULL,
      created_by_user_id int DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (card_id),
      KEY idx_data_card_sources_category_type (category, source_type),
      KEY idx_data_card_sources_created_by (created_by_user_id),
      CONSTRAINT fk_data_card_sources_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每張資料卡的唯一來源資料；學生解鎖表只保存 card_id。'`,
  );
}


async function ensureMapChoicesTable(connection = pool) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS map_choices (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      scope enum('personal','group','class') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      owner_id varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'personal=user_id, group=group_id, class=class',
      user_id int DEFAULT NULL,
      group_id varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      district_name varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      choice enum('保育','開發','我不知道') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_map_choices_scope_owner_district (scope, owner_id, district_name),
      KEY idx_map_choices_user (user_id),
      KEY idx_map_choices_group (group_id),
      KEY idx_map_choices_district (district_name),
      KEY idx_map_choices_scope_district (scope, district_name),
      CONSTRAINT fk_map_choices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖目前選擇主表：統一保存個人、小組、全班對每個地區的目前選擇；歷程另存 map_action_logs。'`,
  );

  if (await tableExists("map_user_choices")) {
    await connection.query(
      `INSERT IGNORE INTO map_choices (scope, owner_id, user_id, district_name, choice, created_at, updated_at)
       SELECT 'personal', CAST(user_id AS CHAR), user_id, district_name, choice, created_at, COALESCE(created_at, CURRENT_TIMESTAMP)
       FROM map_user_choices`,
    );
  }

  if (await tableExists("map_overrides")) {
    await connection.query(
      `INSERT IGNORE INTO map_choices (scope, owner_id, user_id, group_id, district_name, choice, created_at, updated_at)
       SELECT scope,
              CASE WHEN scope = 'class' THEN 'class' ELSE group_id END,
              NULL,
              group_id,
              district_name,
              choice,
              created_at,
              updated_at
       FROM map_overrides
       WHERE (scope = 'class' AND group_id IS NULL) OR (scope = 'group' AND group_id IS NOT NULL)`,
    );
  }

  await connection.query("DROP TABLE IF EXISTS map_overrides");
  await connection.query("DROP TABLE IF EXISTS map_user_choices");
}


async function ensureInquiryNormalizedTables(connection = pool) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS inquiry_records (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      record_order int NOT NULL,
      orientation_created_at datetime DEFAULT NULL,
      investigation_created_at datetime DEFAULT NULL,
      conclusion_created_at datetime DEFAULT NULL,
      conclusion_text text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      started_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at datetime DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_inquiry_records_user_order (user_id, record_order),
      KEY idx_inquiry_records_user_started (user_id, started_at),
      KEY idx_inquiry_records_user_ended (user_id, ended_at),
      CONSTRAINT fk_inquiry_records_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生每一份探究調查書主表；只保存時間、順序與最終文字，不再塞前導/卡片 JSON。'`,
  );

  const [inquiryRecordColumnRows] = await connection.query(
    `SELECT COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inquiry_records'`,
  );
  const inquiryRecordColumns = new Set(inquiryRecordColumnRows.map((row) => row.columnName));
  const addInquiryRecordColumn = async (columnName, ddl) => {
    if (inquiryRecordColumns.has(columnName)) return;
    await connection.query(ddl);
    inquiryRecordColumns.add(columnName);
  };
  await addInquiryRecordColumn('orientation_created_at', 'ALTER TABLE inquiry_records ADD COLUMN orientation_created_at datetime DEFAULT NULL AFTER record_order');
  await addInquiryRecordColumn('investigation_created_at', 'ALTER TABLE inquiry_records ADD COLUMN investigation_created_at datetime DEFAULT NULL AFTER orientation_created_at');
  await addInquiryRecordColumn('conclusion_created_at', 'ALTER TABLE inquiry_records ADD COLUMN conclusion_created_at datetime DEFAULT NULL AFTER investigation_created_at');
  await addInquiryRecordColumn('conclusion_text', 'ALTER TABLE inquiry_records ADD COLUMN conclusion_text text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER conclusion_created_at');
  await addInquiryRecordColumn('started_at', 'ALTER TABLE inquiry_records ADD COLUMN started_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER conclusion_text');
  await addInquiryRecordColumn('ended_at', 'ALTER TABLE inquiry_records ADD COLUMN ended_at datetime DEFAULT NULL AFTER started_at');
  await addInquiryRecordColumn('created_at', 'ALTER TABLE inquiry_records ADD COLUMN created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER ended_at');
  await addInquiryRecordColumn('updated_at', 'ALTER TABLE inquiry_records ADD COLUMN updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

  await connection.query(
    `CREATE TABLE IF NOT EXISTS inquiry_orientation_responses (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      inquiry_record_id int NOT NULL,
      response_order int NOT NULL,
      response_type varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      answer_order int NOT NULL DEFAULT 1,
      answer_text text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_inquiry_orientation_answer (inquiry_record_id, response_order, answer_order),
      KEY idx_inquiry_orientation_type (response_type),
      CONSTRAINT fk_inquiry_orientation_record FOREIGN KEY (inquiry_record_id) REFERENCES inquiry_records (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='前導任務回答。一個選項或一段文字就是一列，selectedOptions 會拆成多列。'`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS inquiry_record_cards (
      inquiry_record_id int NOT NULL,
      card_id varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      card_order int NOT NULL DEFAULT 1,
      unlocked_at datetime DEFAULT NULL,
      is_evidence tinyint NOT NULL DEFAULT 0,
      evidence_order int DEFAULT NULL,
      evidence_selected_at datetime DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (inquiry_record_id, card_id),
      KEY idx_inquiry_record_cards_card (card_id),
      KEY idx_inquiry_record_cards_evidence (inquiry_record_id, is_evidence, evidence_order),
      CONSTRAINT fk_inquiry_record_cards_record FOREIGN KEY (inquiry_record_id) REFERENCES inquiry_records (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='某一份調查書本回合使用過的資料卡；證據卡用 is_evidence/evidence_order 標記，不再另拆 inquiry_evidence_cards。'`,
  );

  const [recordCardColumnRows] = await connection.query(
    `SELECT COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inquiry_record_cards'`,
  );
  const recordCardColumns = new Set(recordCardColumnRows.map((row) => row.columnName));
  const addRecordCardColumn = async (columnName, ddl) => {
    if (recordCardColumns.has(columnName)) return;
    await connection.query(ddl);
    recordCardColumns.add(columnName);
  };
  await addRecordCardColumn('is_evidence', 'ALTER TABLE inquiry_record_cards ADD COLUMN is_evidence tinyint NOT NULL DEFAULT 0 AFTER unlocked_at');
  await addRecordCardColumn('evidence_order', 'ALTER TABLE inquiry_record_cards ADD COLUMN evidence_order int DEFAULT NULL AFTER is_evidence');
  await addRecordCardColumn('evidence_selected_at', 'ALTER TABLE inquiry_record_cards ADD COLUMN evidence_selected_at datetime DEFAULT NULL AFTER evidence_order');
  if (!(await tableHasIndex('inquiry_record_cards', 'idx_inquiry_record_cards_evidence'))) {
    try {
      await connection.query('ALTER TABLE inquiry_record_cards ADD INDEX idx_inquiry_record_cards_evidence (inquiry_record_id, is_evidence, evidence_order)');
    } catch (error) {
      if (error?.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }

  if (await tableExists('inquiry_evidence_cards')) {
    await connection.query(
      `INSERT INTO inquiry_record_cards
        (inquiry_record_id, card_id, card_order, is_evidence, evidence_order, evidence_selected_at)
       SELECT iec.inquiry_record_id,
              iec.card_id,
              1000 + COALESCE(iec.evidence_order, 1),
              1,
              iec.evidence_order,
              COALESCE(iec.created_at, CURRENT_TIMESTAMP)
       FROM inquiry_evidence_cards iec
       ON DUPLICATE KEY UPDATE
         is_evidence = 1,
         evidence_order = VALUES(evidence_order),
         evidence_selected_at = VALUES(evidence_selected_at)`,
    );
    await connection.query('DROP TABLE IF EXISTS inquiry_evidence_cards');
  }

  await connection.query(
    `CREATE TABLE IF NOT EXISTS inquiry_collection_notes (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      inquiry_record_id int NOT NULL,
      note_key varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      note_text text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inquiry_collection_notes_record (inquiry_record_id, created_at),
      CONSTRAINT fk_inquiry_collection_notes_record FOREIGN KEY (inquiry_record_id) REFERENCES inquiry_records (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生針對一批線索卡撰寫的理由/note；文字只存一次。'`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS inquiry_collection_note_cards (
      note_id bigint unsigned NOT NULL,
      card_id varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      card_order int NOT NULL DEFAULT 1,
      PRIMARY KEY (note_id, card_id),
      KEY idx_inquiry_collection_note_cards_card (card_id),
      CONSTRAINT fk_inquiry_collection_note_cards_note FOREIGN KEY (note_id) REFERENCES inquiry_collection_notes (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='理由 note 與被說明的資料卡關聯表，避免同一段理由在多張卡重複儲存。'`,
  );

}

async function ensureLearningDashboardIndexes() {
  const indexSpecs = [
    {
      table: "inquiry_records",
      name: "idx_inquiry_records_dashboard_order",
      sql: "ALTER TABLE inquiry_records ADD INDEX idx_inquiry_records_dashboard_order (user_id, record_order, id)",
    },
    {
      table: "student_activity_logs",
      name: "idx_student_activity_dashboard_order",
      sql: "ALTER TABLE student_activity_logs ADD INDEX idx_student_activity_dashboard_order (user_id, created_at, id)",
    },
    {
      table: "student_activity_logs",
      name: "idx_student_activity_dashboard_filter",
      sql: "ALTER TABLE student_activity_logs ADD INDEX idx_student_activity_dashboard_filter (created_at, event_type, target_type, user_id)",
    },
    {
      table: "map_action_logs",
      name: "idx_map_action_logs_dashboard_order",
      sql: "ALTER TABLE map_action_logs ADD INDEX idx_map_action_logs_dashboard_order (created_at, id)",
    },
  ];

  for (const spec of indexSpecs) {
    if (!(await tableExists(spec.table)) || (await tableHasIndex(spec.table, spec.name))) continue;
    try {
      await pool.query(spec.sql);
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") throw error;
    }
  }
}

module.exports = {
  parseJSON,
  stringify,
  tableHasColumn,
  tableExists,
  tableHasIndex,
  ensureDataCardSourcesTable,
  ensureMapChoicesTable,
  ensureInquiryNormalizedTables,
  ensureLearningDashboardIndexes,
};
