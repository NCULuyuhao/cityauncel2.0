/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 upload 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const { authenticateToken } = require("../middleware/auth");

function sanitizeUploadName(value) {
  return String(value || "clue")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "clue";
}

function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  return `${proto}://${req.get("host")}`;
}

function createUploadRoutes({ clueSnapshotUploadDir }) {
  const router = express.Router();

  router.post("/api/clue-snapshots", authenticateToken, async (req, res) => {
    try {
      const imageDataUrl = String(req.body?.imageDataUrl || "");
      const match = imageDataUrl.match(/^data:image\/(webp|png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i);
      if (!match) {
        return res.status(400).json({ message: "快照圖片格式不正確" });
      }

      const ext = match[1].toLowerCase() === "jpeg" || match[1].toLowerCase() === "jpg" ? "jpg" : match[1].toLowerCase();
      const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
      const maxBytes = Number(process.env.CLUE_SNAPSHOT_MAX_BYTES || 8 * 1024 * 1024);
      if (!buffer.length || buffer.length > maxBytes) {
        return res.status(400).json({ message: "快照圖片太大，請重新擷取" });
      }

      await fs.promises.mkdir(clueSnapshotUploadDir, { recursive: true });
      const userPart = sanitizeUploadName(req.user?.id || req.user?.username || "student");
      const cardPart = sanitizeUploadName(req.body?.cardId || req.body?.title || "snapshot");
      const filename = `${Date.now()}-${userPart}-${cardPart}.${ext}`;
      const filePath = path.join(clueSnapshotUploadDir, filename);
      await fs.promises.writeFile(filePath, buffer);

      const relativeUrl = `/uploads/clue_snapshots/${filename}`;
      return res.json({
        message: "快照圖片已建立",
        filename,
        relativeUrl,
        imageUrl: `${getRequestBaseUrl(req)}${relativeUrl}`,
      });
    } catch (error) {
      console.error("建立線索快照圖片失敗：", error);
      return res.status(500).json({ message: "建立線索快照圖片失敗" });
    }
  });

  return router;
}

module.exports = createUploadRoutes;
