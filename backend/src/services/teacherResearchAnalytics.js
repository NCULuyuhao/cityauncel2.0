/**
 * Teacher research analytics service.
 *
 * 事後研究分析專用：只整理原始歷程資料與描述性統計，不產生能力評分、品質判斷或學習成效推論。
 */

function createTeacherResearchAnalyticsService(dependencies) {
  const {
    pool,
    GROUPS = {},
    parseJSON = (value) => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch { return null; }
    },
    mapGroupName = (groupId) => GROUPS?.[groupId]?.name || groupId || '未分組',
    ensureUsersGenderColumn,
    ensureDataCardSourcesTable,
    ensureMapChoicesTable,
    ensureInquiryNormalizedTables,
    ensureDecisioncardsTable,
  } = dependencies;

  const roundLabel = (order) => `探究書 ${Number(order || 0) || '-'}`;
  const genderLabel = (gender) => gender === 'male' ? '男' : gender === 'female' ? '女' : '未填';
  const toNumber = (value) => Number(value || 0);
  const unique = (values) => [...new Set((values || []).filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map(String))];
  const avg = (sum, count) => count > 0 ? Number((sum / count).toFixed(2)) : 0;
  const percent = (part, total) => total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0;

  function inferCategory(cardId, explicitCategory) {
    if (explicitCategory) return String(explicitCategory);
    const id = String(cardId || '').toLowerCase();
    if (id.startsWith('land')) return 'land';
    if (id.startsWith('water') || id.includes('rpi') || id.includes('rain') || id.includes('station')) return 'water';
    if (id.startsWith('leopard')) return 'leopard';
    if (id.startsWith('population')) return 'population';
    if (id.startsWith('rumor')) return 'other';
    if (id.startsWith('other')) return 'other';
    if (id.startsWith('snapshot')) return 'other';
    return 'other';
  }

  function categoryLabel(category) {
    const labels = {
      land: '土地',
      water: '水資源',
      leopard: '石虎',
      population: '人口',
      other: '其他',
      rumor: '其他',
      unknown: '其他',
    };
    return labels[String(category || 'other')] || String(category || '其他');
  }

  function sourceTitle(row) {
    const payload = parseJSON(row.sourcePayload || row.source_payload);
    return payload?.title || payload?.name || payload?.label || row.cardId || row.card_id || '';
  }

  function makeStudent(row) {
    const groupId = row.groupId || row.group_id || 'unassigned';
    return {
      userId: Number(row.id),
      username: row.username,
      gender: row.gender || null,
      genderLabel: genderLabel(row.gender),
      groupId,
      groupName: mapGroupName(groupId) || '未分組',
      isGroupLeader: Boolean(row.isGroupLeader || row.is_group_leader),
      titleCount: Number(row.titleCount || row.barrage_coins || 0),
    };
  }

  function initMetrics(student) {
    return {
      userId: student.userId,
      username: student.username,
      gender: student.gender,
      genderLabel: student.genderLabel,
      groupId: student.groupId,
      groupName: student.groupName,
      isGroupLeader: student.isGroupLeader,
      inquiryCount: 0,
      completedInquiryCount: 0,
      unlockedCardCount: 0,
      inquiryCardCount: 0,
      evidenceCardCount: 0,
      noteCount: 0,
      aiUseCount: 0,
      rewardCount: 0,
      mapChoiceCount: 0,
      decisionProposalCount: 0,
    };
  }

  function buildStats(rows, field) {
    const nums = rows.map((row) => toNumber(row[field]));
    const sum = nums.reduce((acc, n) => acc + n, 0);
    return { sum, avg: avg(sum, nums.length), min: nums.length ? Math.min(...nums) : 0, max: nums.length ? Math.max(...nums) : 0 };
  }

  function summaryFor(rows) {
    const inquiry = buildStats(rows, 'inquiryCount');
    const unlocked = buildStats(rows, 'unlockedCardCount');
    const evidence = buildStats(rows, 'evidenceCardCount');
    const note = buildStats(rows, 'noteCount');
    const ai = buildStats(rows, 'aiUseCount');
    const reward = buildStats(rows, 'rewardCount');
    return {
      studentCount: rows.length,
      averageInquiryCount: inquiry.avg,
      averageUnlockedCardCount: unlocked.avg,
      averageEvidenceCardCount: evidence.avg,
      averageNoteCount: note.avg,
      aiUserCount: rows.filter((row) => row.aiUseCount > 0).length,
      totalAiUseCount: ai.sum,
      averageAiUseCount: ai.avg,
      averageRewardCount: reward.avg,
    };
  }

  function csvEscape(value) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function toCsv(rows, columns) {
    return [
      columns.map((c) => csvEscape(c.header)).join(','),
      ...rows.map((row) => columns.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(',')),
    ].join('\n');
  }

  async function getResearchAnalytics(req, res) {
    try {
      if (ensureUsersGenderColumn) await ensureUsersGenderColumn();
      if (ensureDataCardSourcesTable) await ensureDataCardSourcesTable();
      if (ensureInquiryNormalizedTables) await ensureInquiryNormalizedTables();
      if (ensureMapChoicesTable) await ensureMapChoicesTable();
      if (ensureDecisioncardsTable) await ensureDecisioncardsTable();

      const [studentRows] = await pool.query(
        `SELECT id, username, gender, group_id AS groupId, is_group_leader AS isGroupLeader, barrage_coins
         FROM users
         WHERE COALESCE(role, 'student') = 'student'
         ORDER BY COALESCE(group_id, 'unassigned'), username, id`,
      );
      const students = studentRows.map(makeStudent);
      const metricsByUser = new Map(students.map((student) => [student.userId, initMetrics(student)]));

      const [sourceRows] = await pool.query(
        `SELECT card_id AS cardId, category, source_type AS sourceType, source_payload AS sourcePayload, created_by_user_id AS createdByUserId, created_at AS createdAt
         FROM data_card_sources`,
      );
      const cardMap = new Map(sourceRows.map((row) => [String(row.cardId), { ...row, title: sourceTitle(row), category: inferCategory(row.cardId, row.category), categoryLabel: categoryLabel(inferCategory(row.cardId, row.category)) }]));
      const cardMeta = (cardId) => cardMap.get(String(cardId)) || { cardId, title: String(cardId || ''), category: inferCategory(cardId), categoryLabel: categoryLabel(inferCategory(cardId)) };

      const [inquiryRows] = await pool.query(
        `SELECT r.id, r.user_id AS userId, u.username, u.gender, u.group_id AS groupId, r.record_order AS recordOrder,
                r.orientation_created_at AS orientationCreatedAt, r.investigation_created_at AS investigationCreatedAt,
                r.conclusion_created_at AS conclusionCreatedAt, r.conclusion_text AS conclusionText,
                r.started_at AS startedAt, r.ended_at AS endedAt, r.created_at AS createdAt, r.updated_at AS updatedAt
         FROM inquiry_records r
         JOIN users u ON u.id = r.user_id
         ORDER BY u.group_id, u.username, r.record_order, r.id`,
      );
      const recordIds = inquiryRows.map((row) => Number(row.id));

      const [recordCardRows] = recordIds.length
        ? await pool.query(
            `SELECT r.user_id AS userId, c.inquiry_record_id AS inquiryRecordId, c.card_id AS cardId, c.card_order AS cardOrder,
                    c.unlocked_at AS unlockedAt, c.is_evidence AS isEvidence, c.evidence_order AS evidenceOrder,
                    c.evidence_selected_at AS evidenceSelectedAt, c.created_at AS createdAt
             FROM inquiry_record_cards c
             JOIN inquiry_records r ON r.id = c.inquiry_record_id
             WHERE c.inquiry_record_id IN (?)
             ORDER BY c.inquiry_record_id, c.card_order`,
            [recordIds],
          )
        : [[]];

      const [noteRows] = recordIds.length
        ? await pool.query(
            `SELECT n.id, r.user_id AS userId, n.inquiry_record_id AS inquiryRecordId, n.note_key AS noteKey, n.note_text AS noteText, n.created_at AS createdAt
             FROM inquiry_collection_notes n
             JOIN inquiry_records r ON r.id = n.inquiry_record_id
             WHERE n.inquiry_record_id IN (?)
             ORDER BY n.inquiry_record_id, n.created_at, n.id`,
            [recordIds],
          )
        : [[]];

      const [orientationRows] = recordIds.length
        ? await pool.query(
            `SELECT o.id, r.user_id AS userId, o.inquiry_record_id AS inquiryRecordId, o.response_order AS responseOrder,
                    o.response_type AS responseType, o.answer_order AS answerOrder, o.answer_text AS answerText, o.created_at AS createdAt
             FROM inquiry_orientation_responses o
             JOIN inquiry_records r ON r.id = o.inquiry_record_id
             WHERE o.inquiry_record_id IN (?)
             ORDER BY o.inquiry_record_id, o.response_order, o.answer_order`,
            [recordIds],
          )
        : [[]];

      const [unlockedRows] = await pool.query(
        `SELECT u.id AS userId, u.username, u.gender, u.group_id AS groupId, c.card_id AS cardId, c.unlocked_at AS unlockedAt, c.updated_at AS updatedAt
         FROM student_unlocked_cards c
         JOIN users u ON u.id = c.user_id
         ORDER BY u.group_id, u.username, c.unlocked_at`,
      );

      const [aiRows] = await pool.query(
        `SELECT a.id, a.user_id AS userId, u.username, u.gender, u.group_id AS groupId, a.round_key AS roundKey, a.scope,
                a.need_type AS needType, a.help_category AS helpCategory, a.action_type AS actionType,
                a.request_text AS requestText, a.response_text AS responseText, a.created_at AS createdAt
         FROM ai_helper_records a
         JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at, a.id`,
      );

      const [rewardRows] = await pool.query(
        `SELECT r.user_id AS userId, u.username, u.gender, u.group_id AS groupId, r.reward_type AS rewardType, r.reward_key AS rewardKey, r.earned_at AS earnedAt
         FROM student_rewards r
         JOIN users u ON u.id = r.user_id
         ORDER BY r.earned_at`,
      );

      const [mapRows] = await pool.query(
        `SELECT m.id, m.scope, m.owner_id AS ownerId, m.user_id AS userId, u.username, u.gender, COALESCE(m.group_id, u.group_id) AS groupId,
                m.district_name AS districtName, m.choice, m.created_at AS createdAt, m.updated_at AS updatedAt
         FROM map_choices m
         LEFT JOIN users u ON u.id = m.user_id
         ORDER BY m.scope, COALESCE(m.group_id, u.group_id), u.username, m.district_name`,
      );

      const [decisionRows] = await pool.query(
        `SELECT round_no AS roundNo, group_id AS groupId, card_id AS cardId, core_card AS coreCard,
                agree_count AS agreeCount, reject_count AS rejectCount, keep_count AS keepCount, result, reason, settled_at AS settledAt
         FROM decisioncard_round_results
         ORDER BY round_no, group_id, card_id`,
      );

      const [decisionLogRows] = await pool.query(
        `SELECT id, group_id AS groupId, action_type AS actionType, round_no AS roundNo, selected_card_id_1 AS selectedCardId1,
                selected_card_id_2 AS selectedCardId2, selected_card_id_3 AS selectedCardId3, core_card_id AS coreCardId,
                locked_by_user_id AS lockedByUserId, lock_reason AS lockReason, locked_at AS lockedAt, created_at AS createdAt
         FROM decisioncard_logs
         ORDER BY round_no, created_at, id`,
      );

      const cardsByRecord = new Map();
      for (const row of recordCardRows) {
        const list = cardsByRecord.get(Number(row.inquiryRecordId)) || [];
        const meta = cardMeta(row.cardId);
        list.push({ ...row, cardId: String(row.cardId), title: meta.title, category: meta.category, categoryLabel: meta.categoryLabel, isEvidence: Boolean(row.isEvidence) });
        cardsByRecord.set(Number(row.inquiryRecordId), list);
      }
      const notesByRecord = new Map();
      for (const row of noteRows) {
        const list = notesByRecord.get(Number(row.inquiryRecordId)) || [];
        list.push(row);
        notesByRecord.set(Number(row.inquiryRecordId), list);
      }
      const orientationsByRecord = new Map();
      for (const row of orientationRows) {
        const list = orientationsByRecord.get(Number(row.inquiryRecordId)) || [];
        list.push(row);
        orientationsByRecord.set(Number(row.inquiryRecordId), list);
      }

      const inquiryRecords = inquiryRows.map((row) => {
        const cards = cardsByRecord.get(Number(row.id)) || [];
        const evidenceCards = cards.filter((card) => card.isEvidence);
        const notes = notesByRecord.get(Number(row.id)) || [];
        const orientations = orientationsByRecord.get(Number(row.id)) || [];
        const completed = Boolean(row.conclusionText || evidenceCards.length > 0 || row.conclusionCreatedAt || row.endedAt);
        const metric = metricsByUser.get(Number(row.userId));
        if (metric) {
          metric.inquiryCount += 1;
          if (completed) metric.completedInquiryCount += 1;
          metric.inquiryCardCount += unique(cards.map((card) => card.cardId)).length;
          metric.evidenceCardCount += unique(evidenceCards.map((card) => card.cardId)).length;
          metric.noteCount += notes.length;
        }
        return {
          inquiryRecordId: Number(row.id),
          userId: Number(row.userId),
          username: row.username,
          gender: row.gender,
          genderLabel: genderLabel(row.gender),
          groupId: row.groupId || 'unassigned',
          groupName: mapGroupName(row.groupId || 'unassigned'),
          recordOrder: Number(row.recordOrder || 0),
          recordLabel: roundLabel(row.recordOrder),
          purpose: orientations.map((item) => item.answerText).filter(Boolean).join(' / '),
          direction: orientations.filter((item) => String(item.responseType || '').includes('direction')).map((item) => item.answerText).join(' / '),
          orientationResponses: orientations,
          usedCards: cards,
          evidenceCards,
          notes,
          conclusionText: row.conclusionText || '',
          completed,
          startedAt: row.startedAt || row.createdAt || null,
          completedAt: row.endedAt || row.conclusionCreatedAt || null,
          updatedAt: row.updatedAt || null,
        };
      });

      const seenUnlocks = new Map();
      for (const row of unlockedRows) {
        const key = Number(row.userId);
        const set = seenUnlocks.get(key) || new Set();
        set.add(String(row.cardId));
        seenUnlocks.set(key, set);
      }
      for (const [userId, set] of seenUnlocks.entries()) {
        const metric = metricsByUser.get(userId);
        if (metric) metric.unlockedCardCount = set.size;
      }
      for (const row of aiRows) {
        const metric = metricsByUser.get(Number(row.userId));
        if (metric) metric.aiUseCount += 1;
      }
      for (const row of rewardRows) {
        const metric = metricsByUser.get(Number(row.userId));
        if (metric) metric.rewardCount += 1;
      }
      for (const row of mapRows) {
        if (row.scope === 'personal') {
          const metric = metricsByUser.get(Number(row.userId));
          if (metric) metric.mapChoiceCount += 1;
        }
      }
      for (const row of decisionLogRows) {
        const selected = [row.selectedCardId1, row.selectedCardId2, row.selectedCardId3].filter(Boolean).length;
        if (selected > 0) {
          const groupStudents = students.filter((student) => student.groupId === row.groupId);
          groupStudents.forEach((student) => {
            const metric = metricsByUser.get(student.userId);
            if (metric) metric.decisionProposalCount += selected;
          });
        }
      }

      const studentMetrics = [...metricsByUser.values()];
      const classSummary = summaryFor(studentMetrics);

      const cardCategoryCounts = { land: 0, water: 0, leopard: 0, population: 0, other: 0 };
      for (const row of unlockedRows) {
        const meta = cardMeta(row.cardId);
        const key = ['land', 'water', 'leopard', 'population'].includes(meta.category) ? meta.category : 'other';
        cardCategoryCounts[key] += 1;
      }
      const aiTypeCounts = aiRows.reduce((acc, row) => {
        const key = row.helpCategory || row.needType || row.actionType || '未分類';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const mapChoiceCounts = mapRows.reduce((acc, row) => {
        if (!acc[row.scope]) acc[row.scope] = { conservation: 0, development: 0, unknown: 0, total: 0 };
        if (row.choice === '保育') acc[row.scope].conservation += 1;
        else if (row.choice === '開發') acc[row.scope].development += 1;
        else acc[row.scope].unknown += 1;
        acc[row.scope].total += 1;
        return acc;
      }, {});
      const proposalCount = decisionRows.length;
      const acceptedCount = decisionRows.filter((row) => row.result === 'accepted').length;

      const genderAnalysis = ['all', 'male', 'female'].map((gender) => {
        const rows = gender === 'all' ? studentMetrics : studentMetrics.filter((row) => row.gender === gender);
        return { gender, label: gender === 'all' ? '全部' : genderLabel(gender), ...summaryFor(rows) };
      });

      const groupMap = new Map();
      for (const student of studentMetrics) {
        const group = groupMap.get(student.groupId) || { groupId: student.groupId, groupName: student.groupName, students: [] };
        group.students.push(student);
        groupMap.set(student.groupId, group);
      }
      const groupAnalysis = [...groupMap.values()].map((group) => ({
        groupId: group.groupId,
        groupName: group.groupName,
        studentCount: group.students.length,
        ...summaryFor(group.students),
      })).sort((a, b) => String(a.groupId).localeCompare(String(b.groupId)));

      const classAnalytics = {
        inquiryStatistics: {
          averageInquiryCount: classSummary.averageInquiryCount,
          averageUnlockedCardCount: classSummary.averageUnlockedCardCount,
          averageEvidenceCardCount: classSummary.averageEvidenceCardCount,
          averageNoteCount: classSummary.averageNoteCount,
        },
        dataCardStatistics: {
          averageUnlockedCount: classSummary.averageUnlockedCardCount,
          byCategory: Object.entries(cardCategoryCounts).map(([category, count]) => ({ category, label: categoryLabel(category), count, ratio: percent(count, unlockedRows.length) })),
        },
        aiStatistics: {
          userCount: classSummary.aiUserCount,
          totalCount: classSummary.totalAiUseCount,
          averageUseCount: classSummary.averageAiUseCount,
          typeRatio: Object.entries(aiTypeCounts).map(([type, count]) => ({ type, count, ratio: percent(count, aiRows.length) })),
        },
        mapStatistics: Object.entries(mapChoiceCounts).map(([scope, counts]) => ({
          scope,
          total: counts.total,
          conservationRatio: percent(counts.conservation, counts.total),
          developmentRatio: percent(counts.development, counts.total),
          unknownRatio: percent(counts.unknown, counts.total),
        })),
        decisionCardStatistics: {
          proposalCount,
          acceptedCount,
          acceptanceRate: percent(acceptedCount, proposalCount),
        },
      };

      const dataCardRecords = unlockedRows.map((row) => {
        const meta = cardMeta(row.cardId);
        const usedInInquiry = recordCardRows.some((card) => Number(card.userId) === Number(row.userId) && String(card.cardId) === String(row.cardId));
        const usedAsEvidence = recordCardRows.some((card) => Number(card.userId) === Number(row.userId) && String(card.cardId) === String(row.cardId) && Boolean(card.isEvidence));
        return {
          userId: Number(row.userId), username: row.username, gender: row.gender, genderLabel: genderLabel(row.gender), groupId: row.groupId || 'unassigned', groupName: mapGroupName(row.groupId || 'unassigned'),
          cardId: String(row.cardId), title: meta.title, category: meta.category, categoryLabel: meta.categoryLabel, unlockedAt: row.unlockedAt, usedInInquiry, usedAsEvidence,
        };
      });

      const rawStudentRecords = students.map((student) => ({
        profile: student,
        inquiries: inquiryRecords.filter((record) => record.userId === student.userId),
        dataCards: dataCardRecords.filter((record) => record.userId === student.userId),
        aiRecords: aiRows.filter((row) => Number(row.userId) === student.userId),
        rewards: rewardRows.filter((row) => Number(row.userId) === student.userId),
        mapChoices: mapRows.filter((row) => Number(row.userId) === student.userId || (row.scope !== 'personal' && row.groupId === student.groupId)),
      }));

      const exports = {
        studentMetricsCsv: toCsv(studentMetrics, [
          { header: '學生', value: 'username' }, { header: '性別', value: 'genderLabel' }, { header: '組別', value: 'groupName' },
          { header: '探究書數', value: 'inquiryCount' }, { header: '解鎖卡數', value: 'unlockedCardCount' }, { header: '證據卡數', value: 'evidenceCardCount' },
          { header: 'AI使用次數', value: 'aiUseCount' }, { header: '稱號數', value: 'rewardCount' },
        ]),
        inquiryCsv: toCsv(inquiryRecords, [
          { header: '學生', value: 'username' }, { header: '性別', value: 'genderLabel' }, { header: '組別', value: 'groupName' }, { header: '探究書', value: 'recordLabel' },
          { header: '探究目的/前導回應', value: 'purpose' }, { header: '使用資料卡數', value: (r) => r.usedCards.length }, { header: '證據卡數', value: (r) => r.evidenceCards.length },
          { header: '筆記數', value: (r) => r.notes.length }, { header: '結論內容', value: 'conclusionText' }, { header: '完成時間', value: 'completedAt' },
        ]),
        aiCsv: toCsv(aiRows, [
          { header: '學生', value: 'username' }, { header: '性別', value: (r) => genderLabel(r.gender) }, { header: '組別', value: (r) => mapGroupName(r.groupId || 'unassigned') },
          { header: '時間', value: 'createdAt' }, { header: 'AI類型', value: (r) => r.helpCategory || r.needType || r.actionType }, { header: '使用者輸入', value: 'requestText' }, { header: 'AI回覆', value: 'responseText' },
        ]),
        mapCsv: toCsv(mapRows, [
          { header: '學生', value: 'username' }, { header: '性別', value: (r) => genderLabel(r.gender) }, { header: '組別', value: (r) => mapGroupName(r.groupId || 'unassigned') },
          { header: '範圍', value: 'scope' }, { header: '地區', value: 'districtName' }, { header: '選擇結果', value: 'choice' }, { header: '更新時間', value: 'updatedAt' },
        ]),
        decisionCardCsv: toCsv(decisionRows, [
          { header: '組別', value: (r) => mapGroupName(r.groupId) }, { header: '輪次', value: 'roundNo' }, { header: '提案', value: 'cardId' }, { header: '理由', value: 'reason' },
          { header: '同意票', value: 'agreeCount' }, { header: '反對票', value: 'rejectCount' }, { header: '保留票', value: 'keepCount' }, { header: '通過結果', value: 'result' },
        ]),
      };

      res.json({
        generatedAt: new Date().toISOString(),
        philosophy: {
          purpose: '事後研究分析工具',
          note: '本頁只整理原始資料與描述性統計，不自動評分探究品質、不判斷學習成效、不產生研究結論。',
        },
        filters: {
          genders: [{ id: 'all', label: '全部' }, { id: 'male', label: '男' }, { id: 'female', label: '女' }],
          groups: [{ id: 'all', label: '全部組別' }, ...groupAnalysis.map((g) => ({ id: g.groupId, label: g.groupName }))],
          students: students.map((s) => ({ id: s.userId, label: `${s.username}｜${s.groupName}｜${s.genderLabel}` })),
        },
        overview: {
          totalStudents: students.length,
          totalInquiryRecords: inquiryRecords.length,
          totalUnlockedCards: unlockedRows.length,
          totalEvidenceCards: recordCardRows.filter((row) => Boolean(row.isEvidence)).length,
          totalAiRecords: aiRows.length,
          totalRewards: rewardRows.length,
          totalMapChoices: mapRows.length,
          totalDecisionCards: decisionRows.length,
        },
        classAnalytics,
        studentMetrics,
        genderAnalysis,
        groupAnalysis,
        rawStudentRecords,
        exports,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '讀取教師端事後研究分析資料失敗' });
    }
  }

  return { getResearchAnalytics };
}

module.exports = { createTeacherResearchAnalyticsService };
