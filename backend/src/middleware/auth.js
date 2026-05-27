/**
 * CityAuncel maintainability notes
 * 檔案用途：提供 JWT 驗證、登入者解析與教師權限檢查 middleware。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const jwt = require("jsonwebtoken");
const pool = require("../db");

async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "未登入" });

  let decodedUser;
  try {
    decodedUser = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ message: "登入過期，請重新登入" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, username, NULL AS email, role, gender, group_id, is_group_leader
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decodedUser.id],
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "帳號資料不存在，請重新登入" });
    }

    req.user = {
      ...decodedUser,
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || decodedUser.role || "student",
      gender: user.gender || null,
      group_id: user.group_id || null,
      groupId: user.group_id || null,
      is_group_leader: Boolean(user.is_group_leader),
      isGroupLeader: Boolean(user.is_group_leader),
    };
    next();
  } catch (error) {
    console.error("驗證登入狀態失敗：", error);
    return res.status(500).json({ message: "驗證登入狀態失敗" });
  }
}

function requireTeacher(req, res, next) {
  if (req.user?.role !== "teacher") {
    return res.status(403).json({ message: "需要教師權限" });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireTeacher,
};
