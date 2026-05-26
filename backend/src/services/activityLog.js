const pool = require("../db");

function normalizeCardReference(card) {
  if (card == null) return null;
  if (typeof card === "string" || typeof card === "number") return String(card);
  if (typeof card !== "object" || Array.isArray(card)) return null;
  return String(card.id || card.cardId || card.key || "").trim() || null;
}

function sanitizeActivityValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeActivityValue(item)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return value;

  const cardId = normalizeCardReference(value);
  if (cardId && (value.imageSrc || value.title || value.revealedTitle || value.content || value.snapshotMeta)) {
    return { cardId };
  }

  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (["title", "revealedTitle", "frontText", "imageSrc", "content", "snapshotMeta", "photoSnapshotDataUrl", "cards"].includes(key)) continue;
    if (key === "evidenceCards" || key === "investigationCards" || key === "unlockedCards") {
      result[`${key}Ids`] = (Array.isArray(raw) ? raw : []).map(normalizeCardReference).filter(Boolean);
      continue;
    }
    if (key === "latestSummary" && raw && typeof raw === "object") {
      result.latestSummary = {
        recordOrder: raw.recordOrder || null,
        evidenceCardIds: (Array.isArray(raw.evidenceCards) ? raw.evidenceCards : []).map(normalizeCardReference).filter(Boolean),
        hasConclusion: Boolean(raw.conclusion),
      };
      continue;
    }
    result[key] = sanitizeActivityValue(raw);
  }
  return result;
}

async function hasRecentDuplicateActivityLog({
  userId = null,
  eventType,
  targetType = null,
  targetId = null,
  newValueText = null,
  metadataText = null,
}) {
  if (!eventType) return false;

  const [rows] = await pool.query(
    `SELECT id
     FROM student_activity_logs
     WHERE user_id <=> ?
       AND event_type = ?
       AND target_type <=> ?
       AND target_id <=> ?
       AND new_value <=> ?
       AND metadata <=> ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND)
     LIMIT 1`,
    [userId, eventType, targetType, targetId, newValueText, metadataText],
  );

  return rows.length > 0;
}

async function insertStudentActivityLog({
  userId = null,
  username = null,
  role = "student",
  groupId = null,
  eventType,
  eventLabel = null,
  targetType = null,
  targetId = null,
  previousValue = null,
  newValue = null,
  metadata = null,
}) {
  if (!eventType || role === "teacher") return;

  try {
    const previousValueText = previousValue == null ? null : JSON.stringify(sanitizeActivityValue(previousValue));
    const newValueText = newValue == null ? null : JSON.stringify(sanitizeActivityValue(newValue));
    const metadataText = metadata == null ? null : JSON.stringify(sanitizeActivityValue(metadata));

    const isDuplicate = await hasRecentDuplicateActivityLog({
      userId,
      eventType,
      targetType,
      targetId,
      newValueText,
      metadataText,
    });
    if (isDuplicate) return;

    await pool.query(
      `INSERT INTO student_activity_logs (
        user_id, username, role, group_id, event_type, event_label,
        target_type, target_id, previous_value, new_value, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        role || "student",
        groupId,
        eventType,
        eventLabel,
        targetType,
        targetId,
        previousValueText,
        newValueText,
        metadataText,
      ],
    );
  } catch (error) {
    console.error("學生遊戲紀錄寫入失敗（不中斷主要流程）：", error);
  }
}

module.exports = {
  insertStudentActivityLog,
  sanitizeActivityValue,
  normalizeCardReference,
};
