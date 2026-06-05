export type Gender = 'all' | 'male' | 'female' | string;

export type ResearchFilterState = {
  gender: Gender;
  groupId: string;
  studentId: string;
};

export type StudentMetric = {
  userId: number;
  username: string;
  gender: string | null;
  genderLabel: string;
  groupId: string;
  groupName: string;
  isGroupLeader: boolean;
  inquiryCount: number;
  completedInquiryCount: number;
  unlockedCardCount: number;
  inquiryCardCount: number;
  evidenceCardCount: number;
  noteCount: number;
  aiUseCount: number;
  rewardCount: number;
  mapChoiceCount: number;
  decisionProposalCount: number;
};

export type SummaryRow = {
  label: string;
  studentCount: number;
  averageInquiryCount: number;
  averageUnlockedCardCount: number;
  averageEvidenceCardCount: number;
  averageNoteCount: number;
  aiUserCount: number;
  totalAiUseCount: number;
  averageAiUseCount: number;
  averageRewardCount: number;
  groupId?: string;
  gender?: string;
  groupName?: string;
};

export type RawStudentRecord = {
  profile: {
    userId: number;
    username: string;
    gender: string | null;
    genderLabel: string;
    groupId: string;
    groupName: string;
    isGroupLeader: boolean;
  };
  inquiries: Array<any>;
  dataCards: Array<any>;
  aiRecords: Array<any>;
  rewards: Array<any>;
  mapChoices: Array<any>;
};

export type ResearchAnalyticsPayload = {
  generatedAt: string;
  philosophy: { purpose: string; note: string };
  filters: {
    genders: Array<{ id: string; label: string }>;
    groups: Array<{ id: string; label: string }>;
    students: Array<{ id: number; label: string }>;
  };
  overview: Record<string, number>;
  classAnalytics: {
    inquiryStatistics: Record<string, number>;
    dataCardStatistics: { averageUnlockedCount: number; byCategory: Array<{ category: string; label: string; count: number; ratio: number }> };
    aiStatistics: { userCount: number; totalCount: number; averageUseCount: number; typeRatio: Array<{ type: string; count: number; ratio: number }> };
    mapStatistics: Array<{ scope: string; total: number; conservationRatio: number; developmentRatio: number; unknownRatio: number }>;
    decisionCardStatistics: { proposalCount: number; acceptedCount: number; acceptanceRate: number };
  };
  studentMetrics: StudentMetric[];
  genderAnalysis: SummaryRow[];
  groupAnalysis: SummaryRow[];
  rawStudentRecords: RawStudentRecord[];
  exports: Record<string, string>;
};
