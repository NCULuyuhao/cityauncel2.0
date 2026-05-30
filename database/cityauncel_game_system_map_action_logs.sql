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
-- Table structure for table `map_action_logs`
--

DROP TABLE IF EXISTS `map_action_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `idx_map_action_logs_dashboard_order` (`created_at`,`id`),
  CONSTRAINT `fk_map_action_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖操作歷程：個人、小組、全班地圖選擇改變紀錄。';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `map_action_logs`
--

LOCK TABLES `map_action_logs` WRITE;
/*!40000 ALTER TABLE `map_action_logs` DISABLE KEYS */;
INSERT INTO `map_action_logs` VALUES (1,2,'personal','environment','南庄鄉',NULL,'保育','set_choice','2026-05-30 16:43:19'),(2,2,'personal','environment','造橋鄉',NULL,'保育','set_choice','2026-05-30 16:43:21'),(3,2,'personal','environment','公館鄉',NULL,'保育','set_choice','2026-05-30 16:43:22'),(4,2,'personal','environment','後龍鎮',NULL,'保育','set_choice','2026-05-30 16:43:23'),(5,2,'personal','environment','頭份市',NULL,'開發','set_choice','2026-05-30 16:43:25'),(6,2,'personal','environment','頭屋鄉',NULL,'開發','set_choice','2026-05-30 16:43:26'),(7,2,'personal','environment','泰安鄉',NULL,'開發','set_choice','2026-05-30 16:43:27'),(8,2,'personal','environment','獅潭鄉',NULL,'開發','set_choice','2026-05-30 16:43:28'),(9,2,'personal','environment','三灣鄉',NULL,'開發','set_choice','2026-05-30 16:43:30'),(10,2,'personal','environment','苗栗市',NULL,'保育','set_choice','2026-05-30 16:43:31'),(11,2,'personal','environment','竹南鎮',NULL,'開發','set_choice','2026-05-30 16:43:32'),(12,2,'personal','environment','通霄鎮',NULL,'我不知道','set_choice','2026-05-30 16:43:34'),(13,2,'personal','environment','西湖鄉',NULL,'我不知道','set_choice','2026-05-30 16:43:35'),(14,2,'personal','environment','大湖鄉',NULL,'我不知道','set_choice','2026-05-30 16:43:36'),(15,2,'personal','environment','銅鑼鄉',NULL,'開發','set_choice','2026-05-30 16:43:38'),(16,2,'personal','environment','三義鄉',NULL,'開發','set_choice','2026-05-30 16:43:39'),(17,2,'personal','environment','苑裡鎮',NULL,'保育','set_choice','2026-05-30 16:43:40'),(18,2,'personal','environment','卓蘭鎮',NULL,'保育','set_choice','2026-05-30 16:43:41'),(19,2,'personal','environment','__ALL__',NULL,'locked','lock_personal_map','2026-05-30 16:43:44'),(20,2,'group','environment','__ALL__',NULL,'locked','lock_group_map','2026-05-30 16:43:49');
/*!40000 ALTER TABLE `map_action_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-31  1:05:09
