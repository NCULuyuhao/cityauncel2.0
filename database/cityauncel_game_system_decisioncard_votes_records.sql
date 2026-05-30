-- CityAuncel role-card voting records
-- 用途：保存角色卡包每輪每組對每張公告牌的完整投票快照。
-- O=agree、X=reject、△=keep。decisioncard_votes 只保存明確 O/X；本表保存送出投票當下所有可投卡牌的 O/X/△。

CREATE TABLE IF NOT EXISTS `decisioncard_vote_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `round_no` int NOT NULL,
  `proposal_group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `card_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `voter_group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `voter_user_id` int NOT NULL,
  `vote_type` enum('agree','reject','keep') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'keep',
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_decisioncard_vote_record` (`round_no`,`card_id`,`voter_group_id`),
  KEY `idx_decisioncard_vote_records_round_card` (`round_no`,`card_id`),
  KEY `idx_decisioncard_vote_records_voter_group` (`voter_group_id`),
  KEY `idx_decisioncard_vote_records_proposal_group` (`proposal_group_id`),
  KEY `idx_decisioncard_vote_records_user` (`voter_user_id`),
  CONSTRAINT `fk_decisioncard_vote_records_user` FOREIGN KEY (`voter_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每輪每組對每張公告牌的完整投票快照；O=agree、X=reject、△=keep。';
