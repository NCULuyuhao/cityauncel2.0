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
-- Temporary view structure for view `v_student_progress_summary`
--

DROP TABLE IF EXISTS `v_student_progress_summary`;
/*!50001 DROP VIEW IF EXISTS `v_student_progress_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_student_progress_summary` AS SELECT 
 1 AS `user_id`,
 1 AS `username`,
 1 AS `group_id`,
 1 AS `is_group_leader`,
 1 AS `inquiry_count`,
 1 AS `unlocked_card_count`,
 1 AS `title_count`,
 1 AS `barrage_coins`,
 1 AS `latest_inquiry_ended_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_activity_event_summary`
--

DROP TABLE IF EXISTS `v_activity_event_summary`;
/*!50001 DROP VIEW IF EXISTS `v_activity_event_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_activity_event_summary` AS SELECT 
 1 AS `event_type`,
 1 AS `target_type`,
 1 AS `event_count`,
 1 AS `unique_user_count`,
 1 AS `first_event_at`,
 1 AS `latest_event_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_card_analysis_summary`
--

DROP TABLE IF EXISTS `v_card_analysis_summary`;
/*!50001 DROP VIEW IF EXISTS `v_card_analysis_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_card_analysis_summary` AS SELECT 
 1 AS `card_id`,
 1 AS `category`,
 1 AS `unlocked_user_count`,
 1 AS `inquiry_used_count`,
 1 AS `evidence_used_count`,
 1 AS `first_unlocked_at`,
 1 AS `latest_updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `v_student_progress_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_student_progress_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_student_progress_summary` AS select `u`.`id` AS `user_id`,`u`.`username` AS `username`,`u`.`group_id` AS `group_id`,`u`.`is_group_leader` AS `is_group_leader`,count(distinct `ir`.`id`) AS `inquiry_count`,count(distinct `suc`.`card_id`) AS `unlocked_card_count`,count(distinct `sr`.`reward_key`) AS `title_count`,coalesce(`u`.`barrage_coins`,0) AS `barrage_coins`,max(`ir`.`ended_at`) AS `latest_inquiry_ended_at` from (((`users` `u` left join `inquiry_records` `ir` on((`ir`.`user_id` = `u`.`id`))) left join `student_unlocked_cards` `suc` on((`suc`.`user_id` = `u`.`id`))) left join `student_rewards` `sr` on(((`sr`.`user_id` = `u`.`id`) and (`sr`.`reward_type` = 'title')))) where (`u`.`role` = 'student') group by `u`.`id`,`u`.`username`,`u`.`group_id`,`u`.`is_group_leader`,`u`.`barrage_coins` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_activity_event_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_activity_event_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_activity_event_summary` AS select `student_activity_logs`.`event_type` AS `event_type`,`student_activity_logs`.`target_type` AS `target_type`,count(0) AS `event_count`,count(distinct `student_activity_logs`.`user_id`) AS `unique_user_count`,min(`student_activity_logs`.`created_at`) AS `first_event_at`,max(`student_activity_logs`.`created_at`) AS `latest_event_at` from `student_activity_logs` group by `student_activity_logs`.`event_type`,`student_activity_logs`.`target_type` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_card_analysis_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_card_analysis_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_card_analysis_summary` AS select `suc`.`card_id` AS `card_id`,`dcs`.`category` AS `category`,count(distinct `suc`.`user_id`) AS `unlocked_user_count`,count(distinct `irc`.`inquiry_record_id`) AS `inquiry_used_count`,count(distinct (case when (`irc`.`is_evidence` = 1) then `irc`.`inquiry_record_id` end)) AS `evidence_used_count`,min(`suc`.`unlocked_at`) AS `first_unlocked_at`,max(`suc`.`updated_at`) AS `latest_updated_at` from ((`student_unlocked_cards` `suc` left join `data_card_sources` `dcs` on((`dcs`.`card_id` = `suc`.`card_id`))) left join `inquiry_record_cards` `irc` on((`irc`.`card_id` = `suc`.`card_id`))) group by `suc`.`card_id`,`dcs`.`category` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-31  1:05:10
