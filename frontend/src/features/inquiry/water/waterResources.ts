export const MIAOLI_TOWNS = [
  "苗栗市",
  "頭份市",
  "竹南鎮",
  "後龍鎮",
  "通霄鎮",
  "苑裡鎮",
  "卓蘭鎮",
  "大湖鄉",
  "公館鄉",
  "銅鑼鄉",
  "南庄鄉",
  "頭屋鄉",
  "三義鄉",
  "西湖鄉",
  "造橋鄉",
  "三灣鄉",
  "獅潭鄉",
  "泰安鄉",
];

export const ALL_TOWNS_LABEL = "全地區";
export const INTERACTIVE_TOWN_OPTIONS = [ALL_TOWNS_LABEL, ...MIAOLI_TOWNS];
export const LATEST_WATER_DATA_MONTH = "2025/12";


export function buildRecentMonthLabels(latestMonth: string, count = 12) {
  const [yearText, monthText] = latestMonth.split("/");
  const latestYear = Number(yearText);
  const latestMonthNumber = Number(monthText);
  if (!Number.isFinite(latestYear) || !Number.isFinite(latestMonthNumber)) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(latestYear, latestMonthNumber - count + index, 1);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export const RECENT_WATER_MONTH_LABELS = buildRecentMonthLabels(
  LATEST_WATER_DATA_MONTH,
);

export const ALL_WATER_TOWNS_LABEL = ALL_TOWNS_LABEL;

export type WaterTownMonthlyRecord = {
  town: string;
  month: string;
  rainfall: number;
  stationCount: number;
  stationCodes: string[];
  stationNames: string[];
  rawStationValues: string;
  processedMethod: string;
  dataStatus: string;
};

export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

export function parseCsvRecords(csvText: string) {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [] as Record<string, string>[];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
  });
}

export function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeStationMonth(month: string) {
  return month.replace("-", "/");
}

export function formatMonthOnlyLabel(monthLabel: string) {
  const monthText = monthLabel.includes("/")
    ? monthLabel.split("/")[1]
    : monthLabel.includes("-")
      ? monthLabel.split("-")[1]
      : monthLabel;
  const monthNumber = Number(monthText);
  return Number.isFinite(monthNumber) ? `${monthNumber}月` : monthLabel;
}

export function splitStationList(value: string) {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseWaterTownMonthlyCsv(csvText: string): WaterTownMonthlyRecord[] {
  return parseCsvRecords(csvText)
    .map((record): WaterTownMonthlyRecord | null => {
      const town = record.town?.trim() ?? "";
      const rainfall = toFiniteNumber(record.processed_value);
      if (!town || rainfall === null) return null;

      return {
        town,
        month: normalizeStationMonth(record.month?.trim() ?? ""),
        rainfall,
        stationCount: toFiniteNumber(record.source_station_count) ?? 0,
        stationCodes: splitStationList(record.source_station_codes ?? ""),
        stationNames: splitStationList(record.source_station_names ?? ""),
        rawStationValues: record.raw_station_values_mm?.trim() ?? "",
        processedMethod: record.processed_method?.trim() ?? "",
        dataStatus: record.data_status?.trim() ?? "",
      };
    })
    .filter((record): record is WaterTownMonthlyRecord => record !== null);
}

export function formatRainfallAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function getWaterTownRecordsForMonth(
  records: WaterTownMonthlyRecord[],
  monthLabel: string,
) {
  return records.filter((record) => record.month === monthLabel);
}

export function getRainfallValueForTownSelection(
  records: WaterTownMonthlyRecord[],
  selectedName: string,
  monthLabel: string,
) {
  const monthRecords = getWaterTownRecordsForMonth(records, monthLabel);
  if (monthRecords.length === 0) return 0;

  if (selectedName === ALL_WATER_TOWNS_LABEL) {
    return Math.round(
      monthRecords.reduce((sum, record) => sum + record.rainfall, 0) /
        Math.max(monthRecords.length, 1),
    );
  }

  const target = monthRecords.find((record) => record.town === selectedName);
  return Math.round(target?.rainfall ?? 0);
}
