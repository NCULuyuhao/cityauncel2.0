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
-- Table structure for table `map_choices`
--

DROP TABLE IF EXISTS `map_choices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='地圖目前選擇主表：統一保存個人、小組、全班對每個地區的目前選擇；歷程另存 map_action_logs。';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `map_choices`
--

LOCK TABLES `map_choices` WRITE;
/*!40000 ALTER TABLE `map_choices` DISABLE KEYS */;
INSERT INTO `map_choices` VALUES (1,'personal','2',2,NULL,'南庄鄉','保育','2026-05-30 16:43:19','2026-05-30 16:43:19'),(2,'personal','2',2,NULL,'造橋鄉','保育','2026-05-30 16:43:21','2026-05-30 16:43:21'),(3,'personal','2',2,NULL,'公館鄉','保育','2026-05-30 16:43:22','2026-05-30 16:43:22'),(4,'personal','2',2,NULL,'後龍鎮','保育','2026-05-30 16:43:23','2026-05-30 16:43:23'),(5,'personal','2',2,NULL,'頭份市','開發','2026-05-30 16:43:25','2026-05-30 16:43:25'),(6,'personal','2',2,NULL,'頭屋鄉','開發','2026-05-30 16:43:26','2026-05-30 16:43:26'),(7,'personal','2',2,NULL,'泰安鄉','開發','2026-05-30 16:43:27','2026-05-30 16:43:27'),(8,'personal','2',2,NULL,'獅潭鄉','開發','2026-05-30 16:43:28','2026-05-30 16:43:28'),(9,'personal','2',2,NULL,'三灣鄉','開發','2026-05-30 16:43:30','2026-05-30 16:43:30'),(10,'personal','2',2,NULL,'苗栗市','保育','2026-05-30 16:43:31','2026-05-30 16:43:31'),(11,'personal','2',2,NULL,'竹南鎮','開發','2026-05-30 16:43:32','2026-05-30 16:43:32'),(12,'personal','2',2,NULL,'通霄鎮','我不知道','2026-05-30 16:43:34','2026-05-30 16:43:34'),(13,'personal','2',2,NULL,'西湖鄉','我不知道','2026-05-30 16:43:35','2026-05-30 16:43:35'),(14,'personal','2',2,NULL,'大湖鄉','我不知道','2026-05-30 16:43:36','2026-05-30 16:43:36'),(15,'personal','2',2,NULL,'銅鑼鄉','開發','2026-05-30 16:43:38','2026-05-30 16:43:38'),(16,'personal','2',2,NULL,'三義鄉','開發','2026-05-30 16:43:39','2026-05-30 16:43:39'),(17,'personal','2',2,NULL,'苑裡鎮','保育','2026-05-30 16:43:40','2026-05-30 16:43:40'),(18,'personal','2',2,NULL,'卓蘭鎮','保育','2026-05-30 16:43:41','2026-05-30 16:43:41');
/*!40000 ALTER TABLE `map_choices` ENABLE KEYS */;
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
