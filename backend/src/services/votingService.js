/**
 * CityAuncel maintainability notes
 * 檔案用途：後端投票與最終決策結算 service，負責嫌犯排序投票狀態、決策卡分數與結局資料組裝。
 * 維護重點：此檔不處理 Express req/res，只回傳 route 可直接使用的資料。
 */

const DECISION_CARD_SCORE_BY_GROUP = {
  environment: {
    1: { stance: "利己", score: 2, title: "強制劃設核心保育區" },
    2: { stance: "利己", score: 2, title: "擴張石虎保護範圍" },
    3: { stance: "利己", score: 2, title: "禁止棲地開發行動" },
    4: { stance: "利他", score: -2, title: "讓出低風險保育區" },
    5: { stance: "利他", score: -2, title: "縮減次要保護範圍" },
    6: { stance: "利他", score: -2, title: "承擔棲地調查成本" },
    7: { stance: "中立", score: 0, title: "協調開發緩衝區" },
    8: { stance: "中立", score: 0, title: "聯合巡查棲地熱區" },
    9: { stance: "中立", score: 0, title: "評估棲地破碎風險" },
  },
  government: {
    1: { stance: "利己", score: 2, title: "劃設開發專區" },
    2: { stance: "利己", score: 2, title: "加速道路建設" },
    3: { stance: "利己", score: 2, title: "擴大建設用地" },
    4: { stance: "利他", score: -2, title: "放棄高收益開發區" },
    5: { stance: "利他", score: -2, title: "縮減建設用地面積" },
    6: { stance: "利他", score: -2, title: "延後道路開發時程" },
    7: { stance: "中立", score: 0, title: "協調避開棲地開發" },
    8: { stance: "中立", score: 0, title: "共議土地使用方案" },
    9: { stance: "中立", score: 0, title: "整合分階段方案" },
  },
  farming: {
    1: { stance: "利己", score: 2, title: "擴張農地生產" },
    2: { stance: "利己", score: 2, title: "維護農民耕作權" },
    3: { stance: "利己", score: 2, title: "爭取農民補助" },
    4: { stance: "利他", score: -2, title: "讓出部分農地作棲地" },
    5: { stance: "利他", score: -2, title: "承擔友善農法成本" },
    6: { stance: "利他", score: -2, title: "承擔犬隻管理成本" },
    7: { stance: "中立", score: 0, title: "合作推動友善農法" },
    8: { stance: "中立", score: 0, title: "平衡生計與保育方案" },
    9: { stance: "中立", score: 0, title: "整合友善農業區" },
  },
  animal: {
    1: { stance: "利己", score: 2, title: "強化犬貓管制" },
    2: { stance: "利己", score: 2, title: "禁止犬貓放養" },
    3: { stance: "利己", score: 2, title: "集中管制高風險犬群" },
    4: { stance: "利他", score: -2, title: "承擔犬貓收容成本" },
    5: { stance: "利他", score: -2, title: "延後強制管制行動" },
    6: { stance: "利他", score: -2, title: "免費協助農民改善犬隻管理" },
    7: { stance: "中立", score: 0, title: "聯合巡查犬貓熱區" },
    8: { stance: "中立", score: 0, title: "協調犬貓共管區" },
    9: { stance: "中立", score: 0, title: "推動社區共管機制" },
  },
  greenEnergy: {
    1: { stance: "利己", score: 2, title: "優先開發科技園區" },
    2: { stance: "利己", score: 2, title: "擴張能源設施" },
    3: { stance: "利己", score: 2, title: "爭取企業進駐" },
    4: { stance: "利他", score: -2, title: "放棄高收益開發地" },
    5: { stance: "利他", score: -2, title: "縮小科技園區規模" },
    6: { stance: "利他", score: -2, title: "承擔地方補償成本" },
    7: { stance: "中立", score: 0, title: "協調低衝擊選址" },
    8: { stance: "中立", score: 0, title: "配合調整開發設計" },
    9: { stance: "中立", score: 0, title: "共創低衝擊示範區" },
  },
  education: {
    1: { stance: "利己", score: 2, title: "主導公眾倡議" },
    2: { stance: "利己", score: 2, title: "掌控議題討論" },
    3: { stance: "利己", score: 2, title: "擴大教育活動" },
    4: { stance: "利他", score: -2, title: "承擔居民反彈壓力" },
    5: { stance: "利他", score: -2, title: "讓出宣導資源支援他局" },
    6: { stance: "利他", score: -2, title: "承接互動問題溝通任務" },
    7: { stance: "中立", score: 0, title: "聯合辦理政策說明" },
    8: { stance: "中立", score: 0, title: "整合居民共識意見" },
    9: { stance: "中立", score: 0, title: "建立溝通平台" },
  },
};

const FINAL_OUTCOMES = {
  sustainable: {
    id: "sustainable",
    title: "共榮",
    subtitle: "保育與發展形成可以共同前進的局面",
  },
  partial: {
    id: "partial",
    title: "部分共榮",
    subtitle: "保育行動明顯領先，部分地區逐漸改善，但仍需要持續協調發展需求",
  },
  crisis: {
    id: "crisis",
    title: "平衡危機",
    subtitle: "開發行動明顯領先，淺山系統開始面臨新的平衡挑戰",
  },
};

const CONSERVATION_CAMP_GROUP_IDS = new Set(["environment", "animal", "education"]);
const DEVELOPMENT_CAMP_GROUP_IDS = new Set(["government", "greenEnergy", "farming"]);
const FINAL_OUTCOME_POINT_PER_ACCEPTED_CARD = 2;
const FINAL_OUTCOME_BALANCE_THRESHOLD = 7;

function resolveDecisionCamp(groupId) {
  if (CONSERVATION_CAMP_GROUP_IDS.has(groupId)) return "conservation";
  if (DEVELOPMENT_CAMP_GROUP_IDS.has(groupId)) return "development";
  return "neutral";
}

function parseDecisionCardInfo(cardId) {
  const match = String(cardId || "").match(/^([a-zA-Z]+)-pack-(\d+)$/);
  if (!match) return null;
  const groupId = match[1];
  const cardNumber = Number(match[2]);
  const meta = DECISION_CARD_SCORE_BY_GROUP[groupId]?.[cardNumber];
  if (!meta) return null;
  return { groupId, cardNumber, cardId: String(cardId), ...meta };
}

function resolveFinalOutcomeByCampBalance(conservationScore, developmentScore) {
  const scoreGap = Number(conservationScore || 0) - Number(developmentScore || 0);
  if (Math.abs(scoreGap) <= FINAL_OUTCOME_BALANCE_THRESHOLD) {
    return FINAL_OUTCOMES.sustainable;
  }
  if (scoreGap > FINAL_OUTCOME_BALANCE_THRESHOLD) {
    return FINAL_OUTCOMES.partial;
  }
  return FINAL_OUTCOMES.crisis;
}


const SUSPECT_ROLES = [
  { id: "public", name: "一般民眾", description: "為了生活、通勤、旅遊或送貨而使用道路的人，可能讓石虎移動時遇到更多風險。" },
  { id: "developer", name: "建商/企業", description: "推動土地開發、建設或產業使用的角色，可能改變石虎原本的生活空間。" },
  { id: "resident", name: "當地居民", description: "和石虎住在同一片淺山的人，可能因家禽損失或生活不安與石虎產生互動問題。" },
  { id: "farmer", name: "農民", description: "管理農地與作物的人，藥劑、毒鼠藥或陷阱可能造成看不見的環境傷害。" },
  { id: "authority", name: "地方主管機關", description: "負責道路、土地規劃、保育政策與管理的單位，規劃若忽略石虎需求，生存挑戰可能持續累積。" },
  { id: "media", name: "媒體", description: "傳播消息並影響大眾看法的角色，未查證或放大互動問題的報導可能讓石虎被誤解。" },
];
const SUSPECT_ROLE_IDS = new Set(SUSPECT_ROLES.map((role) => role.id));
const SUSPECT_ROLE_MAP = new Map(SUSPECT_ROLES.map((role) => [role.id, role]));

function mapSuspectRoleName(roleId) {
  return SUSPECT_ROLE_MAP.get(roleId)?.name || roleId;
}


function createVotingService({
  pool,
  parseJSON,
  mapGroupName,
  getGameSetting,
  setGameSetting,
  tableExists,
  tableHasColumn,
  ensureDecisioncardsTable,
  getAllDecisioncards,
  getAcceptedDecisioncards,
}) {
  async function ensureSuspectVotesTable() {
    const hasLegacyGroupId = await tableHasColumn("suspect_votes", "group_id");
    const hasRoleId = await tableHasColumn("suspect_votes", "role_id");
    const hasRankPosition = await tableHasColumn("suspect_votes", "rank_position");

    // 這次投票改為「六個角色排序」。舊版 suspect_votes 是複選小組投票，
    // 結構與資料語意不同，直接重建可避免舊票影響新一輪排序結果。
    if (hasLegacyGroupId || (await tableExists("suspect_votes")) && (!hasRoleId || !hasRankPosition)) {
      await pool.query("DROP TABLE IF EXISTS suspect_votes");
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS suspect_votes (
        user_id INT NOT NULL,
        role_id VARCHAR(50) NOT NULL,
        rank_position INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id),
        UNIQUE KEY uniq_suspect_votes_user_rank (user_id, rank_position),
        KEY idx_suspect_votes_role_rank (role_id, rank_position),
        CONSTRAINT fk_suspect_votes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='學生嫌犯排序投票紀錄：role_id 代表被排序的角色，rank_position 代表由最相關到最不相關的排序。'`,
    );
  }

  function resolveSuspectVotingWinners(totals = {}) {
    const entries = SUSPECT_ROLES.map((role) => ({
      roleId: role.id,
      roleName: role.name,
      // 保留舊欄位名稱，避免舊前端在更新期間讀不到。
      groupId: role.id,
      groupName: role.name,
      count: Number(totals[role.id]) || 0,
    }));
    const maxCount = Math.max(0, ...entries.map((entry) => entry.count));
    if (maxCount <= 0) return [];
    return entries.filter((entry) => entry.count === maxCount);
  }

  async function buildSuspectVotingPayload(userId = null) {
    await ensureSuspectVotesTable();
    const status = await getGameSetting("suspect_voting_status", {
      isOpen: false,
      isFinalized: false,
      finalizedSuspects: [],
      finalizedAt: null,
    });

    const [totalRows] = await pool.query(
      `SELECT role_id AS roleId, COUNT(*) AS count
       FROM suspect_votes
       WHERE rank_position = 1
       GROUP BY role_id`,
    );

    const totals = Object.fromEntries(SUSPECT_ROLES.map((role) => [role.id, 0]));
    totalRows.forEach((row) => {
      totals[row.roleId] = Number(row.count) || 0;
    });

    const [[voterRow]] = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS totalVoters FROM suspect_votes",
    );

    const [[eligibleRow]] = await pool.query(
      `SELECT COUNT(*) AS totalEligibleVoters
       FROM users
       WHERE COALESCE(role, 'student') = 'student'`,
    );

    let myVotes = [];
    if (userId) {
      const [myRows] = await pool.query(
        `SELECT role_id AS roleId, rank_position AS rankPosition
         FROM suspect_votes
         WHERE user_id = ?
         ORDER BY rank_position ASC`,
        [userId],
      );
      myVotes = myRows.map((row) => row.roleId);
    }

    const savedFinalizedSuspects = Array.isArray(status.finalizedSuspects)
      ? status.finalizedSuspects
          .map((suspect) => {
            const roleId = String(suspect.roleId || suspect.groupId || "");
            if (!SUSPECT_ROLE_IDS.has(roleId)) return null;
            return {
              roleId,
              roleName: mapSuspectRoleName(roleId),
              groupId: roleId,
              groupName: mapSuspectRoleName(roleId),
              count: Number(suspect.count) || Number(totals[roleId]) || 0,
            };
          })
          .filter(Boolean)
      : [];

    const finalizedSuspects =
      savedFinalizedSuspects.length > 0
        ? savedFinalizedSuspects
        : Boolean(status.isFinalized)
          ? resolveSuspectVotingWinners(totals)
          : [];

    return {
      isOpen: Boolean(status.isOpen),
      isFinalized: Boolean(status.isFinalized),
      finalizedSuspects,
      finalizedAt: status.finalizedAt || null,
      totals,
      totalVoters: Number(voterRow?.totalVoters) || 0,
      totalEligibleVoters: Number(eligibleRow?.totalEligibleVoters) || 0,
      myVotes,
      myRanking: myVotes,
      myTopRoleId: myVotes[0] || null,
      roles: SUSPECT_ROLES,
    };
  }

  async function buildFinalDecisionSettlement() {
    const saved = await getGameSetting("final_decision_settlement", { isFinalized: false });
    if (saved?.isFinalized) return saved;
    return { isFinalized: false };
  }

  async function calculateFinalDecisionSettlement(finalizedByUserId = null) {
    await ensureDecisioncardsTable();

    // 最終決策結局分只計算「決策區」中已通過的牌。
    // 沒有通過牌時，不回頭計算各組目前選的三張牌，避免未通過提案影響結局。
    const rows = typeof getAcceptedDecisioncards === "function"
      ? await getAcceptedDecisioncards()
      : [];

    const groupMap = new Map();
    const campBreakdown = {
      conservation: { camp: "conservation", count: 0, score: 0, cards: [] },
      development: { camp: "development", count: 0, score: 0, cards: [] },
      neutral: { camp: "neutral", count: 0, score: 0, cards: [] },
    };

    for (const row of rows) {
      const card = parseDecisionCardInfo(row.cardId);
      if (!card) continue;

      // 結局分數只看「牌本身所屬的局」，不看哪一組送出或投票結果細節。
      const groupId = card.groupId;
      const camp = resolveDecisionCamp(groupId);
      const outcomeScore = camp === "neutral" ? 0 : FINAL_OUTCOME_POINT_PER_ACCEPTED_CARD;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          groupName: mapGroupName(groupId),
          selectedCardIds: [],
          cards: [],
          score: 0,
        });
      }

      const group = groupMap.get(groupId);
      group.selectedCardIds.push(card.cardId);
      group.cards.push({
        cardId: card.cardId,
        title: card.title,
        // 保留舊欄位給既有前端型別相容；學生端不顯示這些後台計算欄位。
        stance: card.stance,
        score: outcomeScore,
        roundNo: row.roundNo || 1,
      });
      group.score += outcomeScore;

      const bucket = campBreakdown[camp] || campBreakdown.neutral;
      bucket.count += 1;
      bucket.score += outcomeScore;
      bucket.cards.push({
        groupId,
        groupName: mapGroupName(groupId),
        cardId: card.cardId,
        title: card.title,
        roundNo: row.roundNo || 1,
        score: outcomeScore,
      });
    }

    const groups = Array.from(groupMap.values());
    const conservationScore = campBreakdown.conservation.score;
    const developmentScore = campBreakdown.development.score;
    const scoreGap = conservationScore - developmentScore;
    const totalScore = scoreGap;
    const outcome = resolveFinalOutcomeByCampBalance(conservationScore, developmentScore);

    return {
      isFinalized: true,
      finalizedAt: new Date().toISOString(),
      finalizedBy: finalizedByUserId,
      scoreSource: "accepted_decision_cards_camp_balance_only",
      totalAcceptedCards: rows.length,
      totalScore,
      conservationScore,
      developmentScore,
      scoreGap,
      campBreakdown,
      outcome,
      groups,
    };
  }

  return {
    buildFinalDecisionSettlement,
    buildSuspectVotingPayload,
    calculateFinalDecisionSettlement,
    ensureSuspectVotesTable,
    resolveSuspectVotingWinners,
  };
}

module.exports = {
  createVotingService,
  SUSPECT_ROLES,
  SUSPECT_ROLE_IDS,
};
