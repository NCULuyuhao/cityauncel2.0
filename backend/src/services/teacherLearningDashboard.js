/**
 * CityAuncel maintainability notes
 * 檔案用途：教師端學習分析服務，彙整調查書、卡片、AI、地圖、卡包與行為紀錄，產生可篩選的量化與質性指標。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

/**
 * Teacher learning dashboard service.
 *
 * Keeps the analytics aggregation logic out of the Express route file while
 * preserving the existing API response shape. The route remains responsible for
 * authentication and routing; this service owns dashboard data loading and
 * metric construction.
 */

function createTeacherLearningDashboardService(dependencies) {
  const {
    pool,
    GROUPS,
    parseJSON,
    mapGroupName,
    ensureUsersGenderColumn,
    ensureDataCardSourcesTable,
    ensureMapChoicesTable,
    ensureInquiryNormalizedTables,
    ensureLearningDashboardIndexes,
    ensureDecisioncardsTable,
  } = dependencies;

function normalCdf(x) {
  // Abramowitz and Stegun approximation for standard normal CDF.
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}






function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeCardReference(card) {
  if (card == null) return '';
  if (typeof card === 'string' || typeof card === 'number') return String(card).trim();
  if (typeof card !== 'object' || Array.isArray(card)) return '';
  return String(card.id || card.cardId || card.card_id || card.key || '').trim();
}

function inferCardCategory(cardId, metadata = null, cardCategoryMap = new Map()) {
  const fromMap = cardCategoryMap.get(String(cardId || ""));
  if (fromMap) return fromMap;
  const metaCategory = metadata && typeof metadata === "object" ? metadata.category : null;
  if (metaCategory) return String(metaCategory);
  const id = String(cardId || "").toLowerCase();
  if (id.startsWith("water") || id.includes("rain") || id.includes("rpi") || id.includes("station")) return "water";
  if (id.startsWith("land") || id.includes("population") || id.includes("traffic")) return "land";
  if (id.startsWith("leopard") || id.includes("stone") || id.includes("roadkill")) return "leopard";
  if (id.startsWith("rumor") || id.includes("npc")) return "rumor";
  return "unknown";
}

function categoryLabel(category) {
  const labels = {
    water: "水資源",
    land: "土地資料",
    leopard: "石虎相關資訊",
    rumor: "謠言",
    unknown: "未分類",
  };
  return labels[String(category || "unknown")] || String(category || "未分類");
}

function extractCardIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return uniqueStrings(value.map((item) => normalizeCardReference(item)));
  if (typeof value === "object") {
    if (Array.isArray(value.evidenceCards)) return extractCardIds(value.evidenceCards);
    if (Array.isArray(value.cards)) return extractCardIds(value.cards);
    if (Array.isArray(value.investigationCards)) return extractCardIds(value.investigationCards);
    const cardId = normalizeCardReference(value);
    return cardId ? [cardId] : [];
  }
  return [];
}

function computeCompletion(conclusion) {
  const normalized = conclusion && typeof conclusion === "object" ? conclusion : {};
  const evidenceIds = extractCardIds(normalized.evidenceCards || normalized.evidenceCardIds);
  const text = String(normalized.conclusion || "").trim();
  return Boolean(text || evidenceIds.length > 0);
}

// 這裡不是評分，而是把教師可能關心的學生狀態轉成可篩選的描述標籤。
function classifyStudentProfile(metrics) {
  if (metrics.activityCount <= 0) return "尚未開始型";
  if (metrics.explanatoryStrengthScore >= 75 && metrics.evidenceCategoryCount >= 2 && metrics.decisionFollowThroughCount > 0) return "證據推理型";
  if (metrics.evidenceTriangulationScore >= 70 && metrics.evidenceCategoryCount >= 2) return "交叉驗證型";
  if (metrics.inquiryDepthScore >= 83 && metrics.exploredCategoryCount >= 3 && metrics.evidenceUsageRate >= 0.35) return "深度跨域探究型";
  if (metrics.cardUnlockCount >= 8 && metrics.evidenceUsageRate < 0.25) return "資料蒐集型";
  if (metrics.mapActionCount >= 5 && metrics.cardUnlockCount <= 3) return "決策導向型";
  if (metrics.completedInquiryCount > 0 && metrics.activityCount <= 8) return "快速完成型";
  if (metrics.positionChangeCount >= 2) return "反覆修正型";
  if (metrics.exploredCategoryCount <= 1 && metrics.cardUnlockCount > 0) return "單一資料型";
  return "穩定探究型";
}

function stageFromActivity(row) {
  const event = String(row.eventType || row.event_type || "");
  const target = String(row.targetType || row.target_type || "");
  if (event.startsWith("map_")) return "地圖決策";
  if (event === "inquiry_plan_create" || event === "research_plan_submit" || target === "inquiry_intro") return "前導規劃";
  if (event === "final_summary_submit" || target === "summary") return "探究總結";
  if (event.startsWith("evidence_") || target.startsWith("evidence")) return "證據整理";
  if (event.includes("vote")) return "角色投票";
  if (event.startsWith("card_") || target === "card" || target === "cardCategory") return "資料卡探索";
  if (event.includes("barrage")) return "同儕互動";
  return "其他操作";
}

function buildStudentInsight(metrics, classAverage) {
  if (metrics.activityCount <= 0) return "尚未留下操作紀錄，建議先確認是否已登入並進入任務。";
  if (metrics.evidenceCategoryCount >= 2 && metrics.decisionFollowThroughCount > 0) {
    return "能把兩種以上資料類型轉成證據，且後續有回到地圖或決策操作，屬於較完整的「證據支持判斷」歷程。";
  }
  if (metrics.evidenceCategoryCount >= 2 && metrics.decisionFollowThroughCount === 0) {
    return "已有多元證據，但尚未看到證據後續如何影響地圖或投票決策，適合追問他的判斷依據。";
  }
  if (metrics.cardUnlockCount > classAverage.cardUnlockCount && metrics.evidenceUsageRate < classAverage.evidenceUsageRate) {
    return "資料蒐集量高於平均，但轉成證據的比例偏低，適合引導他整理與篩選關鍵證據。";
  }
  if (metrics.exploredCategoryCount >= 3 && metrics.completedInquiryCount > 0) {
    return "已跨多種類型資料並完成探究成果，適合做為班級討論的完整案例。";
  }
  if (metrics.positionChangeCount > 0) {
    return "地圖立場曾經改變，可觀察是哪一類資料或討論影響了判斷。";
  }
  if (metrics.completedInquiryCount === 0 && metrics.cardUnlockCount > 0) {
    return "已有資料探索，但尚未形成完整成果，下一步可提醒他進入證據選擇與總結。";
  }
  return "整體歷程穩定，可從時間軸觀察他如何由資料探索走向決策。";
}

// 教師端儀表板一次整合多張表，前端再依小組、學生、階段與條件篩選。
async function getLearningDashboard(req, res) {
  try {
    await ensureUsersGenderColumn();
    await ensureDataCardSourcesTable();
    await ensureInquiryNormalizedTables();
    await ensureLearningDashboardIndexes();
    if (ensureMapChoicesTable) await ensureMapChoicesTable();
    if (ensureDecisioncardsTable) await ensureDecisioncardsTable();

    const [studentRows] = await pool.query(
      `SELECT id, username, gender, group_id AS groupId, is_group_leader AS isGroupLeader
       FROM users
       WHERE COALESCE(role, 'student') = 'student'
       ORDER BY COALESCE(group_id, 'unassigned') ASC, username ASC, id ASC`,
    );

    const [activityRows] = await pool.query(
      `SELECT id, user_id AS userId, COALESCE(username, CONCAT('學生 ', user_id)) AS username,
              group_id AS groupId, event_type AS eventType, event_label AS eventLabel,
              target_type AS targetType, target_id AS targetId,
              previous_value AS previousValue, new_value AS newValue, metadata, created_at AS createdAt
       FROM student_activity_logs
       WHERE COALESCE(role, 'student') = 'student'
       ORDER BY created_at ASC, id ASC
       LIMIT 100000`,
    );

    const [recordRows] = await pool.query(
      `SELECT id, user_id AS userId, record_order AS recordOrder,
              orientation_created_at AS orientationCreatedAt,
              investigation_created_at AS investigationCreatedAt,
              conclusion_created_at AS conclusionCreatedAt,
              conclusion_text AS conclusionText,
              started_at AS startedAt, ended_at AS endedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM inquiry_records
       ORDER BY user_id ASC, record_order ASC, id ASC`,
    );

    const recordIds = recordRows.map((row) => Number(row.id)).filter(Boolean);
    const [orientationRows] = recordIds.length > 0
      ? await pool.query(
          `SELECT o.id, r.user_id AS userId, o.inquiry_record_id AS inquiryRecordId,
                  o.response_order AS responseOrder, o.response_type AS responseType,
                  o.answer_order AS answerOrder, o.answer_text AS answerText, o.created_at AS createdAt
           FROM inquiry_orientation_responses o
           JOIN inquiry_records r ON r.id = o.inquiry_record_id
           WHERE o.inquiry_record_id IN (?)
           ORDER BY r.user_id ASC, o.inquiry_record_id ASC, o.response_order ASC, o.answer_order ASC`,
          [recordIds],
        )
      : [[]];

    const [recordCardRows] = recordIds.length > 0
      ? await pool.query(
          `SELECT r.user_id AS userId, c.inquiry_record_id AS inquiryRecordId,
                  c.card_id AS cardId, c.card_order AS cardOrder,
                  c.unlocked_at AS unlockedAt, c.is_evidence AS isEvidence,
                  c.evidence_order AS evidenceOrder, c.evidence_selected_at AS evidenceSelectedAt,
                  c.created_at AS createdAt
           FROM inquiry_record_cards c
           JOIN inquiry_records r ON r.id = c.inquiry_record_id
           WHERE c.inquiry_record_id IN (?)
           ORDER BY r.user_id ASC, c.inquiry_record_id ASC, c.card_order ASC`,
          [recordIds],
        )
      : [[]];

    const [collectionNoteRows] = recordIds.length > 0
      ? await pool.query(
          `SELECT n.id, r.user_id AS userId, n.inquiry_record_id AS inquiryRecordId,
                  n.note_key AS noteKey, n.note_text AS noteText, n.created_at AS createdAt
           FROM inquiry_collection_notes n
           JOIN inquiry_records r ON r.id = n.inquiry_record_id
           WHERE n.inquiry_record_id IN (?)
           ORDER BY r.user_id ASC, n.created_at ASC, n.id ASC`,
          [recordIds],
        )
      : [[]];

    const noteIds = collectionNoteRows.map((row) => Number(row.id)).filter(Boolean);
    const [collectionNoteCardRows] = noteIds.length > 0
      ? await pool.query(
          `SELECT nc.note_id AS noteId, n.inquiry_record_id AS inquiryRecordId,
                  r.user_id AS userId, nc.card_id AS cardId, nc.card_order AS cardOrder
           FROM inquiry_collection_note_cards nc
           JOIN inquiry_collection_notes n ON n.id = nc.note_id
           JOIN inquiry_records r ON r.id = n.inquiry_record_id
           WHERE nc.note_id IN (?)
           ORDER BY nc.note_id ASC, nc.card_order ASC`,
          [noteIds],
        )
      : [[]];

    const [unlockRows] = await pool.query(
      `SELECT user_id AS userId, card_id AS cardId, unlocked_at AS unlockedAt, updated_at AS updatedAt
       FROM student_unlocked_cards
       ORDER BY unlocked_at ASC`,
    );

    const [sourceRows] = await pool.query(
      `SELECT card_id AS cardId, category, source_type AS sourceType, source_payload AS sourcePayload,
              created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM data_card_sources`,
    );

    const [mapChoiceRows] = await pool.query(
      `SELECT id, scope, owner_id AS ownerId, user_id AS userId, group_id AS groupId,
              district_name AS districtName, choice, created_at AS createdAt, updated_at AS updatedAt
       FROM map_choices
       ORDER BY scope ASC, owner_id ASC, district_name ASC`,
    );

    const [mapActionRows] = await pool.query(
      `SELECT id, user_id AS userId, scope, group_id AS groupId, district_name AS districtName,
              previous_choice AS previousChoice, new_choice AS newChoice,
              action_type AS actionType, created_at AS createdAt
       FROM map_action_logs
       ORDER BY created_at ASC, id ASC`,
    );

    const [voteRows] = await pool.query(
      `SELECT user_id AS userId, role_id AS roleId, rank_position AS rankPosition,
              created_at AS createdAt, updated_at AS updatedAt
       FROM suspect_votes
       ORDER BY user_id ASC, rank_position ASC`,
    );

    const [decisionRows] = await pool.query(
      `SELECT id, group_id AS groupId, selected_card_id_1 AS selectedCardId1,
              selected_card_id_2 AS selectedCardId2, selected_card_id_3 AS selectedCardId3,
              locked_by_user_id AS lockedByUserId, lock_reason AS lockReason,
              locked_at AS lockedAt, updated_at AS updatedAt
       FROM decisioncards
       ORDER BY group_id ASC`,
    );

    const [decisionLogRows] = await pool.query(
      `SELECT id, group_id AS groupId, action_type AS actionType,
              selected_card_id_1 AS selectedCardId1, selected_card_id_2 AS selectedCardId2,
              selected_card_id_3 AS selectedCardId3,
              locked_by_user_id AS lockedByUserId, lock_reason AS lockReason,
              locked_at AS lockedAt, created_at AS createdAt
       FROM decisioncard_logs
       ORDER BY created_at ASC, id ASC`,
    );

    const [aiRows] = await pool.query(
      `SELECT id, user_id AS userId, round_key AS roundKey, scope, session_id AS sessionId,
              need_type AS needType, help_category AS helpCategory, action_type AS actionType,
              request_text AS requestText, response_text AS responseText, response_source AS responseSource,
              provider, is_fallback AS isFallback, gap_scope AS gapScope,
              context_scope AS contextScope, context_label AS contextLabel,
              page_key AS pageKey, page_label AS pageLabel,
              focus_label AS focusLabel, focus_text AS focusText,
              collection_reflection_text AS collectionReflectionText,
              direction_opening AS directionOpening, reason_opening AS reasonOpening,
              reply_limit AS replyLimit, active_cards_count AS activeCardsCount,
              unlocked_cards_count AS unlockedCardsCount, all_unlocked_cards_count AS allUnlockedCardsCount,
              help_credits AS helpCredits, turns_in_help AS turnsInHelp, checks_in_help AS checksInHelp,
              created_at AS createdAt
       FROM ai_helper_records
       ORDER BY created_at ASC, id ASC`,
    );

    const aiRecordIds = aiRows.map((row) => Number(row.id)).filter(Boolean);
    const [aiRecordCardRows] = aiRecordIds.length > 0
      ? await pool.query(
          `SELECT ai_helper_record_id AS aiHelperRecordId, card_id AS cardId, card_order AS cardOrder
           FROM ai_helper_record_cards
           WHERE ai_helper_record_id IN (?)
           ORDER BY ai_helper_record_id ASC, card_order ASC`,
          [aiRecordIds],
        )
      : [[]];

    const [aiUnlockRows] = await pool.query(
      `SELECT user_id AS userId, round_key AS roundKey, scope, unlocked_at AS unlockedAt
       FROM ai_helper_unlocks
       ORDER BY unlocked_at ASC`,
    );

    const [barrageRows] = await pool.query(
      `SELECT id, user_id AS userId, content, created_at AS createdAt
       FROM barrages
       ORDER BY created_at ASC, id ASC`,
    );

    const safeIso = (value) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      if (!Number.isFinite(time)) return null;
      return new Date(time).toISOString();
    };

    const shortText = (value, maxLength = 90) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text.length <= maxLength) return text;
      return `${text.slice(0, maxLength)}…`;
    };

    const textLength = (value) => String(value || '').trim().length;

    const selectedCardsFromDecision = (row) => uniqueStrings([row.selectedCardId1, row.selectedCardId2, row.selectedCardId3]);

    const cardCategoryMap = new Map();
    const cardTitleMap = new Map();
    const cardSourceTypeMap = new Map();
    for (const row of sourceRows) {
      const payload = parseJSON(row.sourcePayload, {});
      const category = row.category || payload?.category || inferCardCategory(row.cardId);
      cardCategoryMap.set(String(row.cardId), String(category || 'unknown'));
      cardTitleMap.set(String(row.cardId), String(payload?.revealedTitle || payload?.title || row.cardId));
      cardSourceTypeMap.set(String(row.cardId), String(row.sourceType || 'fixedImage'));
    }
    for (const row of activityRows) {
      const metadata = parseJSON(row.metadata, null);
      if (row.targetType === 'card' && row.targetId) {
        const cardId = String(row.targetId);
        if (!cardCategoryMap.has(cardId)) cardCategoryMap.set(cardId, inferCardCategory(cardId, metadata, cardCategoryMap));
        if (!cardTitleMap.has(cardId)) cardTitleMap.set(cardId, metadata?.revealedTitle || metadata?.title || cardId);
      }
    }

    const getCardCategory = (cardId) => inferCardCategory(cardId, null, cardCategoryMap);
    const getCardTitle = (cardId) => cardTitleMap.get(String(cardId || '')) || String(cardId || '');
    const getCardLabel = (cardId) => categoryLabel(getCardCategory(cardId));

    const classifyActivity = (row) => {
      const event = String(row.eventType || '').toLowerCase();
      const target = String(row.targetType || '').toLowerCase();
      if (event.includes('card_pack') || event.includes('decisioncard') || event.includes('group_card_pack')) {
        return { stage: 'cardpack', stageLabel: '開啟卡包', phase: event.includes('lock') ? '小組鎖定三張卡' : '卡包瀏覽' };
      }
      if (event.startsWith('ai_helper')) return { stage: 'ai', stageLabel: 'AI 幫幫忙', phase: 'AI 使用紀錄' };
      if (event.startsWith('map_')) return { stage: 'task2', stageLabel: '任務二：繪製地圖', phase: '地圖操作' };
      if (event.includes('vote')) return { stage: 'task2', stageLabel: '任務二：繪製地圖', phase: '角色投票' };
      if (event.startsWith('card_') || event === 'interactive_snapshot_unlock' || target === 'card' || target === 'cardcategory') {
        return { stage: 'task1', stageLabel: '任務一：調查書', phase: '資料卡探索' };
      }
      if (event.startsWith('evidence_')) return { stage: 'task1', stageLabel: '任務一：調查書', phase: '證據選擇' };
      if (event.includes('collection_reflection') || event.includes('collection_panel')) return { stage: 'task1', stageLabel: '任務一：調查書', phase: '理由與線索整理' };
      if (event.startsWith('inquiry_') || event.includes('investigation') || event.includes('final_summary')) {
        return { stage: 'task1', stageLabel: '任務一：調查書', phase: event.includes('final') ? '調查書成果' : '前導與探究流程' };
      }
      if (event.includes('barrage')) return { stage: 'other', stageLabel: '其他互動', phase: '彈幕互動' };
      if (event === 'page_visit' || event === 'login' || event === 'exploration_start') return { stage: 'other', stageLabel: '其他互動', phase: '登入與頁面瀏覽' };
      return { stage: 'other', stageLabel: '其他互動', phase: '其他操作' };
    };

    const stageLabels = {
      all: '全部階段',
      task1: '任務一：調查書',
      task2: '任務二：繪製地圖',
      cardpack: '開啟卡包',
      ai: 'AI 幫幫忙',
      other: '其他互動',
    };

    const makeCounter = () => ({
      eventCount: 0,
      activeStudentIds: new Set(),
      dataSources: new Set(),
      phases: new Map(),
    });
    const stageCounter = {
      task1: makeCounter(),
      task2: makeCounter(),
      cardpack: makeCounter(),
      ai: makeCounter(),
      other: makeCounter(),
    };

    const students = studentRows.map((row) => ({
      id: Number(row.id),
      username: String(row.username || `學生 ${row.id}`),
      gender: row.gender || null,
      groupId: row.groupId || 'unassigned',
      groupName: mapGroupName(row.groupId) || '未分配',
      isGroupLeader: Boolean(row.isGroupLeader),
      overall: {
        eventCount: 0,
        firstAt: null,
        lastAt: null,
        activeDays: 0,
        dataSourceCount: 0,
      },
      task1: {
        eventCount: 0,
        orientationAnswerCount: 0,
        orientationTextLength: 0,
        inquiryRecordCount: 0,
        completedInquiryCount: 0,
        cardOpenCount: 0,
        unlockedCardCount: 0,
        unlockedCategoryCount: 0,
        evidenceCardCount: 0,
        evidenceCategoryCount: 0,
        collectionNoteCount: 0,
        collectionTextLength: 0,
        conclusionTextLength: 0,
        evidenceSelectionCount: 0,
      },
      task2: {
        eventCount: 0,
        mapActionCount: 0,
        mapChoiceCount: 0,
        mapDistrictCount: 0,
        conservationChoiceCount: 0,
        developmentChoiceCount: 0,
        unknownChoiceCount: 0,
        positionChangeCount: 0,
        voteCount: 0,
        topRankRole: null,
      },
      cardpack: {
        eventCount: 0,
        openCount: 0,
        lockCount: 0,
        selectedCardCount: 0,
        selectedCategoryCount: 0,
        groupHasActiveLock: false,
        activeSelectedCards: [],
        latestLockReason: '',
      },
      ai: {
        eventCount: 0,
        unlockCount: 0,
        requestCount: 0,
        responseCount: 0,
        checkCount: 0,
        renewalCount: 0,
        fallbackCount: 0,
        needTypes: [],
        helpCategories: [],
      },
      qualitative: {
        orientationAnswers: [],
        collectionNotes: [],
        conclusions: [],
        aiRequests: [],
        cardPackReasons: [],
      },
      sets: {
        activeDates: new Set(),
        dataSources: new Set(),
        unlockedCards: new Set(),
        unlockedCategories: new Set(),
        evidenceCards: new Set(),
        evidenceCategories: new Set(),
        selectedCards: new Set(),
        selectedCategories: new Set(),
        mapDistricts: new Set(),
        aiNeedTypes: new Set(),
        aiHelpCategories: new Set(),
      },
    }));

    const studentById = new Map(students.map((student) => [student.id, student]));
    const studentIdsByGroup = new Map();
    for (const student of students) {
      if (!studentIdsByGroup.has(student.groupId)) studentIdsByGroup.set(student.groupId, new Set());
      studentIdsByGroup.get(student.groupId).add(student.id);
    }

    const findStudent = (userId) => studentById.get(Number(userId)) || null;

    const updateStudentTime = (student, at) => {
      const iso = safeIso(at);
      if (!student || !iso) return;
      if (!student.overall.firstAt || iso < student.overall.firstAt) student.overall.firstAt = iso;
      if (!student.overall.lastAt || iso > student.overall.lastAt) student.overall.lastAt = iso;
      student.sets.activeDates.add(iso.slice(0, 10));
    };

    const bumpStage = (stage, userId, phase, dataSource) => {
      const counter = stageCounter[stage] || stageCounter.other;
      counter.eventCount += 1;
      if (userId) counter.activeStudentIds.add(Number(userId));
      if (dataSource) counter.dataSources.add(dataSource);
      if (phase) counter.phases.set(phase, (counter.phases.get(phase) || 0) + 1);
    };

    const unifiedEvents = [];
    const addEvent = ({
      id,
      dataSource,
      sourceId,
      stage,
      stageLabel,
      phase,
      userId,
      username,
      groupId,
      groupName,
      eventType,
      eventLabel,
      targetType = null,
      targetId = null,
      cardId = null,
      cardTitle = null,
      category = null,
      categoryLabel: categoryText = null,
      districtName = null,
      choice = null,
      text = null,
      textLength: explicitTextLength = null,
      createdAt = null,
      meta = {},
    }) => {
      const student = findStudent(userId);
      const resolvedGroupId = groupId || student?.groupId || null;
      const resolvedStage = stage || 'other';
      const resolvedStageLabel = stageLabel || stageLabels[resolvedStage] || '其他互動';
      const resolvedCategory = category || (cardId ? getCardCategory(cardId) : null);
      const row = {
        id: `${dataSource || 'source'}:${sourceId || id || unifiedEvents.length}`,
        sourceId: sourceId ?? id ?? null,
        dataSource: dataSource || 'unknown',
        stage: resolvedStage,
        stageLabel: resolvedStageLabel,
        phase: phase || '未分類',
        userId: userId == null ? null : Number(userId),
        username: username || student?.username || (userId ? `學生 ${userId}` : '無學生'),
        groupId: resolvedGroupId || 'unassigned',
        groupName: groupName || mapGroupName(resolvedGroupId) || student?.groupName || '未分配',
        eventType: eventType || 'unknown',
        eventLabel: eventLabel || eventType || '未命名事件',
        targetType,
        targetId,
        cardId: cardId || null,
        cardTitle: cardTitle || (cardId ? getCardTitle(cardId) : null),
        category: resolvedCategory || null,
        categoryLabel: categoryText || (resolvedCategory ? categoryLabel(resolvedCategory) : null),
        districtName,
        choice,
        textPreview: shortText(text, 110),
        textLength: explicitTextLength ?? textLength(text),
        createdAt: safeIso(createdAt),
        meta,
      };
      unifiedEvents.push(row);
      bumpStage(resolvedStage, row.userId, row.phase, row.dataSource);
      if (student) {
        student.overall.eventCount += 1;
        student.sets.dataSources.add(row.dataSource);
        updateStudentTime(student, row.createdAt);
        if (student[resolvedStage] && typeof student[resolvedStage].eventCount === 'number') student[resolvedStage].eventCount += 1;
      }
      return row;
    };

    const cardStats = new Map();
    const ensureCardStats = (cardId) => {
      const id = String(cardId || '').trim();
      if (!id) return null;
      if (!cardStats.has(id)) {
        const category = getCardCategory(id);
        cardStats.set(id, {
          cardId: id,
          title: getCardTitle(id),
          category,
          categoryLabel: categoryLabel(category),
          sourceType: cardSourceTypeMap.get(id) || 'unknown',
          openCount: 0,
          uniqueOpenStudents: new Set(),
          unlockCount: 0,
          uniqueUnlockStudents: new Set(),
          evidenceCount: 0,
          uniqueEvidenceStudents: new Set(),
          noteReferenceCount: 0,
          uniqueNoteStudents: new Set(),
          decisionSelectedCount: 0,
          uniqueDecisionGroups: new Set(),
          aiReferencedCount: 0,
          uniqueAiStudents: new Set(),
        });
      }
      return cardStats.get(id);
    };
    sourceRows.forEach((row) => ensureCardStats(row.cardId));

    for (const row of activityRows) {
      const classified = classifyActivity(row);
      const student = findStudent(row.userId);
      const metadata = parseJSON(row.metadata, {});
      const cardId = row.targetType === 'card' || row.eventType === 'card_open' || row.eventType === 'card_unlock' ? row.targetId : metadata?.cardId || null;
      addEvent({
        id: row.id,
        dataSource: 'student_activity_logs',
        sourceId: row.id,
        stage: classified.stage,
        stageLabel: classified.stageLabel,
        phase: classified.phase,
        userId: row.userId,
        username: row.username,
        groupId: row.groupId,
        eventType: row.eventType,
        eventLabel: row.eventLabel,
        targetType: row.targetType,
        targetId: row.targetId,
        cardId,
        text: typeof row.newValue === 'string' ? row.newValue : null,
        createdAt: row.createdAt,
      });
      if (!student) continue;
      if (row.eventType === 'card_open') {
        student.task1.cardOpenCount += 1;
        const card = ensureCardStats(row.targetId);
        if (card) {
          card.openCount += 1;
          card.uniqueOpenStudents.add(student.id);
        }
      }
      if (row.eventType === 'card_pack_open') student.cardpack.openCount += 1;
      if (row.eventType === 'card_pack_lock' || row.eventType === 'group_card_pack_lock') student.cardpack.lockCount += 1;
      if (row.eventType === 'ai_helper_renew') student.ai.renewalCount += 1;
    }

    for (const row of orientationRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'inquiry_orientation_responses',
        sourceId: row.id,
        stage: 'task1',
        stageLabel: stageLabels.task1,
        phase: '前導問題回答',
        userId: row.userId,
        eventType: 'orientation_response',
        eventLabel: `前導回答：${row.responseType}`,
        targetType: 'inquiry_record',
        targetId: row.inquiryRecordId,
        text: row.answerText,
        createdAt: row.createdAt,
        meta: { responseOrder: row.responseOrder, responseType: row.responseType, answerOrder: row.answerOrder },
      });
      if (!student) continue;
      student.task1.orientationAnswerCount += 1;
      student.task1.orientationTextLength += textLength(row.answerText);
      if (student.qualitative.orientationAnswers.length < 12) {
        student.qualitative.orientationAnswers.push({
          responseType: row.responseType,
          responseOrder: row.responseOrder,
          answerOrder: row.answerOrder,
          text: shortText(row.answerText, 160),
          createdAt: safeIso(row.createdAt),
        });
      }
    }

    for (const row of recordRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'inquiry_records',
        sourceId: row.id,
        stage: 'task1',
        stageLabel: stageLabels.task1,
        phase: row.endedAt || row.conclusionText ? '調查書成果' : '調查書草稿',
        userId: row.userId,
        eventType: row.endedAt || row.conclusionText ? 'inquiry_record_completed' : 'inquiry_record_started',
        eventLabel: row.endedAt || row.conclusionText ? '調查書成果紀錄' : '調查書紀錄',
        targetType: 'inquiry_record',
        targetId: row.id,
        text: row.conclusionText,
        createdAt: row.endedAt || row.conclusionCreatedAt || row.createdAt || row.startedAt,
        meta: { recordOrder: row.recordOrder },
      });
      if (!student) continue;
      student.task1.inquiryRecordCount += 1;
      const hasConclusion = Boolean(row.endedAt || String(row.conclusionText || '').trim());
      if (hasConclusion) student.task1.completedInquiryCount += 1;
      student.task1.conclusionTextLength += textLength(row.conclusionText);
      if (String(row.conclusionText || '').trim() && student.qualitative.conclusions.length < 8) {
        student.qualitative.conclusions.push({
          recordOrder: row.recordOrder,
          text: shortText(row.conclusionText, 180),
          textLength: textLength(row.conclusionText),
          createdAt: safeIso(row.endedAt || row.conclusionCreatedAt || row.updatedAt),
        });
      }
    }

    for (const row of recordCardRows) {
      const student = findStudent(row.userId);
      const isEvidence = Boolean(row.isEvidence);
      const category = getCardCategory(row.cardId);
      addEvent({
        dataSource: 'inquiry_record_cards',
        sourceId: `${row.inquiryRecordId}:${row.cardId}`,
        stage: 'task1',
        stageLabel: stageLabels.task1,
        phase: isEvidence ? '證據卡選擇' : '調查書卡片引用',
        userId: row.userId,
        eventType: isEvidence ? 'evidence_card_saved' : 'inquiry_card_saved',
        eventLabel: isEvidence ? '調查書證據卡' : '調查書引用卡',
        targetType: 'card',
        targetId: row.cardId,
        cardId: row.cardId,
        category,
        createdAt: row.evidenceSelectedAt || row.unlockedAt || row.createdAt,
        meta: { inquiryRecordId: row.inquiryRecordId, cardOrder: row.cardOrder, evidenceOrder: row.evidenceOrder },
      });
      const card = ensureCardStats(row.cardId);
      if (!student || !card) continue;
      student.sets.unlockedCards.add(String(row.cardId));
      student.sets.unlockedCategories.add(category);
      if (isEvidence) {
        student.task1.evidenceSelectionCount += 1;
        student.sets.evidenceCards.add(String(row.cardId));
        student.sets.evidenceCategories.add(category);
        card.evidenceCount += 1;
        card.uniqueEvidenceStudents.add(student.id);
      }
    }

    for (const row of collectionNoteRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'inquiry_collection_notes',
        sourceId: row.id,
        stage: 'task1',
        stageLabel: stageLabels.task1,
        phase: '蒐集理由文字',
        userId: row.userId,
        eventType: 'collection_note_saved',
        eventLabel: '學生撰寫蒐集理由',
        targetType: 'inquiry_record',
        targetId: row.inquiryRecordId,
        text: row.noteText,
        createdAt: row.createdAt,
        meta: { noteKey: row.noteKey },
      });
      if (!student) continue;
      student.task1.collectionNoteCount += 1;
      student.task1.collectionTextLength += textLength(row.noteText);
      if (student.qualitative.collectionNotes.length < 12) {
        student.qualitative.collectionNotes.push({
          noteKey: row.noteKey,
          text: shortText(row.noteText, 180),
          textLength: textLength(row.noteText),
          createdAt: safeIso(row.createdAt),
        });
      }
    }

    for (const row of collectionNoteCardRows) {
      const student = findStudent(row.userId);
      const card = ensureCardStats(row.cardId);
      if (card) {
        card.noteReferenceCount += 1;
        if (student) card.uniqueNoteStudents.add(student.id);
      }
    }

    for (const row of unlockRows) {
      const student = findStudent(row.userId);
      const category = getCardCategory(row.cardId);
      addEvent({
        dataSource: 'student_unlocked_cards',
        sourceId: `${row.userId}:${row.cardId}`,
        stage: 'task1',
        stageLabel: stageLabels.task1,
        phase: '資料卡解鎖狀態',
        userId: row.userId,
        eventType: 'student_card_unlocked',
        eventLabel: '學生已解鎖資料卡',
        targetType: 'card',
        targetId: row.cardId,
        cardId: row.cardId,
        category,
        createdAt: row.unlockedAt || row.updatedAt,
      });
      const card = ensureCardStats(row.cardId);
      if (!student || !card) continue;
      student.sets.unlockedCards.add(String(row.cardId));
      student.sets.unlockedCategories.add(category);
      card.unlockCount += 1;
      card.uniqueUnlockStudents.add(student.id);
    }

    for (const row of mapChoiceRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'map_choices',
        sourceId: row.id,
        stage: 'task2',
        stageLabel: stageLabels.task2,
        phase: `${row.scope === 'personal' ? '個人' : row.scope === 'group' ? '小組' : '全班'}地圖目前選擇`,
        userId: row.userId,
        groupId: row.groupId,
        eventType: 'map_choice_current',
        eventLabel: '地圖目前選擇',
        targetType: 'district',
        targetId: row.districtName,
        districtName: row.districtName,
        choice: row.choice,
        createdAt: row.updatedAt || row.createdAt,
        meta: { scope: row.scope, ownerId: row.ownerId },
      });
      if (!student || row.scope !== 'personal') continue;
      student.task2.mapChoiceCount += 1;
      student.sets.mapDistricts.add(String(row.districtName));
      if (row.choice === '保育') student.task2.conservationChoiceCount += 1;
      if (row.choice === '開發') student.task2.developmentChoiceCount += 1;
      if (row.choice === '我不知道') student.task2.unknownChoiceCount += 1;
    }

    for (const row of mapActionRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'map_action_logs',
        sourceId: row.id,
        stage: 'task2',
        stageLabel: stageLabels.task2,
        phase: '地圖操作歷程',
        userId: row.userId,
        groupId: row.groupId,
        eventType: row.actionType,
        eventLabel: row.previousChoice && row.previousChoice !== row.newChoice ? '地圖選擇改變' : '地圖選擇設定',
        targetType: 'district',
        targetId: row.districtName,
        districtName: row.districtName,
        choice: row.newChoice,
        createdAt: row.createdAt,
        meta: { scope: row.scope, previousChoice: row.previousChoice, newChoice: row.newChoice },
      });
      if (!student) continue;
      student.task2.mapActionCount += 1;
      student.sets.mapDistricts.add(String(row.districtName));
      if (row.previousChoice && row.newChoice && row.previousChoice !== row.newChoice) student.task2.positionChangeCount += 1;
    }

    for (const row of voteRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'suspect_votes',
        sourceId: `${row.userId}:${row.roleId}`,
        stage: 'task2',
        stageLabel: stageLabels.task2,
        phase: '角色投票排序',
        userId: row.userId,
        eventType: 'suspect_vote_rank',
        eventLabel: `角色排序第 ${row.rankPosition} 名`,
        targetType: 'role',
        targetId: row.roleId,
        createdAt: row.updatedAt || row.createdAt,
        meta: { roleId: row.roleId, rankPosition: row.rankPosition },
      });
      if (!student) continue;
      student.task2.voteCount += 1;
      if (Number(row.rankPosition) === 1) student.task2.topRankRole = row.roleId;
    }

    const decisionGroupActiveMap = new Map();
    for (const row of decisionRows) {
      const cardIds = selectedCardsFromDecision(row);
      decisionGroupActiveMap.set(row.groupId, cardIds);
      const groupStudents = [...(studentIdsByGroup.get(row.groupId) || [])].map((id) => studentById.get(id)).filter(Boolean);
      for (const student of groupStudents) {
        student.cardpack.groupHasActiveLock = true;
        student.cardpack.activeSelectedCards = cardIds;
        for (const cardId of cardIds) {
          student.sets.selectedCards.add(cardId);
          student.sets.selectedCategories.add(getCardCategory(cardId));
        }
      }
    }

    for (const row of decisionLogRows) {
      const cardIds = selectedCardsFromDecision(row);
      const lockedByStudent = findStudent(row.lockedByUserId);
      addEvent({
        dataSource: 'decisioncard_logs',
        sourceId: row.id,
        stage: 'cardpack',
        stageLabel: stageLabels.cardpack,
        phase: row.actionType === 'lock' ? '小組鎖定三張卡' : '卡包鎖定異動',
        userId: row.lockedByUserId,
        username: lockedByStudent?.username,
        groupId: row.groupId,
        eventType: row.actionType || 'decisioncard_log',
        eventLabel: row.actionType === 'lock' ? '組長送出三張卡' : `卡包操作：${row.actionType}`,
        targetType: 'group',
        targetId: row.groupId,
        text: row.lockReason,
        createdAt: row.createdAt || row.lockedAt,
        meta: { selectedCardIds: cardIds },
      });
      const groupStudents = [...(studentIdsByGroup.get(row.groupId) || [])].map((id) => studentById.get(id)).filter(Boolean);
      for (const student of groupStudents) {
        if (!lockedByStudent || student.id !== lockedByStudent.id) student.cardpack.eventCount += 1;
      }
      if (lockedByStudent) {
        lockedByStudent.cardpack.lockCount += row.actionType === 'lock' ? 1 : 0;
        lockedByStudent.cardpack.latestLockReason = row.lockReason || lockedByStudent.cardpack.latestLockReason;
        if (row.lockReason && lockedByStudent.qualitative.cardPackReasons.length < 6) {
          lockedByStudent.qualitative.cardPackReasons.push({ text: shortText(row.lockReason, 160), createdAt: safeIso(row.createdAt || row.lockedAt), selectedCardIds: cardIds });
        }
      }
      for (const cardId of cardIds) {
        const card = ensureCardStats(cardId);
        if (!card) continue;
        card.decisionSelectedCount += 1;
        card.uniqueDecisionGroups.add(String(row.groupId || 'unassigned'));
      }
    }

    const aiCardsByRecordId = new Map();
    for (const row of aiRecordCardRows) {
      if (!aiCardsByRecordId.has(Number(row.aiHelperRecordId))) aiCardsByRecordId.set(Number(row.aiHelperRecordId), []);
      aiCardsByRecordId.get(Number(row.aiHelperRecordId)).push(String(row.cardId));
    }

    for (const row of aiUnlockRows) {
      const student = findStudent(row.userId);
      addEvent({
        dataSource: 'ai_helper_unlocks',
        sourceId: `${row.userId}:${row.roundKey}:${row.scope}`,
        stage: 'ai',
        stageLabel: stageLabels.ai,
        phase: 'AI 投幣解鎖',
        userId: row.userId,
        eventType: 'ai_helper_unlock_state',
        eventLabel: 'AI 幫幫忙已投幣解鎖',
        targetType: 'ai_helper',
        targetId: row.scope,
        createdAt: row.unlockedAt,
        meta: { roundKey: row.roundKey, scope: row.scope },
      });
      if (student) student.ai.unlockCount += 1;
    }

    for (const row of aiRows) {
      const student = findStudent(row.userId);
      const cardIds = aiCardsByRecordId.get(Number(row.id)) || [];
      addEvent({
        dataSource: 'ai_helper_records',
        sourceId: row.id,
        stage: 'ai',
        stageLabel: stageLabels.ai,
        phase: row.needType || row.helpCategory || 'AI 對話',
        userId: row.userId,
        eventType: row.actionType || 'ai_helper_record',
        eventLabel: row.helpCategory || row.needType || row.actionType || 'AI 幫幫忙紀錄',
        targetType: 'ai_helper',
        targetId: row.scope,
        text: row.requestText || row.focusText || row.collectionReflectionText,
        createdAt: row.createdAt,
        meta: {
          roundKey: row.roundKey,
          needType: row.needType,
          helpCategory: row.helpCategory,
          gapScope: row.gapScope,
          contextLabel: row.contextLabel,
          cardIds,
        },
      });
      if (!student) continue;
      student.ai.requestCount += row.requestText ? 1 : 0;
      student.ai.responseCount += row.responseText ? 1 : 0;
      if (String(row.actionType || '').includes('check') || row.checksInHelp > 0) student.ai.checkCount += 1;
      if (row.isFallback) student.ai.fallbackCount += 1;
      if (row.needType) student.sets.aiNeedTypes.add(String(row.needType));
      if (row.helpCategory) student.sets.aiHelpCategories.add(String(row.helpCategory));
      if ((row.requestText || row.focusText) && student.qualitative.aiRequests.length < 8) {
        student.qualitative.aiRequests.push({
          needType: row.needType,
          helpCategory: row.helpCategory,
          text: shortText(row.requestText || row.focusText, 160),
          createdAt: safeIso(row.createdAt),
        });
      }
      for (const cardId of cardIds) {
        const card = ensureCardStats(cardId);
        if (!card) continue;
        card.aiReferencedCount += 1;
        card.uniqueAiStudents.add(student.id);
      }
    }

    for (const row of barrageRows) {
      addEvent({
        dataSource: 'barrages',
        sourceId: row.id,
        stage: 'other',
        stageLabel: stageLabels.other,
        phase: '彈幕互動',
        userId: row.userId,
        eventType: 'barrage_send',
        eventLabel: '彈幕發送',
        targetType: 'barrage',
        targetId: row.id,
        text: row.content,
        createdAt: row.createdAt,
      });
    }

    for (const student of students) {
      student.task1.unlockedCardCount = student.sets.unlockedCards.size;
      student.task1.unlockedCategoryCount = student.sets.unlockedCategories.size;
      student.task1.evidenceCardCount = student.sets.evidenceCards.size;
      student.task1.evidenceCategoryCount = student.sets.evidenceCategories.size;
      student.task2.mapDistrictCount = student.sets.mapDistricts.size;
      student.cardpack.selectedCardCount = student.sets.selectedCards.size;
      student.cardpack.selectedCategoryCount = student.sets.selectedCategories.size;
      student.ai.needTypes = [...student.sets.aiNeedTypes];
      student.ai.helpCategories = [...student.sets.aiHelpCategories];
      student.overall.activeDays = student.sets.activeDates.size;
      student.overall.dataSourceCount = student.sets.dataSources.size;
      student.filterTags = [
        student.task1.completedInquiryCount > 0 ? '已完成調查書' : '未完成調查書',
        student.task1.evidenceCardCount > 0 ? '有證據卡' : '無證據卡',
        student.task2.mapChoiceCount > 0 ? '有個人地圖選擇' : '無個人地圖選擇',
        student.task2.voteCount > 0 ? '有角色投票' : '無角色投票',
        student.cardpack.groupHasActiveLock ? '小組已鎖定卡包' : '小組未鎖定卡包',
        student.ai.unlockCount > 0 || student.ai.requestCount > 0 ? '有使用AI' : '未使用AI',
      ];
      delete student.sets;
    }

    const groupMap = new Map();
    for (const student of students) {
      const groupId = student.groupId || 'unassigned';
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          groupName: student.groupName || mapGroupName(groupId) || '未分配',
          studentCount: 0,
          activeStudentCount: 0,
          task1CompletedCount: 0,
          task1EvidenceCount: 0,
          task2MapStudentCount: 0,
          task2VoteStudentCount: 0,
          cardpackLockCount: 0,
          cardpackActiveSelectedCards: decisionGroupActiveMap.get(groupId) || [],
          aiUserCount: 0,
          totalEvents: 0,
          totalCardsUnlocked: 0,
          totalEvidenceCards: 0,
          totalMapActions: 0,
        });
      }
      const group = groupMap.get(groupId);
      group.studentCount += 1;
      if (student.overall.eventCount > 0) group.activeStudentCount += 1;
      if (student.task1.completedInquiryCount > 0) group.task1CompletedCount += 1;
      if (student.task1.evidenceCardCount > 0) group.task1EvidenceCount += 1;
      if (student.task2.mapChoiceCount > 0 || student.task2.mapActionCount > 0) group.task2MapStudentCount += 1;
      if (student.task2.voteCount > 0) group.task2VoteStudentCount += 1;
      if (student.ai.unlockCount > 0 || student.ai.requestCount > 0) group.aiUserCount += 1;
      group.totalEvents += student.overall.eventCount;
      group.totalCardsUnlocked += student.task1.unlockedCardCount;
      group.totalEvidenceCards += student.task1.evidenceCardCount;
      group.totalMapActions += student.task2.mapActionCount;
    }
    for (const row of decisionLogRows) {
      const group = groupMap.get(row.groupId);
      if (group && row.actionType === 'lock') group.cardpackLockCount += 1;
    }

    const mapDistrictMap = new Map();
    const ensureDistrict = (districtName) => {
      const key = String(districtName || '未指定地區');
      if (!mapDistrictMap.has(key)) {
        mapDistrictMap.set(key, {
          districtName: key,
          personalChoices: { 保育: 0, 開發: 0, 我不知道: 0 },
          groupChoices: { 保育: 0, 開發: 0, 我不知道: 0 },
          classChoices: { 保育: 0, 開發: 0, 我不知道: 0 },
          actionCount: 0,
          changeCount: 0,
          uniqueStudentCount: new Set(),
        });
      }
      return mapDistrictMap.get(key);
    };
    for (const row of mapChoiceRows) {
      const item = ensureDistrict(row.districtName);
      const bucket = row.scope === 'group' ? item.groupChoices : row.scope === 'class' ? item.classChoices : item.personalChoices;
      if (Object.prototype.hasOwnProperty.call(bucket, row.choice)) bucket[row.choice] += 1;
      if (row.userId) item.uniqueStudentCount.add(Number(row.userId));
    }
    for (const row of mapActionRows) {
      const item = ensureDistrict(row.districtName);
      item.actionCount += 1;
      if (row.userId) item.uniqueStudentCount.add(Number(row.userId));
      if (row.previousChoice && row.newChoice && row.previousChoice !== row.newChoice) item.changeCount += 1;
    }

    const dailyMap = new Map();
    const bumpDaily = (event) => {
      const date = event.createdAt ? event.createdAt.slice(0, 10) : '未記錄日期';
      if (!dailyMap.has(date)) dailyMap.set(date, { date, task1: 0, task2: 0, cardpack: 0, ai: 0, other: 0, total: 0 });
      const item = dailyMap.get(date);
      item[event.stage] = (item[event.stage] || 0) + 1;
      item.total += 1;
    };
    unifiedEvents.forEach(bumpDaily);

    const transitionMap = new Map();
    const eventsByUser = new Map();
    for (const event of unifiedEvents.filter((item) => item.userId && item.createdAt)) {
      if (!eventsByUser.has(event.userId)) eventsByUser.set(event.userId, []);
      eventsByUser.get(event.userId).push(event);
    }
    for (const events of eventsByUser.values()) {
      events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      for (let index = 0; index < events.length - 1; index += 1) {
        const from = events[index].phase || events[index].stageLabel;
        const to = events[index + 1].phase || events[index + 1].stageLabel;
        const key = `${from}→${to}`;
        if (!transitionMap.has(key)) transitionMap.set(key, { from, to, count: 0, studentIds: new Set(), examples: [] });
        const item = transitionMap.get(key);
        item.count += 1;
        item.studentIds.add(events[index].userId);
        if (item.examples.length < 4) item.examples.push(`${events[index].username}: ${from} → ${to}`);
      }
    }

    const makeStageSummary = (stage, config) => {
      const counter = stageCounter[stage];
      return {
        stage,
        label: config.label,
        purpose: config.purpose,
        dataSources: [...counter.dataSources],
        eventCount: counter.eventCount,
        activeStudentCount: counter.activeStudentIds.size,
        phaseBreakdown: [...counter.phases.entries()].map(([phase, count]) => ({ phase, count })).sort((a, b) => b.count - a.count),
        metrics: config.metrics(),
        quantitativeMethods: config.quantitativeMethods,
        qualitativeMaterials: config.qualitativeMaterials,
        recommendedVisualizations: config.recommendedVisualizations,
      };
    };

    const stageSummaries = [
      makeStageSummary('task1', {
        label: stageLabels.task1,
        purpose: '整理學生在前導問題、資料卡探索、理由撰寫、證據選擇與調查書成果留下的紀錄。',
        metrics: () => ({
          orientationAnswerCount: orientationRows.length,
          inquiryRecordCount: recordRows.length,
          completedInquiryCount: students.reduce((sum, student) => sum + (student.task1.completedInquiryCount > 0 ? 1 : 0), 0),
          unlockedCardCount: unlockRows.length,
          evidenceCardSelectionCount: recordCardRows.filter((row) => Boolean(row.isEvidence)).length,
          collectionNoteCount: collectionNoteRows.length,
        }),
        quantitativeMethods: ['人數／次數統計', '學生 × 指標交叉表', '卡片開啟→解鎖→證據選擇漏斗', '資料類型分布', '文字長度描述統計'],
        qualitativeMaterials: ['前導問題回答', '蒐集理由 note', '調查書結論文字', '證據卡組合'],
        recommendedVisualizations: ['階段漏斗圖', '學生矩陣表', '卡片類型長條圖', '個人時間軸', '文字樣本清單'],
      }),
      makeStageSummary('task2', {
        label: stageLabels.task2,
        purpose: '整理學生在個人地圖、小組／全班地圖、地區選擇改變與角色投票留下的紀錄。',
        metrics: () => ({
          mapChoiceCount: mapChoiceRows.length,
          personalMapChoiceCount: mapChoiceRows.filter((row) => row.scope === 'personal').length,
          mapActionCount: mapActionRows.length,
          mapChangeCount: mapActionRows.filter((row) => row.previousChoice && row.newChoice && row.previousChoice !== row.newChoice).length,
          voteCount: voteRows.length,
          votedStudentCount: new Set(voteRows.map((row) => Number(row.userId))).size,
        }),
        quantitativeMethods: ['地區 × 選擇交叉表', '學生 × 地圖操作次數', '選擇變更次數統計', '角色排序分布', '小組地圖差異比較'],
        qualitativeMaterials: ['地圖選擇歷程', '角色排序資料', '選擇改變前後紀錄'],
        recommendedVisualizations: ['地區選擇堆疊表', '地圖操作時間序列', '角色排名表', '個人與小組選擇對照表'],
      }),
      makeStageSummary('cardpack', {
        label: stageLabels.cardpack,
        purpose: '整理學生開啟卡包、小組組長鎖定三張卡、鎖定理由與小組目前卡片狀態。',
        metrics: () => ({
          activeLockedGroupCount: decisionRows.length,
          decisionLogCount: decisionLogRows.length,
          lockActionCount: decisionLogRows.filter((row) => row.actionType === 'lock').length,
          selectedCardMentions: decisionLogRows.reduce((sum, row) => sum + selectedCardsFromDecision(row).length, 0),
          lockReasonCount: decisionLogRows.filter((row) => String(row.lockReason || '').trim()).length,
        }),
        quantitativeMethods: ['小組 × 鎖定狀態表', '被選卡片次數排名', '卡片類型分布', '組長送出次數', '鎖定理由字數描述統計'],
        qualitativeMaterials: ['小組鎖定理由', '三張卡組合', '卡包操作事件'],
        recommendedVisualizations: ['小組卡包狀態卡', '卡片被選排名', '組別比較表', '鎖定理由文字清單'],
      }),
      makeStageSummary('ai', {
        label: stageLabels.ai,
        purpose: '整理 AI 幫幫忙投幣、對話、檢查缺口、引用卡片與學生輸入文字。',
        metrics: () => ({
          aiUnlockCount: aiUnlockRows.length,
          aiRecordCount: aiRows.length,
          aiUserCount: new Set(aiRows.map((row) => Number(row.userId))).size,
          aiFallbackCount: aiRows.filter((row) => Boolean(row.isFallback)).length,
          aiReferencedCardCount: aiRecordCardRows.length,
        }),
        quantitativeMethods: ['學生 × AI 使用次數', 'AI 功能類型分布', '檢查次數統計', 'AI 引用卡片次數', 'AI 使用前後事件序列'],
        qualitativeMaterials: ['學生提問內容', 'AI 回應摘要', '焦點文字', '引用卡片'],
        recommendedVisualizations: ['AI 使用分布圖', '學生使用明細表', '功能類型長條圖', 'AI 文字樣本清單'],
      }),
    ];


    const roundNumber = (value, digits = 2) => {
      const numberValue = Number(value || 0);
      if (!Number.isFinite(numberValue)) return 0;
      const base = 10 ** digits;
      return Math.round(numberValue * base) / base;
    };

    const divideNumber = (numerator, denominator, digits = 2) => {
      const den = Number(denominator || 0);
      if (!den) return 0;
      return roundNumber(Number(numerator || 0) / den, digits);
    };

    const percentNumber = (numerator, denominator, digits = 1) => {
      const den = Number(denominator || 0);
      if (!den) return 0;
      return roundNumber((Number(numerator || 0) / den) * 100, digits);
    };

    const calcNumberStats = (values, digits = 2) => {
      const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      if (numericValues.length === 0) return { count: 0, sum: 0, avg: 0, min: 0, max: 0, median: 0 };
      const sorted = [...numericValues].sort((a, b) => a - b);
      const sum = numericValues.reduce((total, value) => total + value, 0);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
      return {
        count: numericValues.length,
        sum: roundNumber(sum, digits),
        avg: roundNumber(sum / numericValues.length, digits),
        min: roundNumber(sorted[0], digits),
        max: roundNumber(sorted[sorted.length - 1], digits),
        median: roundNumber(median, digits),
      };
    };

    const buildStatsMetric = ({ id, category, label, unit = '', values, description, valueType = 'number', digits = 2 }) => ({
      id,
      category,
      label,
      unit,
      valueType,
      description,
      ...calcNumberStats(values, digits),
    });

    const recordsById = new Map(recordRows.map((row) => [Number(row.id), row]));
    const recordCardsByRecordId = new Map();
    for (const row of recordCardRows) {
      const key = Number(row.inquiryRecordId);
      if (!recordCardsByRecordId.has(key)) recordCardsByRecordId.set(key, []);
      recordCardsByRecordId.get(key).push(row);
    }

    const orientationByRecordId = new Map();
    for (const row of orientationRows) {
      const key = Number(row.inquiryRecordId);
      if (!orientationByRecordId.has(key)) orientationByRecordId.set(key, []);
      orientationByRecordId.get(key).push(row);
    }

    const notesByRecordId = new Map();
    for (const row of collectionNoteRows) {
      const key = Number(row.inquiryRecordId);
      if (!notesByRecordId.has(key)) notesByRecordId.set(key, []);
      notesByRecordId.get(key).push(row);
    }

    const noteCardCountByRecordId = new Map();
    for (const row of collectionNoteCardRows) {
      const key = Number(row.inquiryRecordId);
      noteCardCountByRecordId.set(key, (noteCardCountByRecordId.get(key) || 0) + 1);
    }

    const globalUnlocksByUserId = new Map();
    for (const row of unlockRows) {
      const key = Number(row.userId);
      if (!globalUnlocksByUserId.has(key)) globalUnlocksByUserId.set(key, new Set());
      globalUnlocksByUserId.get(key).add(String(row.cardId));
    }

    const mapChoicesByUserId = new Map();
    for (const row of mapChoiceRows.filter((item) => item.scope === 'personal')) {
      const key = Number(row.userId);
      if (!mapChoicesByUserId.has(key)) mapChoicesByUserId.set(key, []);
      mapChoicesByUserId.get(key).push(row);
    }

    const mapActionsByUserId = new Map();
    for (const row of mapActionRows) {
      const key = Number(row.userId);
      if (!mapActionsByUserId.has(key)) mapActionsByUserId.set(key, []);
      mapActionsByUserId.get(key).push(row);
    }

    const votesByUserId = new Map();
    for (const row of voteRows) {
      const key = Number(row.userId);
      if (!votesByUserId.has(key)) votesByUserId.set(key, []);
      votesByUserId.get(key).push(row);
    }

    const aiRowsByUserId = new Map();
    for (const row of aiRows) {
      const key = Number(row.userId);
      if (!aiRowsByUserId.has(key)) aiRowsByUserId.set(key, []);
      aiRowsByUserId.get(key).push(row);
    }

    const aiUnlocksByUserId = new Map();
    for (const row of aiUnlockRows) {
      const key = Number(row.userId);
      if (!aiUnlocksByUserId.has(key)) aiUnlocksByUserId.set(key, []);
      aiUnlocksByUserId.get(key).push(row);
    }

    const decisionLogsByUserId = new Map();
    for (const row of decisionLogRows) {
      const key = Number(row.lockedByUserId);
      if (!decisionLogsByUserId.has(key)) decisionLogsByUserId.set(key, []);
      decisionLogsByUserId.get(key).push(row);
    }

    const inquiryMetricRows = recordRows.map((record) => {
      const student = findStudent(record.userId);
      const cardsInRecord = recordCardsByRecordId.get(Number(record.id)) || [];
      const usedCardIds = uniqueStrings(cardsInRecord.map((card) => card.cardId));
      const evidenceCardIds = uniqueStrings(cardsInRecord.filter((card) => Boolean(card.isEvidence)).map((card) => card.cardId));
      const usedCategories = uniqueStrings(usedCardIds.map((cardId) => getCardCategory(cardId)).filter(Boolean));
      const evidenceCategories = uniqueStrings(evidenceCardIds.map((cardId) => getCardCategory(cardId)).filter(Boolean));
      const orientationAnswers = orientationByRecordId.get(Number(record.id)) || [];
      const notes = notesByRecordId.get(Number(record.id)) || [];
      const noteTextLength = notes.reduce((sum, note) => sum + textLength(note.noteText), 0);
      const conclusionLength = textLength(record.conclusionText);
      const isCompleted = Boolean(record.endedAt || conclusionLength > 0);
      const started = safeIso(record.startedAt || record.createdAt);
      const ended = safeIso(record.endedAt || record.conclusionCreatedAt || record.updatedAt);
      const durationMinutes = started && ended ? Math.max(0, roundNumber((new Date(ended).getTime() - new Date(started).getTime()) / 60000, 1)) : 0;
      return {
        inquiryRecordId: Number(record.id),
        recordOrder: Number(record.recordOrder || 0),
        userId: Number(record.userId),
        username: student?.username || `學生 ${record.userId}`,
        groupId: student?.groupId || 'unassigned',
        groupName: student?.groupName || mapGroupName(student?.groupId) || '未分配',
        status: isCompleted ? 'completed' : 'draft',
        statusLabel: isCompleted ? '已完成' : '草稿／未送出',
        usedCardCount: usedCardIds.length,
        unlockedCardCount: usedCardIds.length,
        evidenceCardCount: evidenceCardIds.length,
        evidenceConversionRate: percentNumber(evidenceCardIds.length, usedCardIds.length),
        usedCategoryCount: usedCategories.length,
        evidenceCategoryCount: evidenceCategories.length,
        collectionNoteCount: notes.length,
        collectionNoteCardCount: Number(noteCardCountByRecordId.get(Number(record.id)) || 0),
        noteCoverageRate: percentNumber(Number(noteCardCountByRecordId.get(Number(record.id)) || 0), usedCardIds.length),
        noteTextLength,
        avgNoteLength: divideNumber(noteTextLength, notes.length),
        orientationAnswerCount: orientationAnswers.length,
        orientationTextLength: orientationAnswers.reduce((sum, item) => sum + textLength(item.answerText), 0),
        conclusionTextLength: conclusionLength,
        durationMinutes,
        cardIds: usedCardIds,
        evidenceCardIds,
        categoryLabels: usedCategories.map((category) => categoryLabel(category)),
        evidenceCategoryLabels: evidenceCategories.map((category) => categoryLabel(category)),
        startedAt: started,
        endedAt: ended,
      };
    });

    const inquiryMetricsByUserId = new Map();
    for (const row of inquiryMetricRows) {
      if (!inquiryMetricsByUserId.has(row.userId)) inquiryMetricsByUserId.set(row.userId, []);
      inquiryMetricsByUserId.get(row.userId).push(row);
    }

    const studentMetricRows = students.map((student) => {
      const inquiries = inquiryMetricsByUserId.get(student.id) || [];
      const completedInquiries = inquiries.filter((inquiry) => inquiry.status === 'completed');
      const usedCardTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0);
      const evidenceCardTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0);
      const noteTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.collectionNoteCount, 0);
      const noteTextTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.noteTextLength, 0);
      const conclusionTextTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.conclusionTextLength, 0);
      const orientationTotal = inquiries.reduce((sum, inquiry) => sum + inquiry.orientationAnswerCount, 0);
      const globalUnlockedCards = globalUnlocksByUserId.get(student.id) || new Set();
      const uniqueInquiryCards = new Set(inquiries.flatMap((inquiry) => inquiry.cardIds));
      const uniqueEvidenceCards = new Set(inquiries.flatMap((inquiry) => inquiry.evidenceCardIds));
      const uniqueUsedCategories = new Set(inquiries.flatMap((inquiry) => inquiry.categoryLabels));
      const uniqueEvidenceCategories = new Set(inquiries.flatMap((inquiry) => inquiry.evidenceCategoryLabels));
      const personalMapChoices = mapChoicesByUserId.get(student.id) || [];
      const personalMapActions = mapActionsByUserId.get(student.id) || [];
      const studentVotes = votesByUserId.get(student.id) || [];
      const studentAiRows = aiRowsByUserId.get(student.id) || [];
      const studentAiUnlocks = aiUnlocksByUserId.get(student.id) || [];
      const studentDecisionLogs = decisionLogsByUserId.get(student.id) || [];
      const mapDistricts = new Set([...personalMapChoices.map((row) => row.districtName), ...personalMapActions.map((row) => row.districtName)].filter(Boolean));
      const aiReferencedCardCount = studentAiRows.reduce((sum, row) => sum + (aiCardsByRecordId.get(Number(row.id)) || []).length, 0);
      const cardPackSelectedCount = studentDecisionLogs.reduce((sum, row) => sum + selectedCardsFromDecision(row).length, 0);
      const lockReasonTextLength = studentDecisionLogs.reduce((sum, row) => sum + textLength(row.lockReason), 0);
      return {
        userId: student.id,
        username: student.username,
        groupId: student.groupId,
        groupName: student.groupName,
        isGroupLeader: student.isGroupLeader,
        inquiryCount: inquiries.length,
        completedInquiryCount: completedInquiries.length,
        draftInquiryCount: Math.max(0, inquiries.length - completedInquiries.length),
        completionRate: percentNumber(completedInquiries.length, inquiries.length),
        totalUsedCardsInInquiries: usedCardTotal,
        totalUnlockedCardsInInquiries: usedCardTotal,
        totalEvidenceCardsInInquiries: evidenceCardTotal,
        avgCardsPerInquiry: divideNumber(usedCardTotal, inquiries.length),
        avgUnlockedCardsPerInquiry: divideNumber(usedCardTotal, inquiries.length),
        avgEvidenceCardsPerInquiry: divideNumber(evidenceCardTotal, inquiries.length),
        evidenceConversionRate: percentNumber(evidenceCardTotal, usedCardTotal),
        uniqueUnlockedCardCount: globalUnlockedCards.size,
        uniqueInquiryCardCount: uniqueInquiryCards.size,
        uniqueEvidenceCardCount: uniqueEvidenceCards.size,
        uniqueEvidenceConversionRate: percentNumber(uniqueEvidenceCards.size, globalUnlockedCards.size || uniqueInquiryCards.size),
        categoryDiversity: uniqueUsedCategories.size,
        evidenceCategoryDiversity: uniqueEvidenceCategories.size,
        maxCardsInSingleInquiry: calcNumberStats(inquiries.map((inquiry) => inquiry.usedCardCount)).max,
        minCardsInSingleInquiry: calcNumberStats(inquiries.map((inquiry) => inquiry.usedCardCount)).min,
        maxEvidenceCardsInSingleInquiry: calcNumberStats(inquiries.map((inquiry) => inquiry.evidenceCardCount)).max,
        minEvidenceCardsInSingleInquiry: calcNumberStats(inquiries.map((inquiry) => inquiry.evidenceCardCount)).min,
        orientationAnswerCount: orientationTotal,
        collectionNoteCount: noteTotal,
        avgCollectionNoteLength: divideNumber(noteTextTotal, noteTotal),
        conclusionTextTotal,
        avgConclusionLength: divideNumber(conclusionTextTotal, inquiries.length),
        mapDistrictCount: mapDistricts.size,
        mapChoiceCount: personalMapChoices.length,
        mapActionCount: personalMapActions.length,
        mapChangeCount: personalMapActions.filter((row) => row.previousChoice && row.newChoice && row.previousChoice !== row.newChoice).length,
        voteRankCount: studentVotes.length,
        hasCompletedVote: studentVotes.length >= 3,
        aiUnlockCount: studentAiUnlocks.length,
        aiRecordCount: studentAiRows.length,
        aiRequestCount: studentAiRows.filter((row) => textLength(row.requestText) > 0).length,
        aiCheckCount: studentAiRows.filter((row) => String(row.actionType || '').includes('check') || Number(row.checksInHelp || 0) > 0).length,
        aiReferencedCardCount,
        cardPackLockCount: studentDecisionLogs.filter((row) => row.actionType === 'lock').length,
        cardPackSelectedCardCount: cardPackSelectedCount,
        avgCardPackReasonLength: divideNumber(lockReasonTextLength, studentDecisionLogs.filter((row) => textLength(row.lockReason) > 0).length),
        overallEventCount: student.overall.eventCount,
        activeDays: student.overall.activeDays,
        firstAt: student.overall.firstAt,
        lastAt: student.overall.lastAt,
      };
    });

    const groupMetricRows = [...groupMap.values()].map((group) => {
      const members = studentMetricRows.filter((student) => student.groupId === group.groupId);
      const inquiryRows = inquiryMetricRows.filter((inquiry) => inquiry.groupId === group.groupId);
      const groupDecisionLogs = decisionLogRows.filter((row) => row.groupId === group.groupId);
      const usedCardTotal = inquiryRows.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0);
      const evidenceCardTotal = inquiryRows.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0);
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        studentCount: members.length,
        inquiryCount: inquiryRows.length,
        completedInquiryCount: inquiryRows.filter((inquiry) => inquiry.status === 'completed').length,
        avgInquiryPerStudent: divideNumber(inquiryRows.length, members.length),
        avgCompletedInquiryPerStudent: divideNumber(inquiryRows.filter((inquiry) => inquiry.status === 'completed').length, members.length),
        avgCardsPerInquiry: divideNumber(usedCardTotal, inquiryRows.length),
        avgEvidenceCardsPerInquiry: divideNumber(evidenceCardTotal, inquiryRows.length),
        evidenceConversionRate: percentNumber(evidenceCardTotal, usedCardTotal),
        mapActionCount: members.reduce((sum, member) => sum + member.mapActionCount, 0),
        mapChangeCount: members.reduce((sum, member) => sum + member.mapChangeCount, 0),
        aiRecordCount: members.reduce((sum, member) => sum + member.aiRecordCount, 0),
        cardPackLockCount: groupDecisionLogs.filter((row) => row.actionType === 'lock').length,
        cardPackSelectedCardCount: groupDecisionLogs.reduce((sum, row) => sum + selectedCardsFromDecision(row).length, 0),
        avgCardPackReasonLength: divideNumber(groupDecisionLogs.reduce((sum, row) => sum + textLength(row.lockReason), 0), groupDecisionLogs.filter((row) => textLength(row.lockReason) > 0).length),
      };
    });

    const categoryMetricMap = new Map();
    const ensureCategoryMetric = (category) => {
      const id = String(category || 'unknown');
      if (!categoryMetricMap.has(id)) {
        categoryMetricMap.set(id, {
          category: id,
          categoryLabel: categoryLabel(id),
          usedInInquiryCount: 0,
          evidenceCount: 0,
          globalUnlockCount: 0,
          noteReferenceCount: 0,
          cardPackSelectedCount: 0,
          aiReferencedCount: 0,
          uniqueStudentsUsed: new Set(),
          uniqueStudentsEvidence: new Set(),
        });
      }
      return categoryMetricMap.get(id);
    };

    for (const inquiry of inquiryMetricRows) {
      const record = recordsById.get(Number(inquiry.inquiryRecordId));
      const cards = recordCardsByRecordId.get(Number(inquiry.inquiryRecordId)) || [];
      for (const card of cards) {
        const metric = ensureCategoryMetric(getCardCategory(card.cardId));
        metric.usedInInquiryCount += 1;
        metric.uniqueStudentsUsed.add(Number(record?.user_id || inquiry.userId));
        if (Boolean(card.isEvidence)) {
          metric.evidenceCount += 1;
          metric.uniqueStudentsEvidence.add(Number(record?.user_id || inquiry.userId));
        }
      }
    }
    for (const row of unlockRows) ensureCategoryMetric(getCardCategory(row.cardId)).globalUnlockCount += 1;
    for (const row of collectionNoteCardRows) ensureCategoryMetric(getCardCategory(row.cardId)).noteReferenceCount += 1;
    for (const row of decisionLogRows) {
      selectedCardsFromDecision(row).forEach((cardId) => { ensureCategoryMetric(getCardCategory(cardId)).cardPackSelectedCount += 1; });
    }
    for (const row of aiRecordCardRows) ensureCategoryMetric(getCardCategory(row.cardId)).aiReferencedCount += 1;

    const categoryMetricRows = [...categoryMetricMap.values()].map((item) => ({
      category: item.category,
      categoryLabel: item.categoryLabel,
      usedInInquiryCount: item.usedInInquiryCount,
      evidenceCount: item.evidenceCount,
      evidenceConversionRate: percentNumber(item.evidenceCount, item.usedInInquiryCount),
      globalUnlockCount: item.globalUnlockCount,
      noteReferenceCount: item.noteReferenceCount,
      cardPackSelectedCount: item.cardPackSelectedCount,
      aiReferencedCount: item.aiReferencedCount,
      uniqueStudentsUsed: item.uniqueStudentsUsed.size,
      uniqueStudentsEvidence: item.uniqueStudentsEvidence.size,
    })).sort((a, b) => b.usedInInquiryCount - a.usedInInquiryCount);

    const classMetrics = {
      generatedAt: new Date().toISOString(),
      totalStudents: students.length,
      studentsWithInquiryCount: studentMetricRows.filter((student) => student.inquiryCount > 0).length,
      studentsWithCompletedInquiryCount: studentMetricRows.filter((student) => student.completedInquiryCount > 0).length,
      totalInquiryCount: inquiryMetricRows.length,
      completedInquiryCount: inquiryMetricRows.filter((inquiry) => inquiry.status === 'completed').length,
      completionRate: percentNumber(inquiryMetricRows.filter((inquiry) => inquiry.status === 'completed').length, inquiryMetricRows.length),
      totalCardsUsedInInquiries: inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0),
      totalEvidenceCardsInInquiries: inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0),
      avgInquiryPerStudent: divideNumber(inquiryMetricRows.length, students.length),
      avgCompletedInquiryPerStudent: divideNumber(inquiryMetricRows.filter((inquiry) => inquiry.status === 'completed').length, students.length),
      avgCardsPerInquiry: divideNumber(inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0), inquiryMetricRows.length),
      avgUnlockedCardsPerInquiry: divideNumber(inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.unlockedCardCount, 0), inquiryMetricRows.length),
      avgEvidenceCardsPerInquiry: divideNumber(inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0), inquiryMetricRows.length),
      evidenceConversionRate: percentNumber(inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0), inquiryMetricRows.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0)),
      avgStudentEvidenceConversionRate: calcNumberStats(studentMetricRows.map((student) => student.evidenceConversionRate), 1).avg,
      maxCardsPerInquiry: calcNumberStats(inquiryMetricRows.map((inquiry) => inquiry.usedCardCount)).max,
      minCardsPerInquiry: calcNumberStats(inquiryMetricRows.map((inquiry) => inquiry.usedCardCount)).min,
      maxInquiryCountPerStudent: calcNumberStats(studentMetricRows.map((student) => student.inquiryCount)).max,
      minInquiryCountPerStudent: calcNumberStats(studentMetricRows.map((student) => student.inquiryCount)).min,
      maxEvidenceConversionRate: calcNumberStats(studentMetricRows.map((student) => student.evidenceConversionRate), 1).max,
      minEvidenceConversionRate: calcNumberStats(studentMetricRows.map((student) => student.evidenceConversionRate), 1).min,
      totalGlobalUnlockedCards: unlockRows.length,
      avgGlobalUnlockedCardsPerStudent: divideNumber(unlockRows.length, students.length),
      totalCollectionNotes: collectionNoteRows.length,
      avgCollectionNotesPerInquiry: divideNumber(collectionNoteRows.length, inquiryMetricRows.length),
      avgConclusionLength: calcNumberStats(inquiryMetricRows.map((inquiry) => inquiry.conclusionTextLength)).avg,
      totalMapChoices: mapChoiceRows.filter((row) => row.scope === 'personal').length,
      avgMapDistrictsPerStudent: calcNumberStats(studentMetricRows.map((student) => student.mapDistrictCount)).avg,
      mapChangeRate: percentNumber(mapActionRows.filter((row) => row.previousChoice && row.newChoice && row.previousChoice !== row.newChoice).length, mapActionRows.length),
      voteCompletionRate: percentNumber(studentMetricRows.filter((student) => student.hasCompletedVote).length, students.length),
      activeLockedGroupCount: decisionRows.length,
      cardPackLockCount: decisionLogRows.filter((row) => row.actionType === 'lock').length,
      avgCardPackReasonLength: calcNumberStats(studentMetricRows.map((student) => student.avgCardPackReasonLength)).avg,
      aiUserCount: studentMetricRows.filter((student) => student.aiRecordCount > 0 || student.aiUnlockCount > 0).length,
      avgAiRecordsPerStudent: calcNumberStats(studentMetricRows.map((student) => student.aiRecordCount)).avg,
      aiReferencedCardCount: aiRecordCardRows.length,
    };

    const metricDefinitions = [
      { id: 'inquiryCount', category: '調查書', label: '調查書份數', unit: '份', description: '學生建立過的 inquiry_records 筆數，包含已完成與草稿。' },
      { id: 'completedInquiryCount', category: '調查書', label: '完成調查書份數', unit: '份', description: '有送出時間或結論文字的調查書份數。' },
      { id: 'avgCardsPerInquiry', category: '資料卡', label: '平均每份調查書用卡數', unit: '張/份', description: 'inquiry_record_cards 在每份調查書中的平均張數。' },
      { id: 'avgUnlockedCardsPerInquiry', category: '資料卡', label: '平均每份調查書解鎖卡數', unit: '張/份', description: '本系統以每份調查書引用／帶入的卡片作為該份調查書的解鎖卡數。' },
      { id: 'evidenceConversionRate', category: '證據', label: '用卡轉證據比例', unit: '%', description: '調查書中 is_evidence=1 的卡片數 ÷ 該調查書使用卡片數。' },
      { id: 'uniqueEvidenceConversionRate', category: '證據', label: '不重複解鎖卡轉證據比例', unit: '%', description: '學生不重複證據卡數 ÷ 學生不重複解鎖卡數。' },
      { id: 'categoryDiversity', category: '資料卡', label: '資料類型多樣性', unit: '類', description: '學生調查書中出現過的資料類型數。' },
      { id: 'collectionNoteCount', category: '文字', label: '蒐集理由筆數', unit: '筆', description: '學生針對資料卡寫下的理由 note 筆數。' },
      { id: 'avgCollectionNoteLength', category: '文字', label: '平均蒐集理由字數', unit: '字/筆', description: '蒐集理由文字總字數 ÷ 理由筆數。' },
      { id: 'avgConclusionLength', category: '文字', label: '平均調查書結論字數', unit: '字/份', description: '結論文字總字數 ÷ 調查書份數。' },
      { id: 'mapDistrictCount', category: '任務二', label: '地圖選擇地區數', unit: '區', description: '學生曾留下個人地圖選擇或操作的不同地區數。' },
      { id: 'mapChangeCount', category: '任務二', label: '地圖選擇改變次數', unit: '次', description: 'previous_choice 與 new_choice 不同的地圖操作次數。' },
      { id: 'voteRankCount', category: '任務二', label: '角色排序筆數', unit: '筆', description: '學生在 suspect_votes 中留下的角色排序數。' },
      { id: 'cardPackLockCount', category: '卡包', label: '小組卡包送出次數', unit: '次', description: '學生作為鎖定者送出小組三張卡的次數。' },
      { id: 'aiRecordCount', category: 'AI', label: 'AI 幫幫忙互動筆數', unit: '筆', description: '學生在 ai_helper_records 中留下的互動紀錄。' },
    ];

    const classMetricRows = [
      buildStatsMetric({ id: 'inquiryCount', category: '調查書', label: '每位學生調查書份數', unit: '份', values: studentMetricRows.map((student) => student.inquiryCount), description: '每位學生建立過的調查書筆數。' }),
      buildStatsMetric({ id: 'completedInquiryCount', category: '調查書', label: '每位學生完成調查書份數', unit: '份', values: studentMetricRows.map((student) => student.completedInquiryCount), description: '每位學生已完成調查書份數。' }),
      buildStatsMetric({ id: 'usedCardCount', category: '資料卡', label: '每份調查書使用卡片數', unit: '張', values: inquiryMetricRows.map((inquiry) => inquiry.usedCardCount), description: '單一份調查書使用幾張資料卡。' }),
      buildStatsMetric({ id: 'evidenceCardCount', category: '證據', label: '每份調查書證據卡數', unit: '張', values: inquiryMetricRows.map((inquiry) => inquiry.evidenceCardCount), description: '單一份調查書選為證據的卡片數。' }),
      buildStatsMetric({ id: 'evidenceConversionRate', category: '證據', label: '學生用卡轉證據比例', unit: '%', values: studentMetricRows.map((student) => student.evidenceConversionRate), description: '各學生：調查書內證據卡總數 ÷ 調查書內用卡總數。', valueType: 'percent', digits: 1 }),
      buildStatsMetric({ id: 'uniqueEvidenceConversionRate', category: '證據', label: '學生不重複解鎖卡轉證據比例', unit: '%', values: studentMetricRows.map((student) => student.uniqueEvidenceConversionRate), description: '各學生：不重複證據卡 ÷ 不重複解鎖卡。', valueType: 'percent', digits: 1 }),
      buildStatsMetric({ id: 'categoryDiversity', category: '資料卡', label: '學生使用資料類型數', unit: '類', values: studentMetricRows.map((student) => student.categoryDiversity), description: '每位學生調查書中使用過的資料類型數。' }),
      buildStatsMetric({ id: 'collectionNoteCount', category: '文字', label: '每位學生蒐集理由筆數', unit: '筆', values: studentMetricRows.map((student) => student.collectionNoteCount), description: '每位學生撰寫蒐集理由 note 的筆數。' }),
      buildStatsMetric({ id: 'avgCollectionNoteLength', category: '文字', label: '學生平均蒐集理由字數', unit: '字', values: studentMetricRows.map((student) => student.avgCollectionNoteLength), description: '各學生的平均蒐集理由字數。' }),
      buildStatsMetric({ id: 'conclusionTextLength', category: '文字', label: '每份調查書結論字數', unit: '字', values: inquiryMetricRows.map((inquiry) => inquiry.conclusionTextLength), description: '每份調查書的結論文字長度。' }),
      buildStatsMetric({ id: 'mapDistrictCount', category: '任務二', label: '每位學生地圖選擇地區數', unit: '區', values: studentMetricRows.map((student) => student.mapDistrictCount), description: '每位學生在任務二留下選擇的不同地區數。' }),
      buildStatsMetric({ id: 'mapChangeCount', category: '任務二', label: '每位學生地圖選擇改變次數', unit: '次', values: studentMetricRows.map((student) => student.mapChangeCount), description: '每位學生改變地圖選擇的次數。' }),
      buildStatsMetric({ id: 'aiRecordCount', category: 'AI', label: '每位學生 AI 互動筆數', unit: '筆', values: studentMetricRows.map((student) => student.aiRecordCount), description: '每位學生使用 AI 幫幫忙留下的互動筆數。' }),
      buildStatsMetric({ id: 'cardPackLockCount', category: '卡包', label: '每位學生卡包送出次數', unit: '次', values: studentMetricRows.map((student) => student.cardPackLockCount), description: '每位學生作為送出者鎖定小組卡包的次數。' }),
    ];

    const analysisViews = [
      {
        id: 'student_summary',
        title: '學生摘要表',
        purpose: '看單一學生或一組學生總共完成幾份調查書、平均用卡量、證據轉換比例與任務二／AI／卡包資料。',
        rows: '一位學生一列',
        mainMetrics: ['調查書份數', '完成調查書份數', '平均每份調查書用卡數', '用卡轉證據比例', '不重複解鎖卡轉證據比例'],
        usefulFilters: ['學生', '小組', '是否組長', '完成份數區間', '證據轉換率區間'],
        visualizations: ['學生排序表', '學生長條比較', '平均／最大／最小摘要卡'],
      },
      {
        id: 'inquiry_detail',
        title: '單份調查書明細表',
        purpose: '看每一份調查書實際用了幾張卡、幾張被轉成證據、理由筆數與結論字數。',
        rows: '一份調查書一列',
        mainMetrics: ['用卡數', '證據卡數', '用卡轉證據比例', '理由筆數', '結論字數'],
        usefulFilters: ['學生', '小組', '完成／草稿', '卡片類型', '用卡數區間'],
        visualizations: ['調查書散佈／排序表', '用卡數分布', '證據比例分布'],
      },
      {
        id: 'class_stats',
        title: '全班描述統計表',
        purpose: '看全班在各指標的平均、最大、最小、中位數與總量，提供你後續自行解釋現象。',
        rows: '一個指標一列',
        mainMetrics: ['平均', '最大', '最小', '中位數', '總量'],
        usefulFilters: ['指標類別', '小組', '學生篩選後重算'],
        visualizations: ['描述統計表', '箱型圖概念表', '小組比較表'],
      },
      {
        id: 'card_conversion',
        title: '資料卡轉換表',
        purpose: '看不同資料類型或單張卡從解鎖／使用到證據、理由、卡包與 AI 引用的數量。',
        rows: '一張卡或一個類型一列',
        mainMetrics: ['使用次數', '證據次數', '轉證據比例', '理由引用', '卡包被選', 'AI 引用'],
        usefulFilters: ['資料類型', '學生', '小組', '卡片'],
        visualizations: ['卡片排名', '類型比較表', '漏斗表'],
      },
      {
        id: 'task2_cardpack_ai',
        title: '任務二／卡包／AI 指標表',
        purpose: '把地圖、卡包與 AI 的可量化資料拆出來，讓你和調查書資料交叉查看。',
        rows: '學生或小組一列',
        mainMetrics: ['地圖地區數', '地圖改變次數', '投票完成率', '卡包鎖定次數', 'AI 互動次數'],
        usefulFilters: ['學生', '小組', '任務階段', 'AI 功能類型'],
        visualizations: ['小組比較表', '任務二指標表', 'AI 使用排名'],
      },
    ];

    const metricDashboard = {
      classMetrics,
      classMetricRows,
      studentMetricRows: studentMetricRows.sort((a, b) => b.completedInquiryCount - a.completedInquiryCount || b.inquiryCount - a.inquiryCount || a.username.localeCompare(b.username, 'zh-Hant')),
      inquiryMetricRows: inquiryMetricRows.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-Hant') || a.username.localeCompare(b.username, 'zh-Hant') || a.recordOrder - b.recordOrder),
      groupMetricRows: groupMetricRows.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-Hant')),
      categoryMetricRows,
      metricDefinitions,
      analysisViews,
    };

    const overview = {
      generatedAt: new Date().toISOString(),
      totalStudents: students.length,
      activeStudentCount: students.filter((student) => student.overall.eventCount > 0).length,
      totalEvents: unifiedEvents.length,
      task1StudentCount: students.filter((student) => student.task1.eventCount > 0).length,
      task2StudentCount: students.filter((student) => student.task2.eventCount > 0).length,
      cardpackStudentCount: students.filter((student) => student.cardpack.eventCount > 0 || student.cardpack.groupHasActiveLock).length,
      aiUserCount: students.filter((student) => student.ai.eventCount > 0).length,
      completedInquiryStudentCount: students.filter((student) => student.task1.completedInquiryCount > 0).length,
      evidenceStudentCount: students.filter((student) => student.task1.evidenceCardCount > 0).length,
      mapStudentCount: students.filter((student) => student.task2.mapChoiceCount > 0 || student.task2.mapActionCount > 0).length,
      lockedGroupCount: decisionRows.length,
      dataSourceCount: new Set(unifiedEvents.map((event) => event.dataSource)).size,
    };

    const filterDimensions = {
      stages: Object.entries(stageLabels).map(([id, label]) => ({ id, label })),
      groups: [...groupMap.values()].map((group) => ({ id: group.groupId, label: group.groupName, studentCount: group.studentCount })),
      students: students.map((student) => ({ id: student.id, label: student.username, groupId: student.groupId, groupName: student.groupName })),
      categories: [...new Set([...cardStats.values()].map((card) => card.category).filter(Boolean))].map((id) => ({ id, label: categoryLabel(id) })),
      eventTypes: [...new Set(unifiedEvents.map((event) => event.eventType).filter(Boolean))].sort().map((id) => ({ id, label: id })),
      dataSources: [...new Set(unifiedEvents.map((event) => event.dataSource).filter(Boolean))].sort().map((id) => ({ id, label: id })),
      mapChoices: ['保育', '開發', '我不知道'].map((id) => ({ id, label: id })),
      filterTags: [...new Set(students.flatMap((student) => student.filterTags))].map((id) => ({ id, label: id })),
    };

    const analysisRecipes = [
      {
        id: 'student_stage_matrix',
        title: '學生 × 階段指標矩陣',
        question: '篩出每位學生在任務一、任務二、卡包、AI 的操作量與成果欄位。',
        usefulFilters: ['學生', '小組', '階段', '是否完成調查書', '是否有證據卡', '是否有地圖選擇', '是否使用 AI'],
        quantitative: ['次數統計', '平均數／中位數／最大最小值', '小組分組比較', '排序與百分位'],
        qualitative: ['前導回答', '蒐集理由', '調查書結論', '卡包理由', 'AI 提問文字'],
        visualizations: ['學生比較表', '階段完成漏斗', '個人時間軸', '小組熱度表'],
      },
      {
        id: 'card_funnel',
        title: '資料卡使用漏斗',
        question: '篩出哪些卡被打開、解鎖、寫理由、選成證據、最後被小組選入卡包。',
        usefulFilters: ['卡片類型', '小組', '學生', '階段'],
        quantitative: ['開啟率', '解鎖率', '證據選擇率', '卡包被選次數', '類型分布'],
        qualitative: ['該卡對應的蒐集理由 note', '該卡出現在調查書中的上下文', '卡包鎖定理由'],
        visualizations: ['漏斗圖', '卡片排名表', '卡片類型堆疊長條圖', '卡片詳情表'],
      },
      {
        id: 'map_choice_cross_table',
        title: '地區 × 地圖選擇交叉表',
        question: '篩出每個地區被選為保育、開發或我不知道的分布，以及學生是否曾改變選擇。',
        usefulFilters: ['地區', '小組', '學生', '選擇類型', '是否改變選擇'],
        quantitative: ['交叉表', '比例分布', '變更次數', '個人／小組／全班對照'],
        qualitative: ['選擇改變前後紀錄', '可回看該學生任務一證據與理由'],
        visualizations: ['地區選擇表', '堆疊長條圖', '地圖操作時間序列', '學生地區明細表'],
      },
      {
        id: 'text_material_pool',
        title: '文字資料池',
        question: '把學生留下的文字資料集中篩選，方便後續人工編碼或質性分析。',
        usefulFilters: ['文字來源', '學生', '小組', '階段', '卡片類型', 'AI 功能類型'],
        quantitative: ['文字筆數', '字數統計', '來源分布', '學生文字量排序'],
        qualitative: ['開放編碼', '主張／理由／證據標記', '錯誤概念標記', '典型案例摘錄'],
        visualizations: ['文字樣本清單', '學生文字量表', '來源分布圖', '編碼工作表匯出'],
      },
      {
        id: 'sequence_log',
        title: '行為序列與原始紀錄追溯',
        question: '篩出學生在時間上先做什麼、後做什麼，保留原始事件方便回查。',
        usefulFilters: ['學生', '小組', '階段', '事件類型', '日期', '資料來源'],
        quantitative: ['事件序列轉換次數', '活躍天數', '階段停留事件量', '每日事件量'],
        qualitative: ['個人歷程敘事', '轉折點事件', '重要文字與行為對照'],
        visualizations: ['個人時間軸', '每日折線／長條', '轉換表', '原始紀錄表'],
      },
    ];

    res.json({
      overview,
      stageSummaries,
      students: students.sort((a, b) => b.overall.eventCount - a.overall.eventCount || a.username.localeCompare(b.username, 'zh-Hant')),
      groups: [...groupMap.values()].sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-Hant')),
      cards: [...cardStats.values()].map((card) => ({
        ...card,
        uniqueOpenStudents: card.uniqueOpenStudents.size,
        uniqueUnlockStudents: card.uniqueUnlockStudents.size,
        uniqueEvidenceStudents: card.uniqueEvidenceStudents.size,
        uniqueNoteStudents: card.uniqueNoteStudents.size,
        uniqueDecisionGroups: card.uniqueDecisionGroups.size,
        uniqueAiStudents: card.uniqueAiStudents.size,
      })).sort((a, b) => (b.evidenceCount + b.decisionSelectedCount + b.unlockCount) - (a.evidenceCount + a.decisionSelectedCount + a.unlockCount)),
      mapDistricts: [...mapDistrictMap.values()].map((item) => ({
        ...item,
        uniqueStudentCount: item.uniqueStudentCount.size,
      })).sort((a, b) => b.actionCount - a.actionCount || a.districtName.localeCompare(b.districtName, 'zh-Hant')),
      trends: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      transitions: [...transitionMap.values()].map((item) => ({
        from: item.from,
        to: item.to,
        count: item.count,
        studentCount: item.studentIds.size,
        examples: item.examples,
      })).sort((a, b) => b.count - a.count).slice(0, 80),
      rawEvents: unifiedEvents
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 5000),
      filterDimensions,
      analysisRecipes,
      metrics: metricDashboard,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取學習分析儀表板失敗" });
  }
}


  return {
    getLearningDashboard,
  };
}

module.exports = { createTeacherLearningDashboardService };
