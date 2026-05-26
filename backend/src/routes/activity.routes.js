const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");

function createActivityRoutes({ getActor }) {
  const router = express.Router();

  router.post("/api/activity-log", authenticateToken, async (req, res) => {
    try {
      const {
        eventType,
        eventLabel = null,
        targetType = null,
        targetId = null,
        previousValue = null,
        newValue = null,
        metadata = null,
      } = req.body || {};

      if (!eventType || typeof eventType !== "string") {
        return res.status(400).json({ message: "缺少活動紀錄類型" });
      }

      const actor = await getActor(req.user.id, req.user);
      await insertStudentActivityLog({
        ...actor,
        eventType,
        eventLabel,
        targetType,
        targetId,
        previousValue,
        newValue,
        metadata,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("活動紀錄寫入失敗：", error);
      res.status(500).json({ message: "活動紀錄寫入失敗" });
    }
  });

  return router;
}

module.exports = createActivityRoutes;
