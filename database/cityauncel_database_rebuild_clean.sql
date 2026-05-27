-- CityAuncel maintainability notes
-- 檔案用途：MySQL schema 腳本 cityauncel_database_rebuild_clean.sql，定義資料表、索引或資料庫重建流程。
-- 維護重點：修改欄位或索引後，請同步檢查後端 SQL 與教師端分析查詢。

-- Clean rebuild SQL for CityAuncel normalized schema
-- Generated from the latest project schema. This file intentionally avoids mysqldump LOCK TABLE wrappers.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
CREATE DATABASE IF NOT EXISTS `cityauncel_game_system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cityauncel_game_system`;

DROP VIEW IF EXISTS `v_student_progress_summary`;
DROP VIEW IF EXISTS `v_card_analysis_summary`;
DROP VIEW IF EXISTS `v_activity_event_summary`;

-- Drop legacy tables from earlier schema iterations.
DROP TABLE IF EXISTS `group_card_pack_lock_events`;
DROP TABLE IF EXISTS `group_card_pack_lock_logs`;
DROP TABLE IF EXISTS `group_card_pack_locks`;
DROP TABLE IF EXISTS `decisioncard_log_cards`;
DROP TABLE IF EXISTS `decisioncard_cards`;
DROP TABLE IF EXISTS `map_overrides`;
DROP TABLE IF EXISTS `map_user_choices`;
DROP TABLE IF EXISTS `inquiry_evidence_cards`;
DROP TABLE IF EXISTS `student_coin_balances`;
DROP TABLE IF EXISTS `ai_argument_workshop_records`;

-- Drop current tables from child to parent order.
DROP TABLE IF EXISTS `ai_helper_record_cards`;
DROP TABLE IF EXISTS `ai_helper_records`;
DROP TABLE IF EXISTS `ai_helper_unlocks`;
DROP TABLE IF EXISTS `decisioncard_logs`;
DROP TABLE IF EXISTS `decisioncards`;
DROP TABLE IF EXISTS `barrages`;
DROP TABLE IF EXISTS `map_action_logs`;
DROP TABLE IF EXISTS `map_choices`;
DROP TABLE IF EXISTS `student_activity_logs`;
DROP TABLE IF EXISTS `student_unlocked_cards`;
DROP TABLE IF EXISTS `student_rewards`;
DROP TABLE IF EXISTS `inquiry_collection_note_cards`;
DROP TABLE IF EXISTS `inquiry_collection_notes`;
DROP TABLE IF EXISTS `inquiry_record_cards`;
DROP TABLE IF EXISTS `inquiry_orientation_responses`;
DROP TABLE IF EXISTS `inquiry_records`;
DROP TABLE IF EXISTS `data_card_sources`;
DROP TABLE IF EXISTS `suspect_votes`;
DROP TABLE IF EXISTS `game_settings`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- users
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('student','teacher') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `gender` enum('male','female') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_group_leader` tinyint NOT NULL DEFAULT '0',
  `barrage_coins` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='使用者主表：學生與教師帳號、角色、分組與組長身分。';

-- game_settings
CREATE TABLE `game_settings` (
  `setting_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='教師端控制用設定，例如任務開關、投票開關與是否公布。';

-- data_card_sources
CREATE TABLE `data_card_sources` (
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixedImage',
  `source_payload` json DEFAULT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`card_id`),
  KEY `idx_data_card_sources_category_type` (`category`,`source_type`),
  KEY `idx_data_card_sources_created_by` (`created_by_user_id`),
  CONSTRAINT `fk_data_card_sources_created_by_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每張資料卡的唯一來源資料；學生解鎖表只保存 card_id。';

-- inquiry_records
CREATE TABLE `inquiry_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `record_order` int NOT NULL,
  `orientation_created_at` datetime DEFAULT NULL,
  `investigation_created_at` datetime DEFAULT NULL,
  `conclusion_created_at` datetime DEFAULT NULL,
  `conclusion_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inquiry_records_user_order` (`user_id`,`record_order`),
  KEY `idx_inquiry_records_user_started` (`user_id`,`started_at`),
  KEY `idx_inquiry_records_user_ended` (`user_id`,`ended_at`),
  CONSTRAINT `fk_inquiry_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生每一份探究調查書主表；不再保存前導/卡片 JSON，只保存順序、時間與最終結論文字。';

-- inquiry_orientation_responses
CREATE TABLE `inquiry_orientation_responses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_record_id` int NOT NULL,
  `response_order` int NOT NULL,
  `response_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer_order` int NOT NULL DEFAULT '1',
  `answer_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inquiry_orientation_answer` (`inquiry_record_id`,`response_order`,`answer_order`),
  KEY `idx_inquiry_orientation_type` (`response_type`),
  CONSTRAINT `fk_inquiry_orientation_record` FOREIGN KEY (`inquiry_record_id`) REFERENCES `inquiry_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='前導任務回答。一個選項或一段文字就是一列，selectedOptions 會拆成多列。';

-- inquiry_record_cards
CREATE TABLE `inquiry_record_cards` (
  `inquiry_record_id` int NOT NULL,
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `card_order` int NOT NULL DEFAULT '1',
  `unlocked_at` datetime DEFAULT NULL,
  `is_evidence` tinyint NOT NULL DEFAULT '0',
  `evidence_order` int DEFAULT NULL,
  `evidence_selected_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`inquiry_record_id`,`card_id`),
  KEY `idx_inquiry_record_cards_card` (`card_id`),
  KEY `idx_inquiry_record_cards_evidence` (`inquiry_record_id`,`is_evidence`,`evidence_order`),
  CONSTRAINT `fk_inquiry_record_cards_record` FOREIGN KEY (`inquiry_record_id`) REFERENCES `inquiry_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='某一份調查書本回合使用過的資料卡；證據卡用 is_evidence/evidence_order 標記，不再另拆 inquiry_evidence_cards。';

-- inquiry_collection_notes
CREATE TABLE `inquiry_collection_notes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_record_id` int NOT NULL,
  `note_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inquiry_collection_notes_record` (`inquiry_record_id`,`created_at`),
  CONSTRAINT `fk_inquiry_collection_notes_record` FOREIGN KEY (`inquiry_record_id`) REFERENCES `inquiry_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生針對一批線索卡撰寫的理由/note；文字只存一次。';

-- inquiry_collection_note_cards
CREATE TABLE `inquiry_collection_note_cards` (
  `note_id` bigint unsigned NOT NULL,
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `card_order` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`note_id`,`card_id`),
  KEY `idx_inquiry_collection_note_cards_card` (`card_id`),
  CONSTRAINT `fk_inquiry_collection_note_cards_note` FOREIGN KEY (`note_id`) REFERENCES `inquiry_collection_notes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='理由 note 與被說明的資料卡關聯表，避免同一段理由在多張卡重複儲存。';

-- student_rewards
CREATE TABLE `student_rewards` (
  `user_id` int NOT NULL,
  `reward_type` enum('title') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'title',
  `reward_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `earned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`reward_type`,`reward_key`),
  KEY `idx_student_rewards_type` (`reward_type`),
  CONSTRAINT `fk_student_rewards_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生獎勵與解鎖項目；稱號內容由 reward_key 對應程式內稱號表，不重複保存 JSON。';

-- student_unlocked_cards
CREATE TABLE `student_unlocked_cards` (
  `user_id` int NOT NULL,
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unlocked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`card_id`),
  KEY `idx_student_unlocked_cards_card` (`card_id`),
  CONSTRAINT `fk_student_unlocked_cards_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生個人完整解鎖卡牌狀態表；不保存小組 decisioncards。';

-- student_activity_logs
CREATE TABLE `student_activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('student','teacher') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `group_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_label` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previous_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_student_activity_user` (`user_id`),
  KEY `idx_student_activity_group` (`group_id`),
  KEY `idx_student_activity_event` (`event_type`),
  KEY `idx_student_activity_target` (`target_type`,`target_id`),
  KEY `idx_student_activity_created` (`created_at`),
  CONSTRAINT `fk_student_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生遊戲流程紀錄主表。只寫入 role=student 的使用者行為，教師不寫入。';

-- map_choices
CREATE TABLE `map_choices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scope` enum('personal','group','class') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'personal=user_id, group=group_id, class=class',
  `user_id` int DEFAULT NULL,
  `group_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `choice` enum('保育','開發','我不知道') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_map_choices_scope_owner_district` (`scope`,`owner_id`,`district_name`),
  KEY `idx_map_choices_user` (`user_id`),
  KEY `idx_map_choices_group` (`group_id`),
  KEY `idx_map_choices_district` (`district_name`),
  KEY `idx_map_choices_scope_district` (`scope`,`district_name`),
  CONSTRAINT `fk_map_choices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖目前選擇主表：統一保存個人、小組、全班對每個地區的目前選擇；歷程另存 map_action_logs。';

-- map_action_logs
CREATE TABLE `map_action_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `scope` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_choice` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_choice` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_map_action_logs_user` (`user_id`),
  KEY `idx_map_action_logs_group` (`group_id`),
  KEY `idx_map_action_logs_district` (`district_name`),
  CONSTRAINT `fk_map_action_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖操作歷程：個人、小組、全班地圖選擇改變紀錄。';

-- barrages
CREATE TABLE `barrages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `content` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_barrages_user` (`user_id`),
  KEY `idx_barrages_created` (`created_at`),
  CONSTRAINT `fk_barrages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生送出的匿名顯示彈幕；只保存 user_id 與 content，顯示帳號時由 users JOIN 取得。';

-- decisioncards
CREATE TABLE `decisioncards` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `selected_card_id_1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selected_card_id_2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selected_card_id_3` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_by_user_id` int NOT NULL,
  `lock_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `locked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_decisioncards_group_id` (`group_id`),
  KEY `idx_decisioncards_locked_by_user_id` (`locked_by_user_id`),
  KEY `idx_decisioncards_card_1` (`selected_card_id_1`),
  KEY `idx_decisioncards_card_2` (`selected_card_id_2`),
  KEY `idx_decisioncards_card_3` (`selected_card_id_3`),
  CONSTRAINT `fk_decisioncards_locked_by_user` FOREIGN KEY (`locked_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每組目前鎖定的小組角色卡包決策；因固定只能選三張卡，直接保存三個 card_id，不再另拆明細表。';

-- decisioncard_logs
CREATE TABLE `decisioncard_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'lock',
  `selected_card_id_1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selected_card_id_2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `selected_card_id_3` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_by_user_id` int DEFAULT NULL,
  `lock_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `locked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_decisioncard_logs_group_id_created_at` (`group_id`,`created_at`),
  KEY `idx_decisioncard_logs_locked_by_user_id` (`locked_by_user_id`),
  KEY `idx_decisioncard_logs_action_type` (`action_type`),
  KEY `idx_decisioncard_logs_locked_at` (`locked_at`),
  KEY `idx_decisioncard_logs_card_1` (`selected_card_id_1`),
  KEY `idx_decisioncard_logs_card_2` (`selected_card_id_2`),
  KEY `idx_decisioncard_logs_card_3` (`selected_card_id_3`),
  CONSTRAINT `fk_decisioncard_logs_locked_by_user` FOREIGN KEY (`locked_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小組角色卡包鎖定、重鎖與教師解鎖歷程；每筆歷程直接保存當時三張卡。';

-- suspect_votes
CREATE TABLE `suspect_votes` (
  `user_id` int NOT NULL,
  `role_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rank_position` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  UNIQUE KEY `uniq_suspect_votes_user_rank` (`user_id`,`rank_position`),
  KEY `idx_suspect_votes_role_rank` (`role_id`,`rank_position`),
  CONSTRAINT `fk_suspect_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生嫌犯排序投票紀錄：role_id 代表被排序的角色，rank_position 代表排序。';

-- ai_helper_unlocks
CREATE TABLE `ai_helper_unlocks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `round_key` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unlocked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ai_helper_unlock` (`user_id`,`round_key`,`scope`),
  KEY `idx_ai_helper_user_round` (`user_id`,`round_key`),
  CONSTRAINT `fk_ai_helper_unlocks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 幫幫忙每位學生每回合是否已投幣解鎖。';

-- ai_helper_records
CREATE TABLE `ai_helper_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `round_key` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `need_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `help_category` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `response_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `response_source` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_fallback` tinyint NOT NULL DEFAULT '0',
  `gap_scope` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `context_scope` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `context_label` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_key` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_label` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `focus_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `focus_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `collection_reflection_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `direction_opening` tinyint NOT NULL DEFAULT '0',
  `reason_opening` tinyint NOT NULL DEFAULT '0',
  `reply_limit` int DEFAULT NULL,
  `active_cards_count` int NOT NULL DEFAULT '0',
  `unlocked_cards_count` int DEFAULT NULL,
  `all_unlocked_cards_count` int DEFAULT NULL,
  `help_credits` int DEFAULT NULL,
  `turns_in_help` int DEFAULT NULL,
  `checks_in_help` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_helper_records_user_round` (`user_id`,`round_key`,`created_at`),
  KEY `idx_ai_helper_records_session` (`session_id`),
  KEY `idx_ai_helper_records_need` (`need_type`,`action_type`),
  CONSTRAINT `fk_ai_helper_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 幫幫忙使用紀錄主表；卡片關聯改存 ai_helper_record_cards，情境摘要改為可查詢欄位。';

-- ai_helper_record_cards
CREATE TABLE `ai_helper_record_cards` (
  `ai_helper_record_id` bigint NOT NULL,
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `card_order` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`ai_helper_record_id`,`card_id`),
  KEY `idx_ai_helper_record_cards_card_id` (`card_id`),
  CONSTRAINT `fk_ai_helper_record_cards_record` FOREIGN KEY (`ai_helper_record_id`) REFERENCES `ai_helper_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 幫幫忙每次互動引用或聚焦的資料卡關聯表；不再以 card_refs_json 儲存。';

-- Default teacher control settings. Keep keys aligned with backend/src/routes/gameStatus.routes.js and voting.routes.js.
INSERT INTO `game_settings` (`setting_key`, `setting_value`) VALUES
  ('inquiry_task_status', '{"isOpen":true}'),
  ('map_task_status', '{"isOpen":true}'),
  ('card_pack_status', '{"isOpen":true}'),
  ('student_screen_lock', '{"locked":false,"isLocked":false}'),
  ('suspect_voting_status', '{"isOpen":false,"isFinalized":false,"finalizedSuspects":[],"finalizedAt":null}'),
  ('final_decision_settlement', '{"isFinalized":false}');

CREATE OR REPLACE VIEW `v_student_progress_summary` AS
SELECT
  u.id AS user_id,
  u.username,
  u.group_id,
  u.is_group_leader,
  COUNT(DISTINCT ir.id) AS inquiry_count,
  COUNT(DISTINCT suc.card_id) AS unlocked_card_count,
  COUNT(DISTINCT sr.reward_key) AS title_count,
  COALESCE(u.barrage_coins, 0) AS barrage_coins,
  MAX(ir.ended_at) AS latest_inquiry_ended_at
FROM users u
LEFT JOIN inquiry_records ir ON ir.user_id = u.id
LEFT JOIN student_unlocked_cards suc ON suc.user_id = u.id
LEFT JOIN student_rewards sr ON sr.user_id = u.id AND sr.reward_type = 'title'
WHERE u.role = 'student'
GROUP BY u.id, u.username, u.group_id, u.is_group_leader, u.barrage_coins;

CREATE OR REPLACE VIEW `v_card_analysis_summary` AS
SELECT
  suc.card_id,
  dcs.category,
  COUNT(DISTINCT suc.user_id) AS unlocked_user_count,
  COUNT(DISTINCT irc.inquiry_record_id) AS inquiry_used_count,
  COUNT(DISTINCT CASE WHEN irc.is_evidence = 1 THEN irc.inquiry_record_id END) AS evidence_used_count,
  MIN(suc.unlocked_at) AS first_unlocked_at,
  MAX(suc.updated_at) AS latest_updated_at
FROM student_unlocked_cards suc
LEFT JOIN data_card_sources dcs ON dcs.card_id = suc.card_id
LEFT JOIN inquiry_record_cards irc ON irc.card_id = suc.card_id
GROUP BY suc.card_id, dcs.category;

CREATE OR REPLACE VIEW `v_activity_event_summary` AS
SELECT
  event_type,
  target_type,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_user_count,
  MIN(created_at) AS first_event_at,
  MAX(created_at) AS latest_event_at
FROM student_activity_logs
GROUP BY event_type, target_type;
