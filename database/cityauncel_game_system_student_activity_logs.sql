-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: cityauncel_game_system
-- ------------------------------------------------------
-- Server version	9.1.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `student_activity_logs`
--

DROP TABLE IF EXISTS `student_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `idx_student_activity_dashboard_order` (`user_id`,`created_at`,`id`),
  KEY `idx_student_activity_dashboard_filter` (`created_at`,`event_type`,`target_type`,`user_id`),
  CONSTRAINT `fk_student_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生遊戲流程紀錄主表。只寫入 role=student 的使用者行為，教師不寫入。';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_activity_logs`
--

LOCK TABLES `student_activity_logs` WRITE;
/*!40000 ALTER TABLE `student_activity_logs` DISABLE KEYS */;
INSERT INTO `student_activity_logs` VALUES (1,2,'1','student','environment','page_visit','切換頁面','page','cardPack',NULL,NULL,'{\"from\":\"home\",\"to\":\"cardPack\"}','2026-05-30 14:45:56'),(2,2,'1','student','environment','group_card_pack_lock','組長鎖定小組卡包三張卡牌','role_card_pack','environment',NULL,'{\"selectedCardIds\":[\"environment-pack-2\",\"environment-pack-4\",\"environment-pack-7\"],\"reason\":\"22222222222222222222222222\"}','{\"id\":1,\"groupId\":\"environment\",\"selectedCardIds\":[\"environment-pack-2\",\"environment-pack-4\",\"environment-pack-7\"],\"roundNo\":1,\"coreCardId\":\"environment-pack-2\",\"lockedBy\":2,\"lockedByName\":\"1\",\"reason\":\"22222222222222222222222222\",\"lockedAt\":\"2026-05-30T14:46:04.000Z\",\"updatedAt\":\"2026-05-30T14:46:04.000Z\"}','2026-05-30 14:46:04'),(3,2,'1','student','environment','card_pack_lock','鎖定石虎卡包三張卡牌','role_card_pack','environment',NULL,'{\"selectedCardIds\":[\"environment-pack-2\",\"environment-pack-4\",\"environment-pack-7\"],\"reason\":\"22222222222222222222222222\"}','{\"groupId\":\"environment\",\"cardsIds\":[\"environment-pack-2\",\"environment-pack-4\",\"environment-pack-7\"],\"noteSummary\":{\"length\":26,\"hasText\":true,\"preview\":\"22222222222222222222222222\"}}','2026-05-30 14:46:04'),(4,2,'1','student','environment','page_visit','切換頁面','page','map',NULL,NULL,'{\"from\":\"home\",\"to\":\"map\"}','2026-05-30 14:46:17'),(5,2,'1','student','environment','page_visit','切換頁面','page','home',NULL,NULL,'{\"from\":\"map\",\"to\":\"home\"}','2026-05-30 14:46:19'),(6,2,'1','student','environment','page_visit','切換頁面','page','cardPack',NULL,NULL,'{\"from\":\"home\",\"to\":\"cardPack\"}','2026-05-30 14:46:21'),(7,2,'1','student','environment','page_visit','切換頁面','page','cardPack',NULL,NULL,'{\"from\":\"home\",\"to\":\"cardPack\"}','2026-05-30 14:47:33'),(8,2,'1','student','environment','page_visit','切換頁面','page','cardPack',NULL,NULL,'{\"from\":\"home\",\"to\":\"cardPack\"}','2026-05-30 16:43:01'),(9,2,'1','student','environment','page_visit','切換頁面','page','map',NULL,NULL,'{\"from\":\"home\",\"to\":\"map\"}','2026-05-30 16:43:17'),(10,2,'1','student','environment','map_set_choice','地圖決策操作','personal','南庄鄉',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"南庄鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:19'),(11,2,'1','student','environment','map_set_choice','地圖決策操作','personal','造橋鄉',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"造橋鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:21'),(12,2,'1','student','environment','map_set_choice','地圖決策操作','personal','公館鄉',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"公館鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:22'),(13,2,'1','student','environment','map_set_choice','地圖決策操作','personal','後龍鎮',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"後龍鎮\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:23'),(14,2,'1','student','environment','map_set_choice','地圖決策操作','personal','頭份市',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"頭份市\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:25'),(15,2,'1','student','environment','map_set_choice','地圖決策操作','personal','頭屋鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"頭屋鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:26'),(16,2,'1','student','environment','map_set_choice','地圖決策操作','personal','泰安鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"泰安鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:27'),(17,2,'1','student','environment','map_set_choice','地圖決策操作','personal','獅潭鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"獅潭鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:28'),(18,2,'1','student','environment','map_set_choice','地圖決策操作','personal','三灣鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"三灣鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:30'),(19,2,'1','student','environment','map_set_choice','地圖決策操作','personal','苗栗市',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"苗栗市\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:31'),(20,2,'1','student','environment','map_set_choice','地圖決策操作','personal','竹南鎮',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"竹南鎮\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:32'),(21,2,'1','student','environment','map_set_choice','地圖決策操作','personal','通霄鎮',NULL,'\"我不知道\"','{\"scope\":\"personal\",\"districtName\":\"通霄鎮\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:34'),(22,2,'1','student','environment','map_set_choice','地圖決策操作','personal','西湖鄉',NULL,'\"我不知道\"','{\"scope\":\"personal\",\"districtName\":\"西湖鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:35'),(23,2,'1','student','environment','map_set_choice','地圖決策操作','personal','大湖鄉',NULL,'\"我不知道\"','{\"scope\":\"personal\",\"districtName\":\"大湖鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:36'),(24,2,'1','student','environment','map_set_choice','地圖決策操作','personal','銅鑼鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"銅鑼鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:38'),(25,2,'1','student','environment','map_set_choice','地圖決策操作','personal','三義鄉',NULL,'\"開發\"','{\"scope\":\"personal\",\"districtName\":\"三義鄉\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:39'),(26,2,'1','student','environment','map_set_choice','地圖決策操作','personal','苑裡鎮',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"苑裡鎮\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:40'),(27,2,'1','student','environment','map_set_choice','地圖決策操作','personal','卓蘭鎮',NULL,'\"保育\"','{\"scope\":\"personal\",\"districtName\":\"卓蘭鎮\",\"actionType\":\"set_choice\"}','2026-05-30 16:43:41'),(28,2,'1','student','environment','map_lock_personal','鎖定個人地圖','personal','__ALL__','{\"南庄鄉\":\"保育\",\"造橋鄉\":\"保育\",\"公館鄉\":\"保育\",\"後龍鎮\":\"保育\",\"頭份市\":\"開發\",\"頭屋鄉\":\"開發\",\"泰安鄉\":\"開發\",\"獅潭鄉\":\"開發\",\"三灣鄉\":\"開發\",\"苗栗市\":\"保育\",\"竹南鎮\":\"開發\",\"通霄鎮\":\"我不知道\",\"西湖鄉\":\"我不知道\",\"大湖鄉\":\"我不知道\",\"銅鑼鄉\":\"開發\",\"三義鄉\":\"開發\",\"苑裡鎮\":\"保育\",\"卓蘭鎮\":\"保育\"}','\"locked\"','{\"scope\":\"personal\",\"completedDistricts\":18}','2026-05-30 16:43:44'),(29,2,'1','student','environment','map_lock_group','鎖定小組地圖','group','__ALL__',NULL,'\"locked\"',NULL,'2026-05-30 16:43:49'),(30,2,'1','student','environment','page_visit','切換頁面','page','home',NULL,NULL,'{\"from\":\"map\",\"to\":\"home\"}','2026-05-30 16:43:55'),(31,2,'1','student','environment','page_visit','切換頁面','page','map',NULL,NULL,'{\"from\":\"home\",\"to\":\"map\"}','2026-05-30 16:43:59'),(32,2,'1','student','environment','page_visit','切換頁面','page','home',NULL,NULL,'{\"from\":\"map\",\"to\":\"home\"}','2026-05-30 16:44:03'),(33,2,'1','student','environment','page_visit','切換頁面','page','cardPack',NULL,NULL,'{\"from\":\"home\",\"to\":\"cardPack\"}','2026-05-30 16:45:11');
/*!40000 ALTER TABLE `student_activity_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-31  1:05:08
