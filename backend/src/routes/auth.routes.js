const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");

function createAuthRoutes({
  ensureUsersGenderColumn,
  ensureStudentCoinBalance,
  getRequestUserProfile,
  mapGroupName,
}) {
  const router = express.Router();

  router.post("/api/register", async (req, res) => {
    try {
      await ensureUsersGenderColumn();
      const { username, password, gender } = req.body;
      const trimmedUsername = String(username || "").trim();
      if (!trimmedUsername || !password || !["male", "female"].includes(String(gender || ""))) {
        return res.status(400).json({ message: "請填寫完整資料，並選擇性別" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        `INSERT INTO users (username, password_hash, role, gender, group_id, is_group_leader)
         VALUES (?, ?, 'student', ?, NULL, 0)`,
        [trimmedUsername, passwordHash, String(gender)],
      );

      await ensureStudentCoinBalance(result.insertId);
      res.json({ message: "註冊成功" });
    } catch (error) {
      console.error(error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "帳號已被使用" });
      }
      res.status(500).json({ message: "伺服器錯誤" });
    }
  });

  router.post("/api/login", async (req, res) => {
    try {
      await ensureUsersGenderColumn();
      const { account, password } = req.body;
      if (!account || !password) {
        return res.status(400).json({ message: "請輸入帳號與密碼" });
      }

      const [users] = await pool.query(
        `SELECT id, username, NULL AS email, password_hash, role, gender, group_id, is_group_leader
         FROM users
         WHERE username = ?`,
        [account],
      );

      if (users.length === 0) return res.status(401).json({ message: "帳號或密碼錯誤" });

      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return res.status(401).json({ message: "帳號或密碼錯誤" });

      const role = user.role || "student";
      if (role !== "teacher") await ensureStudentCoinBalance(user.id);

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      if (role !== "teacher") {
        insertStudentActivityLog({
          userId: user.id,
          username: user.username,
          role,
          gender: user.gender || null,
          groupId: user.group_id || null,
          eventType: "login",
          eventLabel: "學生登入",
          metadata: { account },
        });
      }

      res.json({
        message: "登入成功",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role,
          groupId: user.group_id || null,
          groupName: mapGroupName(user.group_id),
          isGroupLeader: Boolean(user.is_group_leader),
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "伺服器錯誤" });
    }
  });

  router.get("/api/me", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      if (!user) return res.status(404).json({ message: "找不到使用者" });

      const groupId = user.group_id || null;
      let groupMembers = [];
      if (groupId) {
        const [memberRows] = await pool.query(
          `SELECT id, username, NULL AS email, is_group_leader
           FROM users
           WHERE group_id = ? AND COALESCE(role, 'student') = 'student'
           ORDER BY is_group_leader DESC, id ASC`,
          [groupId],
        );
        groupMembers = memberRows.map((member) => ({
          id: member.id,
          username: member.username,
          name: member.username,
          email: member.email,
          isGroupLeader: Boolean(member.is_group_leader),
        }));
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || "student",
          groupId,
          groupName: mapGroupName(groupId),
          isGroupLeader: Boolean(user.is_group_leader),
          groupMembers,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "同步使用者資料失敗" });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
