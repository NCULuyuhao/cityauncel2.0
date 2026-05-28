-- CityAuncel maintainability notes
-- 檔案用途：MySQL schema 腳本 cityauncel_game_system_map_locks.sql，定義地圖流程鎖定狀態。
-- 維護重點：個人/小組地圖目前是否鎖定放在此表；每次鎖定動作仍會寫入 map_action_logs 供歷程分析。

DROP TABLE IF EXISTS `map_locks`;
CREATE TABLE `map_locks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scope` enum('personal','group') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'personal=學生個人地圖鎖定, group=組長小組地圖鎖定',
  `owner_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'personal=user_id, group=group_id',
  `user_id` int DEFAULT NULL,
  `group_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_by_user_id` int NOT NULL,
  `locked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_map_locks_scope_owner` (`scope`,`owner_id`),
  KEY `idx_map_locks_user` (`user_id`),
  KEY `idx_map_locks_group` (`group_id`),
  KEY `idx_map_locks_locked_by` (`locked_by_user_id`),
  CONSTRAINT `fk_map_locks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_map_locks_locked_by_user` FOREIGN KEY (`locked_by_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖流程鎖定主表：保存個人地圖與小組地圖是否已完成鎖定。';
