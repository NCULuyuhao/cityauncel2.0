/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一探究資料服務，負責把前端草稿、調查書、證據卡、蒐集理由與稱號轉成正規化資料表，也負責讀回前端需要的整包狀態。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

/**
 * Inquiry data service
 *
 * Keeps inquiry normalization, persistence, reward, card, and activity-log logic
 * outside the Express route layer. Routes should stay focused on request/response
 * handling and transaction boundaries.
 */

const pool = require("../db");
const { ensureDataCardSourcesTable, ensureInquiryNormalizedTables } = require("./schemaUtils");
const { ensureStudentCoinBalance: ensureUserCoinBalance } = require("./users");

const MAX_BARRAGE_COINS = 10;
const FINAL_SUMMARY_COIN_REWARD = 5;
const HOME_TITLE_REWARDS = {
  investigation_novice: { id: "investigation_novice", name: "見習調查員", description: "完成 1 份探究調查成果" },
  investigation_advanced: { id: "investigation_advanced", name: "資深調查員", description: "完成 4 份探究調查成果" },
  investigation_master: { id: "investigation_master", name: "首席調查官", description: "完成 5 份探究調查成果" },
};

function parseJSON(data, fallback) {
  try {
    if (data == null) return fallback;
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return fallback;
  }
}

function stringify(value) {
  return JSON.stringify(value ?? null);
}

function normalizeCardReference(card) {
  if (card == null) return null;
  if (typeof card === "string" || typeof card === "number") return String(card);
  if (typeof card !== "object" || Array.isArray(card)) return null;
  return String(card.id || card.cardId || card.card_id || card.key || "").trim() || null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getCardType(card) {
  return firstString(card?.type, card?.category, card?.cardType, card?.card_type);
}

function getCardSource(card) {
  return firstString(card?.source, card?.sourceType, card?.source_type) || "fixedImage";
}

function getCardNote(card) {
  return firstString(card?.note, card?.content, card?.text, card?.answer);
}

function getCardTitle(card) {
  return firstString(card?.title, card?.revealedTitle, card?.displayTitle);
}

function getCardImage(card) {
  return firstString(card?.image, card?.imageSrc, card?.image_url);
}

function normalizeUploadUrlForStorage(value) {
  const text = firstString(value);
  if (!text) return "";
  if (text.startsWith("/uploads/")) return text;
  try {
    const parsed = new URL(text);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Keep non-URL assets such as /card/*.webp unchanged.
  }
  return text;
}

function getCardSnapshot(card) {
  return card?.snapshot || card?.snapshotMeta || card?.meta || null;
}

function getCardRound(card) {
  const numeric = Number(card?.round ?? card?.unlockedInInquiryOrder ?? card?.inquiryOrder ?? card?.recordOrder);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeIsoTime(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toSqlDateTimeValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSnapshotKeys(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined;
  const result = {};
  for (const [key, raw] of Object.entries(snapshot)) {
    if (key === "photoSnapshotDataUrl" || key === "canvasDataUrl" || key === "screenshotDataUrl") continue;
    result[key === "category" ? "type" : key] = raw;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function denormalizeSnapshotForClient(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined;
  return {
    ...snapshot,
    category: snapshot.category || snapshot.type,
  };
}

function toClientCard(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return card;
  const id = normalizeCardReference(card);
  if (!id) return card;
  const snapshot = getCardSnapshot(card);
  return {
    ...card,
    id,
    category: getCardType(card) || card.category,
    sourceType: getCardSource(card),
    title: getCardTitle(card) || card.title,
    revealedTitle: card.revealedTitle || getCardTitle(card),
    imageSrc: normalizeUploadUrlForStorage(getCardImage(card) || card.imageSrc || ""),
    content: getCardNote(card),
    snapshotMeta: denormalizeSnapshotForClient(snapshot),
    unlockedInInquiryOrder: getCardRound(card) || card.unlockedInInquiryOrder || null,
  };
}

function sanitizeActivityValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeActivityValue(item)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return value;

  const cardId = normalizeCardReference(value);
  if (cardId && (value.image || value.imageSrc || value.title || value.revealedTitle || value.content || value.note || value.snapshot || value.snapshotMeta)) {
    return { id: cardId };
  }

  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (["title", "revealedTitle", "frontText", "image", "imageSrc", "content", "note", "snapshot", "snapshotMeta", "photoSnapshotDataUrl", "cards"].includes(key)) continue;
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

async function ensureStudentCoinBalanceWithConnection(connection, userId) {
  await ensureUserCoinBalance(userId, connection);
}

async function ensureStudentCoinBalance(userId) {
  await ensureUserCoinBalance(userId);
}

async function getActor(userId, tokenUser = {}) {
  const [rows] = await pool.query(
    `SELECT id, username, NULL AS email, role, group_id
     FROM users
     WHERE id = ?`,
    [userId],
  );
  const user = rows[0] || null;
  return {
    userId,
    username: user?.username || tokenUser.username || null,
    role: user?.role || tokenUser.role || "student",
    groupId: user?.group_id || null,
  };
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

function normalizeOrientationData(plan) {
  if (!plan) return null;
  if (Array.isArray(plan)) return plan;
  if (typeof plan !== "object") return null;

  if (Array.isArray(plan?.introStage?.records)) return plan.introStage.records;
  if (Array.isArray(plan?.records)) return plan.records;
  return null;
}


function getOrientationRecordText(records, type, occurrence = 0) {
  const matches = (Array.isArray(records) ? records : []).filter((record) => record?.type === type);
  const target = matches[occurrence];
  if (!target) return "";
  return Array.isArray(target.content) ? target.content.join("、") : String(target.content || "");
}

function getOrientationTextInput(records) {
  return getOrientationRecordText(records, "textInput");
}

function normalizeStoredCard(card) {
  if (card == null) return null;

  if (typeof card === "string" || typeof card === "number") {
    const id = String(card).trim();
    return id ? { id } : null;
  }

  if (typeof card !== "object" || Array.isArray(card)) return null;

  const id = normalizeCardReference(card);
  if (!id) return null;

  const type = getCardType(card);
  const source = getCardSource(card);
  const title = getCardTitle(card);
  const note = getCardNote(card);
  const image = getCardImage(card);
  const snapshot = normalizeSnapshotKeys(getCardSnapshot(card));
  const round = getCardRound(card);

  const normalized = { id };
  if (type) normalized.type = type;
  if (source) normalized.source = source;
  if (title) normalized.title = title;
  if (note) normalized.note = note;
  const unlockedAt = normalizeIsoTime(card.unlockedAt);
  if (unlockedAt) normalized.unlockedAt = unlockedAt;
  if (round) normalized.round = round;
  if (source === "interactiveSnapshot") {
    if (image && !image.startsWith("data:image/png") && !image.startsWith("data:image/jpeg")) normalized.image = image;
    if (snapshot) normalized.snapshot = snapshot;
  }
  if (typeof card.sharedFromOtherPlayer === "boolean") normalized.sharedFromOtherPlayer = card.sharedFromOtherPlayer;
  if (typeof card.sharedAuthorName === "string" && card.sharedAuthorName.trim()) normalized.sharedAuthorName = card.sharedAuthorName.trim();

  return normalized;
}

function normalizeStoredCards(cards) {
  const result = [];
  const seen = new Set();

  for (const rawCard of Array.isArray(cards) ? cards : []) {
    const card = normalizeStoredCard(rawCard);
    if (!card) continue;

    if (seen.has(card.id)) {
      const existing = result.find((item) => item.id === card.id);
      if (existing && !existing.note && card.note) existing.note = card.note;
      continue;
    }

    seen.add(card.id);
    result.push(card);
  }

  return result;
}

function normalizeStoredCardIds(cards) {
  const result = [];
  const seen = new Set();

  for (const rawCard of Array.isArray(cards) ? cards : []) {
    const id = String(
      typeof rawCard === "string" || typeof rawCard === "number"
        ? rawCard
        : rawCard?.id || rawCard?.cardId || rawCard?.card_id || rawCard?.key || "",
    ).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

function buildEvidenceCardSummaries(evidenceCardIds, investigationCards) {
  const cardById = new Map(
    (Array.isArray(investigationCards) ? investigationCards : [])
      .filter((card) => card && typeof card === "object" && !Array.isArray(card) && card.id)
      .map((card) => [String(card.id), card]),
  );

  return (Array.isArray(evidenceCardIds) ? evidenceCardIds : [])
    .map((id) => {
      const cardId = String(id || "").trim();
      if (!cardId) return null;
      const card = cardById.get(cardId);
      if (!card) return cardId;
      const clientCard = toClientCard(card);
      return {
        id: cardId,
        title: String(clientCard.revealedTitle || clientCard.title || cardId),
        imageSrc: typeof clientCard.imageSrc === "string" ? clientCard.imageSrc : "",
        content: typeof clientCard.content === "string" ? clientCard.content : "",
        category: typeof clientCard.category === "string" ? clientCard.category : undefined,
        sourceType: typeof clientCard.sourceType === "string" ? clientCard.sourceType : undefined,
        snapshotMeta:
          clientCard.snapshotMeta && typeof clientCard.snapshotMeta === "object" && !Array.isArray(clientCard.snapshotMeta)
            ? clientCard.snapshotMeta
            : undefined,
      };
    })
    .filter(Boolean);
}

function buildCardReflectionNoteLookup(finalSummaries) {
  const noteByCardId = new Map();

  for (const summary of Array.isArray(finalSummaries) ? finalSummaries : []) {
    const reflections = Array.isArray(summary?.collectionReflections)
      ? summary.collectionReflections
      : [];

    for (const reflection of reflections) {
      const note = firstString(reflection?.reason, reflection?.note);
      if (!note) continue;

      const cardIds = normalizeStoredCardIds(
        Array.isArray(reflection?.cardIds) ? reflection.cardIds : [],
      );
      cardIds.forEach((cardId) => noteByCardId.set(cardId, note));
    }
  }

  return noteByCardId;
}

function attachReflectionNoteToCard(card, noteByCardId) {
  const id = normalizeCardReference(card);
  if (!id) return card;

  const note = noteByCardId instanceof Map ? noteByCardId.get(id) : "";
  if (!note) return card;

  const base = card && typeof card === "object" && !Array.isArray(card)
    ? { ...card, id }
    : { id };

  return {
    ...base,
    note,
    studentNote: note,
    reflectionNote: note,
  };
}

function buildInquiryUnlockedCardsByOrder(finalSummaries) {
  const result = {};
  for (const summary of Array.isArray(finalSummaries) ? finalSummaries : []) {
    const recordOrder = Number(summary?.recordOrder || 0);
    if (!Number.isFinite(recordOrder) || recordOrder <= 0) continue;
    const cards = Array.isArray(summary?.investigationCards) ? summary.investigationCards : [];
    const noteByCardId = buildCardReflectionNoteLookup([summary]);

    result[String(recordOrder)] = cards.map((card) => ({
      ...attachReflectionNoteToCard(
        card && typeof card === "object" && !Array.isArray(card) ? card : { id: String(card) },
        noteByCardId,
      ),
      unlockedInInquiryOrder: recordOrder,
      orientationCreatedAt: summary.orientationCreatedAt || null,
      unlockedInInquiryCreatedAt: summary.orientationCreatedAt || null,
    }));
  }
  return result;
}

function normalizeInvestigationData(summary) {
  const safeSummary = summary && typeof summary === "object" ? summary : {};
  const unlockedCards =
    Array.isArray(safeSummary.cards)
      ? safeSummary.cards
      : Array.isArray(safeSummary.investigationCards)
        ? safeSummary.investigationCards
        : Array.isArray(safeSummary.currentRoundUnlockedCards)
          ? safeSummary.currentRoundUnlockedCards
          : Array.isArray(safeSummary.unlockedCards)
            ? safeSummary.unlockedCards
            : [];

  const collectionReflections = Array.isArray(safeSummary.collectionReflections)
    ? safeSummary.collectionReflections
        .map((record) => {
          const cardIds = normalizeStoredCardIds(Array.isArray(record?.cardIds) ? record.cardIds : []);
          const note = firstString(record?.reason, record?.note);
          if (cardIds.length === 0 || !note) return null;
          return {
            id: firstString(record?.id) || `collection-batch-${Date.now()}`,
            createdAt: firstString(record?.createdAt) || new Date().toISOString(),
            inquiryOrder: Number.isFinite(Number(record?.inquiryOrder)) ? Number(record.inquiryOrder) : null,
            cardIds,
            note,
          };
        })
        .filter(Boolean)
    : [];

  return {
    investigationCreatedAt: safeSummary.investigationCreatedAt ? String(safeSummary.investigationCreatedAt) : new Date().toISOString(),
    cards: normalizeStoredCards(unlockedCards),
    collectionBatches: collectionReflections,
  };
}

function normalizeConclusionData(summary) {
  const safeSummary = summary && typeof summary === "object" ? summary : {};
  const conclusion = String(safeSummary.conclusion || "").trim();
  const evidenceCards = normalizeStoredCardIds(
    Array.isArray(safeSummary.evidenceCards) ? safeSummary.evidenceCards : [],
  );

  if (!conclusion && evidenceCards.length === 0) return null;

  return {
    conclusionCreatedAt: safeSummary.conclusionCreatedAt ? String(safeSummary.conclusionCreatedAt) : new Date().toISOString(),
    evidenceCards,
    conclusion,
  };
}

function getSummaryOrientationCreatedAt(summary) {
  const safeSummary = summary && typeof summary === "object" ? summary : {};
  const createdAt =
    safeSummary.orientationCreatedAt ||
    safeSummary.createdAt ||
    safeSummary.inquiryCreatedAt ||
    null;
  return createdAt ? String(createdAt) : null;
}

function normalizeFinalSummaryData(summary) {
  const safeSummary = summary && typeof summary === "object" ? summary : {};
  const orientationCreatedAt = getSummaryOrientationCreatedAt(safeSummary);
  const investigationCards =
    Array.isArray(safeSummary.cards)
      ? safeSummary.cards
      : Array.isArray(safeSummary.investigationCards)
        ? safeSummary.investigationCards
        : Array.isArray(safeSummary.currentRoundUnlockedCards)
          ? safeSummary.currentRoundUnlockedCards
          : Array.isArray(safeSummary.unlockedCards)
            ? safeSummary.unlockedCards
            : [];

  const introStage = safeSummary.introStage && typeof safeSummary.introStage === "object" ? safeSummary.introStage : null;
  const orientationRecords = normalizeOrientationData(introStage);

  return {
    recordOrder: Number.isFinite(Number(safeSummary.recordOrder)) ? Number(safeSummary.recordOrder) : null,
    orientationMainChoice: getOrientationRecordText(orientationRecords, "mainChoice"),
    orientationTextInput: getOrientationTextInput(orientationRecords),
    introStage,
    orientationCreatedAt,
    investigationCreatedAt: safeSummary.investigationCreatedAt ? String(safeSummary.investigationCreatedAt) : null,
    conclusionCreatedAt: safeSummary.conclusionCreatedAt ? String(safeSummary.conclusionCreatedAt) : null,
    investigationCards: normalizeStoredCards(investigationCards),
    evidenceCards: normalizeStoredCardIds(Array.isArray(safeSummary.evidenceCards) ? safeSummary.evidenceCards : []),
    conclusion: String(safeSummary.conclusion || ""),
    collectionReflections: Array.isArray(safeSummary.collectionReflections) ? safeSummary.collectionReflections : [],
  };
}

function stableJSONString(value) {
  return JSON.stringify(value ?? null);
}

function orientationKeyFromPlan(plan) {
  const records = normalizeOrientationData(plan);
  return records ? stableJSONString(records) : "";
}

function getPlanCreatedAt(plan) {
  return plan?.createdAt || plan?.introStage?.createdAt || null;
}

function getPlanRecordOrder(plan) {
  const recordOrder = Number(plan?.recordOrder || plan?.record_order || 0);
  return Number.isFinite(recordOrder) && recordOrder > 0 ? recordOrder : null;
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  const records = normalizeOrientationData(plan);
  if (!records) return null;
  return {
    ...plan,
    introStage: { records },
    recordOrder: getPlanRecordOrder(plan),
    createdAt: getPlanCreatedAt(plan) || null,
    orientationCreatedAt: plan.orientationCreatedAt || null,
  };
}

function uniquePlans(plans) {
  const result = [];
  const seenCreatedAt = new Set();
  const seenRecordOrder = new Set();
  const seenFallbackOrientation = new Set();

  for (const rawPlan of Array.isArray(plans) ? plans : []) {
    const plan = normalizePlan(rawPlan);
    if (!plan) continue;

    const createdAt = getPlanCreatedAt(plan);
    const recordOrder = getPlanRecordOrder(plan);
    const orientationKey = orientationKeyFromPlan(plan);
    const duplicateByCreatedAt = createdAt && seenCreatedAt.has(String(createdAt));
    const duplicateByRecordOrder = recordOrder && seenRecordOrder.has(String(recordOrder));
    // 只有在沒有 recordOrder / createdAt 這種可靠回合鍵時，才用前導答案本身去重。
    // 否則學生不同回合填相同前導答案時，會被誤判為同一份調查書，造成後續存取看起來沒反應。
    const fallbackOrientationKey = !createdAt && !recordOrder && orientationKey ? orientationKey : "";
    const duplicateByFallbackOrientation = fallbackOrientationKey && seenFallbackOrientation.has(fallbackOrientationKey);

    if (duplicateByCreatedAt || duplicateByRecordOrder || duplicateByFallbackOrientation) continue;

    if (createdAt) seenCreatedAt.add(String(createdAt));
    if (recordOrder) seenRecordOrder.add(String(recordOrder));
    if (fallbackOrientationKey) seenFallbackOrientation.add(fallbackOrientationKey);
    result.push(plan);
  }

  return result;
}

function normalizeSummaryWithPlanLink(summary, plans) {
  const normalized = normalizeFinalSummaryData(summary);
  if (normalized.orientationCreatedAt) return normalized;

  const matchedByRecordOrder = normalized.recordOrder
    ? plans.find((plan) => getPlanRecordOrder(plan) === Number(normalized.recordOrder))
    : null;
  if (matchedByRecordOrder?.orientationCreatedAt || matchedByRecordOrder?.createdAt) {
    return {
      ...normalized,
      orientationCreatedAt: String(matchedByRecordOrder.orientationCreatedAt || matchedByRecordOrder.createdAt),
      introStage: normalized.introStage || matchedByRecordOrder.introStage || null,
    };
  }

  if (!normalized.introStage) return normalized;

  const summaryOrientationKey = orientationKeyFromPlan({ introStage: normalized.introStage });
  const matchedPlan = plans.find((plan) => orientationKeyFromPlan(plan) === summaryOrientationKey);

  if (matchedPlan?.orientationCreatedAt || matchedPlan?.createdAt) {
    return { ...normalized, orientationCreatedAt: String(matchedPlan.orientationCreatedAt || matchedPlan.createdAt) };
  }

  return normalized;
}

function splitOrientationAnswerValues(record) {
  const content = record?.content;
  const values = Array.isArray(content) ? content : [content];
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);
}

function buildOrientationRecordsFromRows(rows) {
  const sortedRows = [...(Array.isArray(rows) ? rows : [])].sort((a, b) =>
    Number(a.response_order || 0) - Number(b.response_order || 0)
      || Number(a.answer_order || 0) - Number(b.answer_order || 0)
      || Number(a.id || 0) - Number(b.id || 0),
  );
  const byResponse = new Map();

  for (const row of sortedRows) {
    const responseOrder = Number(row.response_order || 0);
    const responseType = String(row.response_type || 'answer');
    const key = `${responseOrder}:${responseType}`;
    if (!byResponse.has(key)) {
      byResponse.set(key, { responseOrder, type: responseType, values: [] });
    }
    const answer = String(row.answer_text || '').trim();
    if (answer) byResponse.get(key).values.push(answer);
  }

  return [...byResponse.values()]
    .sort((a, b) => a.responseOrder - b.responseOrder)
    .map((item) => ({
      type: item.type,
      content: item.values.length > 1 ? item.values : item.values[0] || '',
    }));
}

function buildCollectionReflectionsFromRows(noteRows, noteCardRows) {
  const cardRowsByNoteId = new Map();
  for (const row of Array.isArray(noteCardRows) ? noteCardRows : []) {
    const noteId = String(row.note_id || '');
    if (!noteId) continue;
    if (!cardRowsByNoteId.has(noteId)) cardRowsByNoteId.set(noteId, []);
    cardRowsByNoteId.get(noteId).push(row);
  }

  return (Array.isArray(noteRows) ? noteRows : [])
    .map((row) => {
      const noteId = String(row.id || '');
      const cardIds = (cardRowsByNoteId.get(noteId) || [])
        .sort((a, b) => Number(a.card_order || 0) - Number(b.card_order || 0))
        .map((cardRow) => String(cardRow.card_id || '').trim())
        .filter(Boolean);
      const reason = String(row.note_text || '').trim();
      if (!reason || cardIds.length === 0) return null;
      return {
        id: String(row.note_key || row.id),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        inquiryOrder: Number(row.record_order || 0) || null,
        cardIds,
        reason,
      };
    })
    .filter(Boolean);
}

function buildInvestigationCardsFromRows(cardRows, collectionReflections) {
  const noteByCardId = buildCardReflectionNoteLookup([{ collectionReflections }]);
  return (Array.isArray(cardRows) ? cardRows : [])
    .sort((a, b) => Number(a.card_order || 0) - Number(b.card_order || 0))
    .map((row) => {
      const base = row.source_type === 'interactiveSnapshot'
        ? buildCardFromSource({
            card_id: row.card_id,
            category: row.category,
            source_type: row.source_type,
            source_payload: row.source_payload,
          }, { unlocked: true })
        : { id: String(row.card_id) };
      return attachReflectionNoteToCard(base, noteByCardId);
    });
}

function buildFinalSummaryFromNormalizedRecord(row, relatedRows) {
  const orientationRecords = relatedRows.orientationRecords || [];
  const collectionReflections = buildCollectionReflectionsFromRows(
    relatedRows.collectionNotes,
    relatedRows.collectionNoteCards,
  );
  const investigationCards = buildInvestigationCardsFromRows(
    relatedRows.investigationCards,
    collectionReflections,
  );
  const evidenceCardIds = (Array.isArray(relatedRows.evidenceCards) ? relatedRows.evidenceCards : [])
    .sort((a, b) => Number(a.evidence_order || 0) - Number(b.evidence_order || 0))
    .map((evidenceRow) => String(evidenceRow.card_id || '').trim())
    .filter(Boolean);
  const evidenceCards = buildEvidenceCardSummaries(evidenceCardIds, investigationCards);
  const conclusion = String(row.conclusion_text || '').trim();

  if (investigationCards.length === 0 && evidenceCards.length === 0 && !conclusion) return null;

  return {
    recordOrder: Number(row.record_order) || null,
    orientationMainChoice: getOrientationRecordText(orientationRecords, 'mainChoice'),
    orientationTextInput: getOrientationTextInput(orientationRecords),
    introStage: orientationRecords.length > 0 ? { records: orientationRecords } : null,
    orientationCreatedAt:
      (row.orientation_created_at ? new Date(row.orientation_created_at).toISOString() : null)
      || (row.started_at ? new Date(row.started_at).toISOString() : null),
    investigationCreatedAt: row.investigation_created_at ? new Date(row.investigation_created_at).toISOString() : null,
    conclusionCreatedAt: row.conclusion_created_at ? new Date(row.conclusion_created_at).toISOString() : null,
    investigationCards,
    evidenceCards,
    conclusion,
    collectionReflections,
  };
}

function buildInquiryPlanFromNormalizedRecord(row, orientationRows) {
  const records = buildOrientationRecordsFromRows(orientationRows);
  if (records.length === 0) return null;
  const createdAt =
    (row.orientation_created_at ? new Date(row.orientation_created_at).toISOString() : null)
    || (row.started_at ? new Date(row.started_at).toISOString() : null)
    || `record-${row.record_order}`;

  return {
    introStage: { records },
    recordOrder: Number(row.record_order) || null,
    createdAt,
    orientationCreatedAt: createdAt,
    orientationMainChoice: getOrientationRecordText(records, 'mainChoice'),
    orientationTextInput: getOrientationTextInput(records),
  };
}

function groupRowsByRecordId(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const recordId = String(row.inquiry_record_id || row.record_id || '');
    if (!recordId) continue;
    if (!map.has(recordId)) map.set(recordId, []);
    map.get(recordId).push(row);
  }
  return map;
}

function getCollectionCardIds(reflections) {
  const ids = new Set();
  for (const reflection of Array.isArray(reflections) ? reflections : []) {
    normalizeStoredCardIds(Array.isArray(reflection?.cardIds) ? reflection.cardIds : [])
      .forEach((cardId) => ids.add(cardId));
  }
  return ids;
}

async function replaceOrientationResponses(connection, inquiryRecordId, records) {
  await connection.query('DELETE FROM inquiry_orientation_responses WHERE inquiry_record_id = ?', [inquiryRecordId]);
  const rows = [];
  (Array.isArray(records) ? records : []).forEach((record, recordIndex) => {
    const values = splitOrientationAnswerValues(record);
    values.forEach((answerText, answerIndex) => {
      rows.push([
        inquiryRecordId,
        recordIndex + 1,
        firstString(record?.type) || 'answer',
        answerIndex + 1,
        answerText,
      ]);
    });
  });
  if (rows.length === 0) return;
  await connection.query(
    `INSERT INTO inquiry_orientation_responses
      (inquiry_record_id, response_order, response_type, answer_order, answer_text)
     VALUES ?`,
    [rows],
  );
}

async function replaceInvestigationCards(connection, inquiryRecordId, userId, cards) {
  // inquiry_record_cards 同時保存「本回合卡片」與「最後證據標記」。
  // 因此重寫本回合卡片前先暫存既有證據標記，避免單獨同步 investigations 時把 final summary 的證據狀態清掉。
  const [existingEvidenceRows] = await connection.query(
    `SELECT card_id, evidence_order, evidence_selected_at
     FROM inquiry_record_cards
     WHERE inquiry_record_id = ? AND is_evidence = 1`,
    [inquiryRecordId],
  );

  await connection.query('DELETE FROM inquiry_record_cards WHERE inquiry_record_id = ?', [inquiryRecordId]);
  const cardMap = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    const cardId = normalizeCardReference(card);
    if (!cardId) continue;
    cardMap.set(cardId, card && typeof card === 'object' && !Array.isArray(card) ? { ...card, id: cardId } : { id: cardId });
  }
  await upsertCardSources(connection, userId, cardMap);
  const rows = [...cardMap.values()].map((card, index) => [
    inquiryRecordId,
    normalizeCardReference(card),
    index + 1,
    toSqlDateTimeValue(card.unlockedAt) || new Date(),
  ]);
  if (rows.length > 0) {
    await connection.query(
      `INSERT INTO inquiry_record_cards (inquiry_record_id, card_id, card_order, unlocked_at)
       VALUES ?
       ON DUPLICATE KEY UPDATE card_order = VALUES(card_order), unlocked_at = COALESCE(inquiry_record_cards.unlocked_at, VALUES(unlocked_at))`,
      [rows],
    );
  }

  if (existingEvidenceRows.length > 0) {
    await connection.query(
      `INSERT INTO inquiry_record_cards
        (inquiry_record_id, card_id, card_order, is_evidence, evidence_order, evidence_selected_at)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         is_evidence = 1,
         evidence_order = VALUES(evidence_order),
         evidence_selected_at = VALUES(evidence_selected_at)`,
      [existingEvidenceRows.map((row, index) => [
        inquiryRecordId,
        String(row.card_id),
        1000 + Number(row.evidence_order || index + 1),
        1,
        Number(row.evidence_order || index + 1),
        row.evidence_selected_at || new Date(),
      ])],
    );
  }
}

async function replaceCollectionNotes(connection, inquiryRecordId, reflections, cards) {
  await connection.query('DELETE FROM inquiry_collection_notes WHERE inquiry_record_id = ?', [inquiryRecordId]);

  const normalizedReflections = [];
  for (const reflection of Array.isArray(reflections) ? reflections : []) {
    const cardIds = normalizeStoredCardIds(Array.isArray(reflection?.cardIds) ? reflection.cardIds : []);
    const note = firstString(reflection?.reason, reflection?.note);
    if (cardIds.length === 0 || !note) continue;
    normalizedReflections.push({
      noteKey: firstString(reflection?.id) || `note-${normalizedReflections.length + 1}`,
      noteText: note,
      createdAt: toSqlDateTimeValue(reflection?.createdAt) || new Date(),
      cardIds,
    });
  }

  // 如果舊前端只把 note 放在卡片身上，而沒有 collectionReflections，轉成一筆 note + 關聯表，避免 note 仍塞在卡片 JSON 裡。
  const alreadyLinkedCardIds = getCollectionCardIds(normalizedReflections.map((reflection) => ({ cardIds: reflection.cardIds })));
  for (const card of Array.isArray(cards) ? cards : []) {
    const cardId = normalizeCardReference(card);
    const note = getCardNote(card);
    if (!cardId || !note || alreadyLinkedCardIds.has(cardId)) continue;
    normalizedReflections.push({
      noteKey: `card-note-${cardId}`,
      noteText: note,
      createdAt: new Date(),
      cardIds: [cardId],
    });
    alreadyLinkedCardIds.add(cardId);
  }

  for (const reflection of normalizedReflections) {
    const [result] = await connection.query(
      `INSERT INTO inquiry_collection_notes (inquiry_record_id, note_key, note_text, created_at)
       VALUES (?, ?, ?, ?)`,
      [inquiryRecordId, reflection.noteKey, reflection.noteText, reflection.createdAt],
    );
    const noteId = result.insertId;
    await connection.query(
      `INSERT INTO inquiry_collection_note_cards (note_id, card_id, card_order)
       VALUES ?`,
      [reflection.cardIds.map((cardId, index) => [noteId, cardId, index + 1])],
    );
  }
}

async function replaceEvidenceCards(connection, inquiryRecordId, evidenceCardIds) {
  // 證據卡一定屬於同一份調查書的卡片集合，不再額外拆 inquiry_evidence_cards。
  // 先清空該份調查書目前證據標記，再把本次採用的證據卡標到 inquiry_record_cards。
  await connection.query(
    `UPDATE inquiry_record_cards
     SET is_evidence = 0, evidence_order = NULL, evidence_selected_at = NULL
     WHERE inquiry_record_id = ?`,
    [inquiryRecordId],
  );

  const ids = normalizeStoredCardIds(evidenceCardIds);
  if (ids.length === 0) return;

  const selectedAt = new Date();
  await connection.query(
    `INSERT INTO inquiry_record_cards
      (inquiry_record_id, card_id, card_order, is_evidence, evidence_order, evidence_selected_at)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       is_evidence = VALUES(is_evidence),
       evidence_order = VALUES(evidence_order),
       evidence_selected_at = VALUES(evidence_selected_at)`,
    [ids.map((cardId, index) => [
      inquiryRecordId,
      cardId,
      1000 + index + 1,
      1,
      index + 1,
      selectedAt,
    ])],
  );
}

// 任務一儲存採「整包同步」：前端送目前完整探究狀態，後端用 record_order 對齊後重建相關子表。
async function replaceInquiryRecords(connection, userId, inquiryPlans, finalSummaries) {
  const rawSummaries = Array.isArray(finalSummaries) ? finalSummaries : [];
  const basePlans = uniquePlans(inquiryPlans);
  const normalizedSummaries = rawSummaries.map((summary) => normalizeSummaryWithPlanLink(summary, basePlans));

  const plansFromSummaries = normalizedSummaries
    .filter((summary) => summary.introStage)
    .map((summary) => ({
      introStage: summary.introStage,
      recordOrder: summary.recordOrder || null,
      orientationCreatedAt: summary.orientationCreatedAt || null,
      createdAt: null,
    }));

  const mergedPlans = uniquePlans([...basePlans, ...plansFromSummaries]);
  const normalizedInvestigations = normalizedSummaries.map(normalizeInvestigationData);
  const normalizedConclusions = normalizedSummaries.map(normalizeConclusionData);

  const [oldRecordRows] = await connection.query(
    `SELECT id, record_order, started_at, ended_at
     FROM inquiry_records
     WHERE user_id = ?`,
    [userId],
  );
  const rowByRecordOrder = new Map(oldRecordRows.map((row) => [Number(row.record_order), row]));

  if (mergedPlans.length === 0 && normalizedSummaries.length === 0) {
    return { normalizedSummaries: [] };
  }

  const summaryIndexByOrientationCreatedAt = new Map();
  const summaryIndexByOrientation = new Map();
  const summaryIndexByRecordOrder = new Map();
  normalizedSummaries.forEach((summary, index) => {
    if (summary.recordOrder) summaryIndexByRecordOrder.set(Number(summary.recordOrder), index);
    if (summary.orientationCreatedAt) summaryIndexByOrientationCreatedAt.set(String(summary.orientationCreatedAt), index);
    const orientationKey = orientationKeyFromPlan({ introStage: summary.introStage });
    if (orientationKey && !summaryIndexByOrientation.has(orientationKey)) {
      summaryIndexByOrientation.set(orientationKey, index);
    }
  });

  const recordOrders = new Set();
  mergedPlans.forEach((plan, index) => recordOrders.add(getPlanRecordOrder(plan) || index + 1));
  normalizedSummaries.forEach((summary, index) => recordOrders.add(Number(summary.recordOrder) || index + 1));

  const syncedRecordOrders = Array.from(recordOrders)
    .map((order) => Number(order))
    .filter((order) => Number.isFinite(order) && order > 0);
  if (syncedRecordOrders.length > 0) {
    await connection.query(
      `DELETE FROM inquiry_records
       WHERE user_id = ? AND record_order NOT IN (?)`,
      [userId, syncedRecordOrders],
    );
  }

  for (const recordOrder of syncedRecordOrders.sort((a, b) => a - b)) {
    const planIndex = mergedPlans.findIndex((plan, index) => (getPlanRecordOrder(plan) || index + 1) === recordOrder);
    const plan = planIndex >= 0 ? mergedPlans[planIndex] : null;
    const orientationRecords = plan ? normalizeOrientationData(plan) : [];
    const existingRow = rowByRecordOrder.get(recordOrder) || null;
    const planStartedAt = toSqlDateTimeValue(plan?.createdAt || existingRow?.started_at) || new Date();
    const orientationCreatedAt = toSqlDateTimeValue(plan?.orientationCreatedAt || plan?.createdAt || existingRow?.started_at) || planStartedAt;
    const linkedSummaryIndex = summaryIndexByRecordOrder.get(recordOrder)
      ?? (plan?.orientationCreatedAt ? summaryIndexByOrientationCreatedAt.get(String(plan.orientationCreatedAt)) : undefined)
      ?? (orientationRecords ? summaryIndexByOrientation.get(stableJSONString(orientationRecords)) : undefined);
    const investigation = linkedSummaryIndex == null ? null : normalizedInvestigations[linkedSummaryIndex] || null;
    const conclusion = linkedSummaryIndex == null ? null : normalizedConclusions[linkedSummaryIndex] || null;
    const investigationCreatedAt = toSqlDateTimeValue(investigation?.investigationCreatedAt);
    const conclusionCreatedAt = toSqlDateTimeValue(conclusion?.conclusionCreatedAt);
    const endedAt = conclusionCreatedAt || (conclusion ? new Date() : existingRow?.ended_at || null);

    let inquiryRecordId = existingRow?.id || null;
    if (inquiryRecordId) {
      await connection.query(
        `UPDATE inquiry_records
         SET orientation_created_at = ?, investigation_created_at = ?, conclusion_created_at = ?, conclusion_text = ?, ended_at = ?
         WHERE id = ?`,
        [
          orientationRecords.length > 0 ? orientationCreatedAt : null,
          investigationCreatedAt,
          conclusionCreatedAt,
          conclusion?.conclusion || null,
          endedAt,
          inquiryRecordId,
        ],
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO inquiry_records
          (user_id, record_order, orientation_created_at, investigation_created_at, conclusion_created_at, conclusion_text, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          recordOrder,
          orientationRecords.length > 0 ? orientationCreatedAt : null,
          investigationCreatedAt,
          conclusionCreatedAt,
          conclusion?.conclusion || null,
          planStartedAt,
          endedAt,
        ],
      );
      inquiryRecordId = result.insertId;
    }

    await replaceOrientationResponses(connection, inquiryRecordId, orientationRecords);
    await replaceInvestigationCards(connection, inquiryRecordId, userId, investigation?.cards || []);
    await replaceCollectionNotes(connection, inquiryRecordId, investigation?.collectionBatches || [], investigation?.cards || []);
    await replaceEvidenceCards(connection, inquiryRecordId, conclusion?.evidenceCards || []);
  }

  return { normalizedSummaries };
}

function isSupportedTitleRewardId(id) {
  return Boolean(id) && !String(id).startsWith("other_");
}

function normalizeTitleData(title) {
  if (typeof title === "string") {
    const id = title.trim();
    if (!isSupportedTitleRewardId(id)) return null;
    return HOME_TITLE_REWARDS[id] || { id, name: id, description: "" };
  }

  if (title && typeof title === "object") {
    const id = String(title.id || title.titleKey || title.key || "").trim();
    if (!id || !isSupportedTitleRewardId(id)) return null;

    return {
      id,
      name: String(title.name || HOME_TITLE_REWARDS[id]?.name || id),
      description: String(title.description || HOME_TITLE_REWARDS[id]?.description || ""),
    };
  }

  return null;
}


const INVESTIGATION_TITLE_THRESHOLDS = [
  { count: 1, reward: HOME_TITLE_REWARDS.investigation_novice },
  { count: 4, reward: HOME_TITLE_REWARDS.investigation_advanced },
  { count: 5, reward: HOME_TITLE_REWARDS.investigation_master },
];

function getInvestigationTitlesForCompletedCount(completedCount) {
  const count = Number(completedCount) || 0;
  return INVESTIGATION_TITLE_THRESHOLDS
    .filter(({ count: threshold }) => count >= threshold)
    .map(({ reward }) => reward);
}

function mergeTitlesById(...titleLists) {
  const titleMap = new Map();

  titleLists.flat().forEach((title) => {
    const normalized = normalizeTitleData(title);
    if (!normalized) return;
    titleMap.set(normalized.id, { ...titleMap.get(normalized.id), ...normalized });
  });

  return Array.from(titleMap.values());
}

function normalizeCardKey(card) {
  if (typeof card === "string") return card;
  return String(card?.id || card?.cardId || card?.key || JSON.stringify(card));
}

async function replaceTitles(connection, userId, titles) {
  const normalizedTitles = (Array.isArray(titles) ? titles : [])
    .map(normalizeTitleData)
    .filter(Boolean);

  const [oldRows] = await connection.query(
    `SELECT reward_key, earned_at
     FROM student_rewards
     WHERE user_id = ? AND reward_type = 'title'`,
    [userId],
  );
  const earnedAtByKey = new Map(oldRows.map((row) => [String(row.reward_key), row.earned_at]));
  const now = new Date();

  await connection.query("DELETE FROM student_rewards WHERE user_id = ? AND reward_type = 'title'", [userId]);
  if (normalizedTitles.length === 0) return;

  await connection.query(
    `INSERT INTO student_rewards (user_id, reward_type, reward_key, earned_at)
     VALUES ?`,
    [normalizedTitles.map((title) => [
      userId,
      "title",
      title.id,
      earnedAtByKey.get(title.id) || now,
    ])],
  );
}

function cleanCardSourcePayload(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return null;
  const source = getCardSource(card);
  if (source !== "interactiveSnapshot") return null;

  // 只保存可還原「學生快照卡來源」的資料；水資源快照卡使用輕量 SVG image，
  // 不保存 DOM 截圖型 photoSnapshotDataUrl，避免 payload 過大與 canvas 安全限制。
  const snapshot = normalizeSnapshotKeys(getCardSnapshot(card)) || {};
  if (typeof snapshot.photoSnapshotImageUrl === "string") {
    snapshot.photoSnapshotImageUrl = normalizeUploadUrlForStorage(snapshot.photoSnapshotImageUrl);
  }

  return {
    type: getCardType(card) || snapshot.type || snapshot.category || "water",
    source,
    title: getCardTitle(card) || snapshot.filterLabel || "學生快照證據卡",
    image: normalizeUploadUrlForStorage(getCardImage(card)),
    snapshot,
  };
}

function buildCardFromSource(row, overrides = {}) {
  const payload = parseJSON(row?.source_payload, null);
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const snapshot = getCardSnapshot(base);
  return {
    id: String(row.card_id),
    localId: 10000,
    category: row.category || getCardType(base) || snapshot?.type || snapshot?.category || "water",
    title: getCardTitle(base) || "學生擷取的互動數據快照",
    revealedTitle: base.revealedTitle || getCardTitle(base) || snapshot?.filterLabel || "學生快照證據卡",
    imageSrc: normalizeUploadUrlForStorage(getCardImage(base)) || "",
    sourceType: row.source_type || getCardSource(base) || "interactiveSnapshot",
    snapshotMeta: denormalizeSnapshotForClient(snapshot),
    ...overrides,
  };
}

async function upsertCardSources(connection, userId, cardMap) {
  const sourceRows = [];
  for (const [cardId, card] of cardMap.entries()) {
    const payload = cleanCardSourcePayload(card);
    if (!payload) continue;
    sourceRows.push([
      cardId,
      payload.type || null,
      payload.source || "interactiveSnapshot",
      JSON.stringify(payload),
      userId,
    ]);
  }

  if (sourceRows.length === 0) return;
  await ensureDataCardSourcesTable(connection);
  await connection.query(
    `INSERT INTO data_card_sources (card_id, category, source_type, source_payload, created_by_user_id)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       source_type = VALUES(source_type),
       source_payload = VALUES(source_payload),
       updated_at = CURRENT_TIMESTAMP`,
    [sourceRows],
  );
}

async function replaceCards(connection, userId, cards) {
  const cardMap = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    const cardKey = normalizeCardKey(card).trim();
    if (!cardKey) continue;
    const cardData = card && typeof card === "object" && !Array.isArray(card)
      ? { ...card, id: String(card.id || cardKey) }
      : { id: cardKey };

    // 小組 decisioncards 已由 decisioncards / decisioncard_logs 保存，不應混進個人解鎖卡表。
    if (cardData.source === "group_card_pack") continue;
    // 從其他同學同步過來的水資源快照卡，在本人尚未撰寫發現前只是「待解鎖卡」。
    if (cardData.unlocked === false || cardData.sharedFromOtherPlayer === true) continue;

    cardMap.set(cardKey, cardData);
  }

  await upsertCardSources(connection, userId, cardMap);

  const [oldRows] = await connection.query(
    `SELECT card_id, unlocked_at
     FROM student_unlocked_cards
     WHERE user_id = ?`,
    [userId],
  );
  const unlockedAtByKey = new Map(oldRows.map((row) => [String(row.card_id), row.unlocked_at]));
  const now = new Date();

  const cardIds = [...cardMap.keys()];

  if (cardIds.length === 0) {
    await connection.query("DELETE FROM student_unlocked_cards WHERE user_id = ?", [userId]);
    return;
  }

  // 先刪除已不在目前同步清單中的卡，再用 upsert 寫入目前清單。
  // 舊版用 DELETE + INSERT，在前端重複同步或再次解鎖時可能因並行請求撞到 PRIMARY KEY。
  // 改成 ON DUPLICATE KEY UPDATE 後，即使資料庫已存在同一張卡，也只會更新時間，不會中斷探究流程。
  await connection.query(
    `DELETE FROM student_unlocked_cards
     WHERE user_id = ? AND card_id NOT IN (?)`,
    [userId, cardIds],
  );

  await connection.query(
    `INSERT INTO student_unlocked_cards (user_id, card_id, unlocked_at, updated_at)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       unlocked_at = student_unlocked_cards.unlocked_at,
       updated_at = VALUES(updated_at)`,
    [cardIds.map((cardId) => [
      userId,
      cardId,
      unlockedAtByKey.get(cardId) || now,
      now,
    ])],
  );
}

// 前端啟動任務一時需要一包完整狀態；這裡把正規化資料重新組回舊 UI 容易使用的結構。
async function readInquiryData(userId) {
  await ensureStudentCoinBalance(userId);
  await ensureInquiryNormalizedTables();
  await ensureDataCardSourcesTable();

  const [[profile]] = await pool.query(
    `SELECT barrage_coins
     FROM users
     WHERE id = ?`,
    [userId],
  );

  const [recordRows] = await pool.query(
    `SELECT id, user_id, record_order, orientation_created_at, investigation_created_at,
            conclusion_created_at, conclusion_text, started_at, ended_at
     FROM inquiry_records
     WHERE user_id = ?
     ORDER BY record_order ASC, id ASC`,
    [userId],
  );

  const recordIds = recordRows.map((row) => Number(row.id)).filter(Boolean);
  const [orientationRows] = recordIds.length > 0
    ? await pool.query(
        `SELECT id, inquiry_record_id, response_order, response_type, answer_order, answer_text
         FROM inquiry_orientation_responses
         WHERE inquiry_record_id IN (?)
         ORDER BY inquiry_record_id ASC, response_order ASC, answer_order ASC, id ASC`,
        [recordIds],
      )
    : [[]];

  const [investigationCardRows] = recordIds.length > 0
    ? await pool.query(
        `SELECT irc.inquiry_record_id, irc.card_id, irc.card_order, irc.unlocked_at,
                dcs.category, dcs.source_type, dcs.source_payload
         FROM inquiry_record_cards irc
         LEFT JOIN data_card_sources dcs ON dcs.card_id = irc.card_id
         WHERE irc.inquiry_record_id IN (?)
         ORDER BY irc.inquiry_record_id ASC, irc.card_order ASC, irc.card_id ASC`,
        [recordIds],
      )
    : [[]];

  const [collectionNoteRows] = recordIds.length > 0
    ? await pool.query(
        `SELECT id, inquiry_record_id, note_key, note_text, created_at
         FROM inquiry_collection_notes
         WHERE inquiry_record_id IN (?)
         ORDER BY inquiry_record_id ASC, created_at ASC, id ASC`,
        [recordIds],
      )
    : [[]];

  const noteIds = collectionNoteRows.map((row) => Number(row.id)).filter(Boolean);
  const [collectionNoteCardRows] = noteIds.length > 0
    ? await pool.query(
        `SELECT note_id, card_id, card_order
         FROM inquiry_collection_note_cards
         WHERE note_id IN (?)
         ORDER BY note_id ASC, card_order ASC, card_id ASC`,
        [noteIds],
      )
    : [[]];

  const [evidenceCardRows] = recordIds.length > 0
    ? await pool.query(
        `SELECT inquiry_record_id, card_id, evidence_order
         FROM inquiry_record_cards
         WHERE inquiry_record_id IN (?) AND is_evidence = 1
         ORDER BY inquiry_record_id ASC, evidence_order ASC, card_id ASC`,
        [recordIds],
      )
    : [[]];

  const orientationRowsByRecordId = groupRowsByRecordId(orientationRows);
  const investigationRowsByRecordId = groupRowsByRecordId(investigationCardRows);
  const noteRowsByRecordId = groupRowsByRecordId(collectionNoteRows);
  const evidenceRowsByRecordId = groupRowsByRecordId(evidenceCardRows);
  const noteCardRowsByNoteId = new Map();
  for (const row of collectionNoteCardRows) {
    const noteId = String(row.note_id || '');
    if (!noteId) continue;
    if (!noteCardRowsByNoteId.has(noteId)) noteCardRowsByNoteId.set(noteId, []);
    noteCardRowsByNoteId.get(noteId).push(row);
  }

  const inquiryPlans = recordRows
    .map((row) => buildInquiryPlanFromNormalizedRecord(row, orientationRowsByRecordId.get(String(row.id)) || []))
    .filter(Boolean);

  const finalSummaries = recordRows
    .map((row) => {
      const recordNoteRows = noteRowsByRecordId.get(String(row.id)) || [];
      const recordNoteCardRows = recordNoteRows.flatMap((noteRow) => noteCardRowsByNoteId.get(String(noteRow.id)) || []);
      return buildFinalSummaryFromNormalizedRecord(row, {
        orientationRecords: buildOrientationRecordsFromRows(orientationRowsByRecordId.get(String(row.id)) || []),
        investigationCards: investigationRowsByRecordId.get(String(row.id)) || [],
        collectionNotes: recordNoteRows.map((noteRow) => ({ ...noteRow, record_order: row.record_order })),
        collectionNoteCards: recordNoteCardRows,
        evidenceCards: evidenceRowsByRecordId.get(String(row.id)) || [],
      });
    })
    .filter(Boolean);

  const [rewardRows] = await pool.query(
    `SELECT reward_key
     FROM student_rewards
     WHERE user_id = ? AND reward_type = 'title'
     ORDER BY earned_at ASC, reward_key ASC`,
    [userId],
  );

  const [cardRows] = await pool.query(
    `SELECT suc.card_id, dcs.category, dcs.source_type, dcs.source_payload
     FROM student_unlocked_cards suc
     LEFT JOIN data_card_sources dcs ON dcs.card_id = suc.card_id
     WHERE suc.user_id = ?
     ORDER BY suc.unlocked_at ASC, suc.card_id ASC`,
    [userId],
  );

  const ownedCardIds = new Set(cardRows.map((row) => String(row.card_id)));
  const [sharedWaterSnapshotRows] = await pool.query(
    `SELECT DISTINCT suc.card_id, dcs.category, dcs.source_type, dcs.source_payload, suc.unlocked_at, u.username
     FROM student_unlocked_cards suc
     INNER JOIN data_card_sources dcs ON dcs.card_id = suc.card_id
     LEFT JOIN users u ON u.id = suc.user_id
     WHERE suc.user_id <> ?
       AND dcs.category = 'water'
       AND dcs.source_type = 'interactiveSnapshot'
     ORDER BY suc.unlocked_at ASC, suc.card_id ASC`,
    [userId],
  );

  const latestInquiryPlan = inquiryPlans.at(-1) || {};
  const storedTitles = rewardRows
    .map((row) => normalizeTitleData(row.reward_key))
    .filter(Boolean);
  const earnedTitles = mergeTitlesById(
    storedTitles,
    getInvestigationTitlesForCompletedCount(countCompletedFinalSummaries(finalSummaries)),
  );

  const inquiryUnlockedCardsByOrder = buildInquiryUnlockedCardsByOrder(finalSummaries);
  const cardReflectionNoteById = buildCardReflectionNoteLookup(finalSummaries);

  return {
    orientationMainChoice: latestInquiryPlan.orientationMainChoice || '',
    orientationTextInput: latestInquiryPlan.orientationTextInput || '',
    inquiryPlans,
    finalSummaries,
    earnedTitles,
    unlockedCards: [
      ...cardRows.map((row) => {
        if (row.source_type === 'interactiveSnapshot') {
          return attachReflectionNoteToCard(
            buildCardFromSource(row, { unlocked: true }),
            cardReflectionNoteById,
          );
        }
        return attachReflectionNoteToCard({ id: String(row.card_id) }, cardReflectionNoteById);
      }),
      ...sharedWaterSnapshotRows
        .filter((row) => !ownedCardIds.has(String(row.card_id)))
        .map((row) => buildCardFromSource(row, {
          content: '',
          unlocked: false,
          unlockedAt: null,
          sharedFromOtherPlayer: true,
          sharedAuthorName: row.username || '其他同學',
        })),
    ],
    inquiryUnlockedCardsByOrder,
    barrageCoins: Number(profile?.barrage_coins) || 0,
  };
}


function mergeSummaryData(previousSummary, nextSummary) {
  return normalizeFinalSummaryData({
    ...(previousSummary || {}),
    ...(nextSummary || {}),
    introStage: nextSummary?.introStage || previousSummary?.introStage || null,
    orientationCreatedAt:
      nextSummary?.orientationCreatedAt || previousSummary?.orientationCreatedAt || null,
    investigationCreatedAt:
      nextSummary?.investigationCreatedAt || previousSummary?.investigationCreatedAt || null,
    conclusionCreatedAt:
      nextSummary?.conclusionCreatedAt || previousSummary?.conclusionCreatedAt || null,
    investigationCards:
      Array.isArray(nextSummary?.investigationCards) && nextSummary.investigationCards.length > 0
        ? nextSummary.investigationCards
        : Array.isArray(previousSummary?.investigationCards)
          ? previousSummary.investigationCards
          : [],
    evidenceCards:
      Array.isArray(nextSummary?.evidenceCards) && nextSummary.evidenceCards.length > 0
        ? nextSummary.evidenceCards
        : Array.isArray(previousSummary?.evidenceCards)
          ? previousSummary.evidenceCards
          : [],
    conclusion: String(nextSummary?.conclusion || previousSummary?.conclusion || ""),
  });
}

function isCompletedFinalSummary(summary) {
  const normalized = normalizeFinalSummaryData(summary);
  return Boolean(
    String(normalized.conclusion || "").trim() ||
      (Array.isArray(normalized.evidenceCards) && normalized.evidenceCards.length > 0),
  );
}

function countCompletedFinalSummaries(summaries) {
  return (Array.isArray(summaries) ? summaries : []).filter(isCompletedFinalSummary).length;
}

// 調查書可能先有前導目的、後有結論；upsert 需用 recordOrder / orientationCreatedAt 避免覆蓋不同回合。
function upsertSummaryByPlanLink(summaries, nextSummary) {
  const normalizedNext = normalizeFinalSummaryData(nextSummary);
  const safeSummaries = Array.isArray(summaries) ? summaries : [];
  const targetRecordOrder = Number(normalizedNext.recordOrder || 0);
  const targetOrientationCreatedAt = normalizedNext.orientationCreatedAt;
  const targetOrientationKey = normalizedNext.introStage
    ? orientationKeyFromPlan({ introStage: normalizedNext.introStage })
    : "";

  const index = safeSummaries.findIndex((summary) => {
    const normalizedSummary = normalizeFinalSummaryData(summary);
    if (targetRecordOrder > 0 && Number(normalizedSummary.recordOrder || 0) === targetRecordOrder) return true;
    if (targetOrientationCreatedAt && normalizedSummary.orientationCreatedAt === targetOrientationCreatedAt) return true;
    // 只有沒有明確回合鍵時才退回用前導內容比對，避免相同答案的不同調查書互相覆蓋。
    if (!targetRecordOrder && !targetOrientationCreatedAt && targetOrientationKey && normalizedSummary.introStage) {
      return orientationKeyFromPlan({ introStage: normalizedSummary.introStage }) === targetOrientationKey;
    }
    return false;
  });

  if (index < 0) return [...safeSummaries, normalizedNext];

  return safeSummaries.map((summary, summaryIndex) =>
    summaryIndex === index ? mergeSummaryData(summary, normalizedNext) : summary,
  );
}


module.exports = {
  MAX_BARRAGE_COINS,
  FINAL_SUMMARY_COIN_REWARD,
  stringify,
  stableJSONString,
  ensureStudentCoinBalanceWithConnection,
  getActor,
  insertStudentActivityLog,
  readInquiryData,
  replaceInquiryRecords,
  replaceTitles,
  replaceCards,
  normalizeFinalSummaryData,
  upsertSummaryByPlanLink,
  mergeTitlesById,
  getInvestigationTitlesForCompletedCount,
  countCompletedFinalSummaries,
};
