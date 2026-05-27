/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 gameStatus 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");

const { authenticateToken, requireTeacher } = require("../middleware/auth");

function createGameStatusRoutes({ getGameSetting, setGameSetting, publishRealtimeEvent }) {
  const router = express.Router();

  router.get("/api/map-task-status", authenticateToken, async (req, res) => {
    try {
      const status = await getGameSetting("map_task_status", { isOpen: false });
      res.json({ isOpen: Boolean(status.isOpen) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取地圖任務狀態失敗" });
    }
  });

  router.put("/api/map-task-status", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const isOpen = Boolean(req.body?.isOpen);
      await setGameSetting("map_task_status", { isOpen });
      const payload = { message: isOpen ? "地圖任務已開啟" : "地圖任務已關閉", isOpen };
      publishRealtimeEvent("map-task-status", payload);
      publishRealtimeEvent("teacher-controls", { mapTaskOpen: isOpen });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新地圖任務狀態失敗" });
    }
  });

  router.get("/api/inquiry-task-status", authenticateToken, async (req, res) => {
    try {
      const status = await getGameSetting("inquiry_task_status", { isOpen: true });
      res.json({ isOpen: status.isOpen !== false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取探究調查狀態失敗" });
    }
  });

  router.put("/api/inquiry-task-status", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const isOpen = Boolean(req.body?.isOpen);
      await setGameSetting("inquiry_task_status", { isOpen });
      const payload = { message: isOpen ? "探究調查已開啟" : "探究調查已關閉", isOpen };
      publishRealtimeEvent("inquiry-task-status", payload);
      publishRealtimeEvent("teacher-controls", { inquiryTaskOpen: isOpen });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新探究調查狀態失敗" });
    }
  });

  router.get("/api/card-pack-status", authenticateToken, async (req, res) => {
    try {
      const status = await getGameSetting("card_pack_status", { isOpen: false });
      res.json({ isOpen: Boolean(status.isOpen) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取石虎卡包狀態失敗" });
    }
  });

  router.put("/api/card-pack-status", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const isOpen = Boolean(req.body?.isOpen);
      await setGameSetting("card_pack_status", {
        isOpen,
        updatedAt: new Date().toISOString(),
      });
      const payload = { message: isOpen ? "抽卡已開啟" : "抽卡已關閉", isOpen };
      publishRealtimeEvent("card-pack-status", payload);
      publishRealtimeEvent("teacher-controls", { cardPackOpen: isOpen });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新石虎卡包狀態失敗" });
    }
  });

  router.get("/api/student-screen-lock", authenticateToken, async (req, res) => {
    try {
      const status = await getGameSetting("student_screen_lock", { locked: false, isLocked: false });
      const locked = Boolean(status.locked ?? status.isLocked);
      res.json({ locked, isLocked: locked });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取學生畫面鎖定狀態失敗" });
    }
  });

  router.put("/api/student-screen-lock", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const locked = typeof req.body?.locked === "boolean" ? req.body.locked : Boolean(req.body?.isLocked);
      await setGameSetting("student_screen_lock", { locked, isLocked: locked, updatedAt: new Date().toISOString() });
      const payload = { message: locked ? "學生畫面已鎖定" : "學生畫面已解鎖", locked, isLocked: locked };
      publishRealtimeEvent("student-screen-lock", payload);
      publishRealtimeEvent("teacher-controls", { studentScreenLocked: locked });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新學生畫面鎖定狀態失敗" });
    }
  });

  return router;
}

module.exports = createGameStatusRoutes;
