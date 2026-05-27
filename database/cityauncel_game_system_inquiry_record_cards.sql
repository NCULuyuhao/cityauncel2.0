-- CityAuncel maintainability notes
-- 檔案用途：MySQL schema 腳本 cityauncel_game_system_inquiry_record_cards.sql，定義資料表、索引或資料庫重建流程。
-- 維護重點：修改欄位或索引後，請同步檢查後端 SQL 與教師端分析查詢。

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
-- Table structure for table `inquiry_record_cards`
--

DROP TABLE IF EXISTS `inquiry_record_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inquiry_record_cards`
--

LOCK TABLES `inquiry_record_cards` WRITE;
/*!40000 ALTER TABLE `inquiry_record_cards` DISABLE KEYS */;
/*!40000 ALTER TABLE `inquiry_record_cards` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-24 20:13:39
