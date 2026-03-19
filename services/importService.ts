import {
  Asset,
  CategoryId,
  ImportReconciliationCandidate,
  Transaction,
  TransactionType,
  Category,
  CategoryItem
} from '../types';
import { generateTransactionHashBase, getTimeKey, resolveHashDirection } from '../utils/hashKey';
import {
  buildNeedsReviewCandidates,
  getNeedsReviewLabel,
  getNeedsReviewMemoKey,
  normalizeReviewMemo,
  selectNeedsReviewTarget
} from '../utils/importNeedsReview';
import { buildPdfImportGrid } from '../utils/pdfImportGrid';
import { getTransactionTagNames } from '../utils/transactionDetails';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export interface ColumnMapping {
  dateIndex: number;
  timeIndex?: number; // Optional split time column
  amountIndex: number;
  amountInIndex?: number;
  amountOutIndex?: number;
  memoIndex: number;
  memoIndices?: number[]; // Optional multiple memo columns for concatenation
  typeIndex?: number;
  assetIndex?: number;
  toAssetIndex?: number;
  categoryIndex?: number;
  merchantIndex?: number;
  tagIndex?: number;
  installmentIndex?: number;
}

export interface ImportPreset {
  id: string;
  name: string;
  headerHash: string; // JSON string of the first few columns or custom hash
  mapping: ColumnMapping;
  linkedAssetId?: string; // Optional: If set, this preset is bound to a specific asset
  sourceType?: 'manual' | 'migration' | 'bank_salad' | 'simple_penny'; // Source identifier
  createdAt: number;
}

const PRESET_STORAGE_KEY = 'smartpenny_import_presets';
const MAPPING_SAMPLE_ROW_LIMIT = 20;
let pdfJsModulePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

const loadPdfJsModule = async () => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      if (pdfjs.GlobalWorkerOptions?.workerSrc !== pdfWorkerUrl) {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      }
      return pdfjs;
    });
  }

  return pdfJsModulePromise;
};

export type ImportCell = string | number | boolean | Date | null | undefined;
export type ImportGridRow = ImportCell[];
export type ImportGrid = ImportGridRow[];

export interface ImportRow {
  index: number;
  data: ImportGridRow;
  status: 'valid' | 'invalid' | 'duplicate' | 'needs_review';
  transaction?: Partial<Transaction>;
  subIdx: number; // For rows that split into multiple transactions (In/Out at same time)
  reason?: string;
  assetId?: string; // Manually assigned assetId or detected one
  replace_target_id?: string; // Optional: ID in the DB to replace when reconciled
  review_candidates?: ImportReviewCandidate[];
}

export interface ImportReviewCandidate extends ImportReconciliationCandidate {}

export interface ColumnAnalysis {
  index: number;
  header?: string;
  dataType: 'date' | 'number' | 'text' | 'unknown';
  sampleValues: ImportCell[];
  uniqueValueCount: number;
  confidence: number;
  suggestedField?: keyof ColumnMapping;
}

export interface GridAnalysisResult {
  headerIndex: number;
  columns: ColumnAnalysis[];
}

export interface InvalidImportRow {
  row: number;
  data: ImportGridRow;
  reason?: string;
}

const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  dateIndex: -1,
  timeIndex: -1,
  amountIndex: -1,
  amountInIndex: -1,
  amountOutIndex: -1,
  memoIndex: -1,
  memoIndices: [],
  typeIndex: -1,
  assetIndex: -1,
  toAssetIndex: -1,
  categoryIndex: -1,
  merchantIndex: -1,
  tagIndex: -1,
  installmentIndex: -1,
};

export const ImportService = {
  getDefaultMapping: (): ColumnMapping => ({ ...DEFAULT_COLUMN_MAPPING, memoIndices: [] }),

  suggestMappingFromColumns: (columns: ColumnAnalysis[]): ColumnMapping => {
    const next = ImportService.getDefaultMapping();
    const ranked = [...columns]
      .filter(column => column.suggestedField && column.confidence > 0)
      .sort((left, right) => right.confidence - left.confidence || left.index - right.index);

    ranked.forEach((column) => {
      const field = column.suggestedField;
      if (!field) return;
      const currentValue = next[field];

      if (typeof currentValue === 'number' && currentValue >= 0) return;
      next[field] = column.index as never;
    });

    return next;
  },

  /**
   * Parses a flexible date/time string or Excel serial number.
   */
  parseLooseDate: (dateVal: ImportCell, timeVal?: ImportCell): Date | null => {
    let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0, millisecond = 0;
    let ts = String(timeVal || '').trim();

    if (typeof dateVal === 'number') {
      if (dateVal >= 1e12) {
        // 0. Unix ms Timestamp (DB export timestamp, 예: 1744520197000)
        // Excel serial은 최대 ~60000 수준 → 1e12와 겹치지 않음
        const d = new Date(dateVal);
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
        hour = d.getHours();
        minute = d.getMinutes();
        second = d.getSeconds();
        millisecond = d.getMilliseconds();
      } else if (dateVal > 10000) {
        // 1. Excel Date Serial (e.g. 46089)
        // 25569 = 1970년 1월 1일 기준 (엑셀 1900년 기준 보정값)
        let date = new Date((dateVal - 25569) * 86400 * 1000 + (12 * 60 * 60 * 1000));
        year = date.getFullYear();
        month = date.getMonth();
        day = date.getDate();
        
        // 만약 숫자값에 소수점(시간)이 포함되어 있다면 추출
        const decimalPart = dateVal % 1;
        if (decimalPart > 0) {
          const totalSeconds = Math.round(decimalPart * 86400);
          hour = Math.floor(totalSeconds / 3600);
          minute = Math.floor((totalSeconds % 3600) / 60);
          second = totalSeconds % 60;
        }
      } else if (dateVal > 0 && dateVal < 1) {
        // 2. Excel Time Only (e.g. 0.941)
        const totalSeconds = Math.round(dateVal * 86400);
        hour = Math.floor(totalSeconds / 3600);
        minute = Math.floor((totalSeconds % 3600) / 60);
        second = totalSeconds % 60;
      }
    } else if (dateVal instanceof Date) {
      year = dateVal.getFullYear();
      month = dateVal.getMonth();
      day = dateVal.getDate();
      hour = dateVal.getHours();
      minute = dateVal.getMinutes();
      second = dateVal.getSeconds();
    } else {
      let ds = String(dateVal || '').trim();
      if (!ds) return null;

      let s = ts ? `${ds} ${ts}` : ds;
      // 1. YYYY.MM.DD HH:mm:ss 또는 YYYY. MM. DD. 오후 hh:mm 스타일 파싱 (Regex)
      // 변경점: [\.\/\-년] 뒤에 공백 여부 파악, 일(day) 뒤에 점유무 포함.
      const complexMatch = s.match(/(\d{4})[\.\/\-년]\s*(\d{1,2})[\.\/\-월]\s*(\d{1,2})[일\.]?\s*(?:(오전|오후|AM|PM)\s*)?(\d{1,2})?:?(\d{1,2})?(?::(\d{1,2}))?/i);
      if (complexMatch) {
        let [_, y, m, d, meridiem, hourStr, min, sec] = complexMatch;
        year = parseInt(y);
        month = parseInt(m) - 1;
        day = parseInt(d);
        hour = hourStr ? parseInt(hourStr, 10) : 0;
        minute = min ? parseInt(min, 10) : 0;
        second = sec ? parseInt(sec, 10) : 0;
        if (meridiem) {
          if ((meridiem === '오후' || meridiem.toUpperCase() === 'PM') && hour < 12) hour += 12;
          if ((meridiem === '오전' || meridiem.toUpperCase() === 'AM') && hour === 12) hour = 0;
        }
      } else {
        const cleanS = ds.replace(/[\.\/]/g, '-').replace(/\s/g, '');
        // 2-A. Unix ms 문자열 (DB export timestamp: 13자리 숫자, 예: "1744520197000")
        if (/^\d{13}$/.test(cleanS)) {
          const d = new Date(Number(cleanS)); // Number()로 변환 필수 (문자열은 ms로 인식 안 함)
          if (!isNaN(d.getTime())) {
            year = d.getFullYear();
            month = d.getMonth();
            day = d.getDate();
            hour = d.getHours();
            minute = d.getMinutes();
            second = d.getSeconds();
          }
        // 2-B. 8자리 숫자 스타일 (20240129)
        } else if (/^\d{8}$/.test(cleanS)) {
          year = parseInt(cleanS.substring(0, 4));
          month = parseInt(cleanS.substring(4, 6)) - 1;
          day = parseInt(cleanS.substring(6, 8));
        } else {
          // 최후의 수단
          const dDate = new Date(s);
          if (isNaN(dDate.getTime())) return null;
          year = dDate.getFullYear();
          month = dDate.getMonth();
          day = dDate.getDate();
          hour = dDate.getHours();
          minute = dDate.getMinutes();
        }
      }
    }

    // ─── Time 합성 단계: timeVal 처리 ───────────────────────────────
    // dateVal에서 시간이 아직 결정되지 않은 경우(hour=0, minute=0)에만 적용
    if (hour === 0 && minute === 0) {
      const rawTimeVal = timeVal;

      // Case 1: timeVal이 숫자 0~1 사이 (Excel 시간 소수, 예: 0.8654...)
      if (typeof rawTimeVal === 'number' && rawTimeVal > 0 && rawTimeVal < 1) {
        const totalSeconds = Math.round(rawTimeVal * 86400);
        hour = Math.floor(totalSeconds / 3600);
        minute = Math.floor((totalSeconds % 3600) / 60);
        second = totalSeconds % 60;
      }
      // Case 2: timeVal이 문자열 — 소수 문자열 or "HH:MM:SS" 형식
      else if (ts) {
        const fractionNum = parseFloat(ts);
        if (!isNaN(fractionNum) && fractionNum > 0 && fractionNum < 1) {
          // "0.865486..." 형태의 소수 문자열 → Excel 시간 소수로 처리
          const totalSeconds = Math.round(fractionNum * 86400);
          hour = Math.floor(totalSeconds / 3600);
          minute = Math.floor((totalSeconds % 3600) / 60);
          second = totalSeconds % 60;
        } else {
          // "HH:MM:SS" / "오후 8:44:30" 등 일반 시간 문자열
          const timeOnlyMatch = ts.match(/(?:(오전|오후|AM|PM)\s*)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/i);
          if (timeOnlyMatch) {
            let [_, tMeridiem, tHour, tMin, tSec] = timeOnlyMatch;
            let h = parseInt(tHour, 10);
            let m = parseInt(tMin, 10);
            let s = tSec ? parseInt(tSec, 10) : 0;
            if (tMeridiem) {
              if ((tMeridiem === '오후' || tMeridiem.toUpperCase() === 'PM') && h < 12) h += 12;
              if ((tMeridiem === '오전' || tMeridiem.toUpperCase() === 'AM') && h === 12) h = 0;
            }
            hour = h;
            minute = m;
            second = s;
          }
        }
      }
    }

    return new Date(year, month, day, hour, minute, second, millisecond);
  },
  discoverHeaderIndex: (grid: ImportGrid): number => {
    if (grid.length < 2) return 0;

    const getCellType = (v: ImportCell): string => {
      const s = String(v || '').trim();
      if (/^\d{2,4}[./-]\d{1,2}([./-]\d{1,2})?/.test(s)) return 'date';
      const num = s.replace(/[,|원|\\$|\s]/g, '');
      if (num !== '' && !isNaN(Number(num))) return 'num';
      return 'txt';
    };

    const getRowSignature = (row: ImportGridRow) => row.map(getCellType).join('|');

    // 1. Map all rows to their structural signatures
    const signatures = grid.map(getRowSignature);

    // 2. Scan for the first index where the same signature repeats significantly
    // We'll look for the longest or earliest repeating block.
    const scanLimit = Math.min(50, grid.length);
    for (let i = 0; i < scanLimit - 3; i++) {
        const sig = signatures[i];
        if (sig.split('|').filter(t => t !== 'txt').length < 1) continue; // Skip rows that are all text (likely metadata)

        // Check if this signature repeats in the next few rows
        // Note: For real files, patterns might not be 100% identical due to empty cells, 
        // but let's start with a strong consistency check.
        let matchCount = 0;
        const checkWindow = Math.min(10, grid.length - i); 
        for (let j = 0; j < checkWindow; j++) {
            if (signatures[i + j] === sig) matchCount++;
        }

        // If at least 60% of the next 10 rows match this signature, we've found the data body
        if (matchCount >= Math.min(5, checkWindow)) {
            // The header is the row BEFORE this repeating block.
            // If i is 0, then Row 0 is the data (no header).
            return i > 0 ? i - 1 : 0;
        }
    }

    // 3. Last Fallback: Even if signatures aren't identical, find a block that consistently has dates/numbers
    for (let i = 0; i < scanLimit - 3; i++) {
        let densityCount = 0;
        const window = Math.min(5, grid.length - i);
        for (let j = 0; j < window; j++) {
            const row = grid[i + j];
            if (row.some(c => getCellType(c) === 'date') && row.some(c => getCellType(c) === 'num')) {
                densityCount++;
            }
        }
        if (densityCount >= Math.min(3, window)) {
            return i > 0 ? i - 1 : 0;
        }
    }

    return 0;
  },

  /**
   * Analyzes columns to suggest mappings based on data patterns
   */
  analyzeColumns: (grid: ImportGrid, displayGrid?: ImportGrid): GridAnalysisResult => {
    if (grid.length === 0) return { headerIndex: 0, columns: [] };
    
    // Use displayGrid for UI preview, fallback to rawGrid
    const uiGrid = displayGrid || grid;
    
    // Keep the mapping canvas lightweight by limiting the preview sample rows.
    const previewRows = uiGrid.slice(0, MAPPING_SAMPLE_ROW_LIMIT);
    const headerIndex = ImportService.discoverHeaderIndex(grid);
    const headers = grid[headerIndex] || [];
    
    // Calculate the maximum number of columns across the preview rows and header
    const numCols = Math.max(headers.length, ...previewRows.map(r => r.length));
    
    const analysis: ColumnAnalysis[] = [];
    
    // Sample up to 50 rows from rawGrid for type detection (numbers/dates more reliable)
    const samples = grid.slice(headerIndex + 1, headerIndex + 51).filter(row => row.length > 0 && row.some(cell => cell !== ''));
    
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      const colData = samples.map(row => row[colIdx]).filter(val => val !== undefined && val !== null && val !== '');
      const uniqueValues = Array.from(new Set(colData));
      
      // Determine Data Type (using rawGrid numeric values for accuracy)
      let dataType: ColumnAnalysis['dataType'] = 'unknown';
      let dateMatches = 0;
      let numberMatches = 0;
      
      colData.forEach(val => {
        if (val instanceof Date) {
          dateMatches++;
        } else if (typeof val === 'number') {
          // Excel date serial > 10000, time fraction 0~1
          if (val > 10000) dateMatches++;
          else if (val > 0 && val < 1) dateMatches++; // time fraction
          else numberMatches++;
        } else {
          const s = String(val).trim();
          if (/^\d{4}[\.\/\-년]\s*\d{1,2}[\.\/\-월]\s*\d{1,2}/.test(s) || /^\d{8}$/.test(s.replace(/[\.\/]/g, ''))) {
            dateMatches++;
          }
          if (!isNaN(parseFloat(s.replace(/[^0-9\.-]/g, ''))) && s.replace(/[^0-9]/g, '').length > 0) {
            numberMatches++;
          }
        }
      });
      
      const totalCount = colData.length;
      if (totalCount > 0) {
        if (dateMatches / totalCount > 0.8) dataType = 'date';
        else if (numberMatches / totalCount > 0.8) dataType = 'number';
        else dataType = 'text';
      }
      
      // Heuristic Recommendation
      let suggestedField: keyof ColumnMapping | undefined;
      let confidence = 0;
      
      const headerText = String(headers[colIdx] || '').toLowerCase();
      const typeMatchRatio = totalCount > 0
        ? colData.filter(val => ImportService.parseTransactionTypeValue(val) !== null).length / totalCount
        : 0;
      
      // Logic based on header name
      if (headerText.includes('날짜') || headerText.includes('일자') || headerText.includes('date')) {
        suggestedField = 'dateIndex';
        confidence = 0.9;
      } else if (headerText.includes('시간') || headerText.includes('time')) {
        suggestedField = 'timeIndex';
        confidence = 0.9;
      } else if (headerText.includes('내용') || headerText.includes('적요') || headerText.includes('메모') || headerText.includes('memo') || headerText.includes('description')) {
        suggestedField = 'memoIndex';
        confidence = 0.8;
      } else if (
        headerText.includes('입출금') ||
        headerText.includes('거래구분') ||
        headerText.includes('type') ||
        headerText.includes('debit') ||
        headerText.includes('credit') ||
        (headerText.includes('구분') && typeMatchRatio >= 0.5) ||
        typeMatchRatio >= 0.8
      ) {
        suggestedField = 'typeIndex';
        confidence = Math.max(0.8, Math.min(0.95, 0.7 + typeMatchRatio * 0.3));
      } else if (headerText.includes('금액') || headerText.includes('amount') || headerText.includes('거래금액')) {
        suggestedField = 'amountIndex';
        confidence = 0.9;
      } else if (headerText.includes('수입') || headerText.includes('입금') || headerText.includes('income')) {
        suggestedField = 'amountInIndex';
        confidence = 0.9;
      } else if (headerText.includes('지출') || headerText.includes('출금') || headerText.includes('expense')) {
        suggestedField = 'amountOutIndex';
        confidence = 0.9;
      } else if (headerText.includes('분류') || headerText.includes('카테고리') || headerText.includes('category')) {
        suggestedField = 'categoryIndex';
        confidence = 0.8;
      } else if (headerText.includes('가맹점') || headerText.includes('거래처') || headerText.includes('merchant')) {
        suggestedField = 'merchantIndex';
        confidence = 0.8;
      }
      
      // Fallback to data type if header is cryptic
      if (!suggestedField) {
        if (dataType === 'date') {
          suggestedField = 'dateIndex';
          confidence = 0.6;
        } else if (dataType === 'number') {
          suggestedField = 'amountIndex';
          confidence = 0.5;
        }
      }
      
      // Use displayGrid rows for sampleValues (shows human-readable format as seen in Excel)
      const displaySampleValues = previewRows.map(row => row[colIdx]);

      analysis.push({
        index: colIdx,
        header: headers[colIdx],
        dataType,
        sampleValues: displaySampleValues,
        uniqueValueCount: uniqueValues.length,
        confidence,
        suggestedField
      });
    }
    
    return {
      headerIndex,
      columns: analysis
    };
  },

  generateHeaderHash: (headers: ImportGridRow): string => {
    // Take first 15 columns to form a signature for better precision
    return headers.slice(0, 15).map(h => String(h || '').trim()).join('|');
  },

  /**
   * Calculate similarity between two header hashes (Jaccard-like)
   */
  calculateSimilarity: (hash1: string, hash2: string): number => {
    if (hash1 === hash2) return 1.0;
    const set1 = new Set(hash1.split('|').filter(Boolean));
    const set2 = new Set(hash2.split('|').filter(Boolean));
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  },

  /**
   * Saves a new Preset to LocalStorage
   */
  savePreset: (name: string, mapping: ColumnMapping, headerHash: string, linkedAssetId?: string): ImportPreset => {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    const presets: ImportPreset[] = raw ? JSON.parse(raw) : [];

    // Check if we already have a similar preset for this asset, update it if so to prevent duplicates
    const existingIdx = presets.findIndex(p => p.headerHash === headerHash && p.linkedAssetId === linkedAssetId);

    if (existingIdx !== -1) {
      // Update existing
      presets[existingIdx].name = name;
      presets[existingIdx].mapping = mapping;
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      return presets[existingIdx];
    }

    const newPreset: ImportPreset = {
      id: crypto.randomUUID(),
      name,
      headerHash,
      mapping,
      linkedAssetId,
      createdAt: Date.now()
    };

    presets.push(newPreset);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    return newPreset;
  },

  /**
   * Updates an existing Preset
   */
  updatePreset: (id: string, mapping: ColumnMapping): ImportPreset | null => {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    const presets: ImportPreset[] = raw ? JSON.parse(raw) : [];

    const index = presets.findIndex(p => p.id === id);
    if (index === -1) return null;

    presets[index].mapping = mapping;
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    return presets[index];
  },

  /**
   * Get all saved presets
   */
  getPresets: (): ImportPreset[] => {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load presets", e);
      return [];
    }
  },

  findMatchingPreset: (headers: ImportGridRow, targetAssetId?: string): ImportPreset | null => {
    const hash = ImportService.generateHeaderHash(headers);
    const presets = ImportService.getPresets();

    let bestMatch: ImportPreset | null = null;
    let maxSimilarity = 0.75; // Minimum threshold 75%

    // 1. Try Strict Match first (prioritizing targetAssetId)
    if (targetAssetId) {
      const strictMatch = presets.find(p => p.headerHash === hash && p.linkedAssetId === targetAssetId);
      if (strictMatch) return strictMatch;
    }
    const globalStrict = presets.find(p => p.headerHash === hash && !p.linkedAssetId);
    if (globalStrict) return globalStrict;

    // 2. Fuzzy Match (Similarity based)
    for (const p of presets) {
      if (p.linkedAssetId && p.linkedAssetId !== targetAssetId) continue; // Don't match presets of other accounts fuzzy

      const sim = ImportService.calculateSimilarity(hash, p.headerHash);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = p;
      }
    }

    return bestMatch;
  },

  /**
   * Deletes a preset by ID
   */
  deletePreset: (id: string): void => {
    const presets = ImportService.getPresets();
    const filtered = presets.filter(p => p.id !== id);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(filtered));
  },

  /**
   * Unlinks a preset from its specific asset, making it a global fallback or just unlinked.
   */
  unlinkPreset: (id: string): ImportPreset | null => {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    const presets: ImportPreset[] = raw ? JSON.parse(raw) : [];

    const index = presets.findIndex(p => p.id === id);
    if (index === -1) return null;

    delete presets[index].linkedAssetId;

    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    return presets[index];
  },

  /**
   * Generates a unique hash key for a transaction to prevent duplicates.
   * Logic: AssetID + Timestamp(minute precision) + Amount + Direction(IN/OUT) + Memo
   */
  generateHashKey: (
    assetId: string,
    timestamp: number,
    amount: number,
    memo: string,
    type?: TransactionType,
    toAssetId?: string
  ): string => {
    const direction = resolveHashDirection({ type, toAssetId });
    return generateTransactionHashBase(assetId, timestamp, amount, memo, direction);
  },

  normalizeImportedCellValue: (value: ImportCell): string => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    if (/^(null|undefined|none|n\/a|na)$/i.test(normalized)) return '';
    return normalized;
  },

  parseTransactionTypeValue: (value: ImportCell): TransactionType | null => {
    const rawValue = ImportService.normalizeImportedCellValue(value);
    if (!rawValue) return null;

    const normalized = rawValue
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s_\-\/()[\]{}+]+/g, '');

    if (!normalized) return null;

    const matchesAny = (tokens: string[]) => tokens.includes(normalized);

    if (matchesAny(['transfer', 'xfer', '이체', '송금', '자금이동'])) {
      return TransactionType.TRANSFER;
    }

    if (matchesAny(['income', 'credit', 'deposit', 'inflow', '입금', '수입', '입'])) {
      return TransactionType.INCOME;
    }

    if (matchesAny(['expense', 'debit', 'withdrawal', 'outflow', '출금', '지출', '출', '결제', '사용'])) {
      return TransactionType.EXPENSE;
    }

    return null;
  },

  resolveAssetId: (value: ImportCell, assets: Asset[]): string | null => {
    const assetVal = ImportService.normalizeImportedCellValue(value);
    if (!assetVal) return null;

    const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');
    const normInput = normalize(assetVal);
    let bestMatchId: string | null = null;

    if (/^\d{10,}$/.test(assetVal)) {
      const directMatch = assets.find(a => String(a.id) === assetVal);
      if (directMatch) return directMatch.id;
    }

    for (const a of assets) {
      const prodNorm = normalize(a.productName || '');
      if (prodNorm && (normInput === prodNorm || normInput.includes(prodNorm))) {
        bestMatchId = a.id;
        break;
      }
    }

    if (!bestMatchId) {
      for (const a of assets) {
        const instNorm = normalize(a.institution || '');
        const accSuffix = a.accountNumber ? normalize(a.accountNumber).replace(/[^0-9]/g, '').slice(-4) : '';

        if (instNorm && accSuffix && accSuffix.length >= 4) {
          if (normInput.includes(instNorm) && normInput.includes(accSuffix)) {
            bestMatchId = a.id;
            break;
          }
        }
      }
    }

    return bestMatchId;
  },

  normalizeReviewMemo,

  getNeedsReviewMemoKey,

  getTimeKey: (timestamp: number): number => getTimeKey(timestamp),

  getNeedsReviewLabel,

  buildNeedsReviewCandidates,

  selectNeedsReviewTarget,

  /**
   * Reads a file (CSV, Excel, or text-based PDF) and returns raw 2D array data.
   */
  parseFileToGrid: async (file: File): Promise<{ rawGrid: ImportGrid, displayGrid: ImportGrid }> => {
    const buffer = await file.arrayBuffer();

    if (file.name.match(/\.pdf$/i)) {
      const pdfjs = await loadPdfJsModule();
      const loadingTask = pdfjs.getDocument({
        data: buffer,
        useWorkerFetch: false,
        isEvalSupported: false,
      });

      try {
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          pages.push({
            items: textContent.items
              .filter((item): item is {
                str: string;
                transform: number[];
                width?: number;
                height?: number;
              } => (
                'str' in item &&
                typeof item.str === 'string' &&
                Array.isArray(item.transform)
              ))
              .map(item => ({
                str: item.str,
                transform: item.transform,
                width: item.width,
                height: item.height,
              })),
          });
          page.cleanup();
        }

        const grid = buildPdfImportGrid(pages);
        if (grid.length === 0) {
          throw new Error('No extractable text found in PDF');
        }

        return {
          rawGrid: grid,
          displayGrid: grid,
        };
      } finally {
        await loadingTask.destroy();
      }
    }

    const { read, utils } = await import('xlsx');

    const parseWorkbook = (wb: any) => {
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      // rawGrid: 숫자/날짜 Serial 원본 (계산·파싱용)
      const rawGrid = utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }) as ImportGrid;
      // displayGrid: Excel에서 실제로 보이는 포맷 문자열 (매핑 화면 표시용)
      const displayGrid = utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as ImportGrid;
      return { rawGrid, displayGrid };
    };

    const scoreParsedGrid = (result: { rawGrid: ImportGrid, displayGrid: ImportGrid }): number => {
      const sampleValues = result.displayGrid
        .slice(0, 100)
        .flat()
        .map(cell => String(cell ?? ''))
        .filter(Boolean);

      const suspiciousChars = sampleValues.reduce((count, value) => {
        const hardFailures = value.match(/[�﷿]/g)?.length ?? 0;
        const mojibake = value.match(/[ÃÂìëêíð]/g)?.length ?? 0;
        return count + hardFailures * 10 + mojibake;
      }, 0);

      return (result.rawGrid.length * 5) + sampleValues.length - (suspiciousChars * 20);
    };

    const tryArrayWorkbook = (options: Record<string, unknown> = {}) => {
      try {
        const workbook = read(buffer, { type: 'array', cellText: true, ...options });
        if (workbook.SheetNames.length === 0) return null;
        const result = parseWorkbook(workbook);
        return result.rawGrid.length > 0 ? result : null;
      } catch {
        return null;
      }
    };

    if (file.name.match(/\.(csv|txt|tsv)$/i)) {
      const candidates = [
        tryArrayWorkbook({ codepage: 65001 }),
        tryArrayWorkbook({ codepage: 949 }),
      ].filter((candidate): candidate is { rawGrid: ImportGrid, displayGrid: ImportGrid } => Boolean(candidate));

      if (candidates.length > 0) {
        candidates.sort((left, right) => scoreParsedGrid(right) - scoreParsedGrid(left));
        return candidates[0];
      }
    }

    if (file.name.match(/\.(xls|xlsx)$/i)) {
      try {
        const workbook = read(buffer, { type: 'array', cellText: true });
        if (workbook.SheetNames.length > 0) {
          const result = parseWorkbook(workbook);
          if (result.rawGrid.length > 0) return result;
        }
      } catch (e) {
        console.warn('Binary Excel read failed, falling back to text decoding...', e);
      }
    }

    let decodedText = '';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decodedText = decoder.decode(buffer);
    } catch (e) {
      try {
        console.warn('UTF-8 decoding failed, trying EUC-KR/CP949');
        const decoder = new TextDecoder('euc-kr');
        decodedText = decoder.decode(buffer);
      } catch (err) {
        console.error('Failed to decode file locally, trying SheetJS binary fallback', err);
        const workbook = read(buffer, { type: 'array', cellText: true });
        return parseWorkbook(workbook);
      }
    }

    try {
      const workbook = read(decodedText, { type: 'string', cellText: true });
      return parseWorkbook(workbook);
    } catch (err) {
      console.warn('String workbook parse failed, trying array/codepage fallback...', err);

      const fallbackCandidates = [
        tryArrayWorkbook({ codepage: 65001 }),
        tryArrayWorkbook({ codepage: 949 }),
      ].filter((candidate): candidate is { rawGrid: ImportGrid, displayGrid: ImportGrid } => Boolean(candidate));

      if (fallbackCandidates.length > 0) {
        fallbackCandidates.sort((left, right) => scoreParsedGrid(right) - scoreParsedGrid(left));
        return fallbackCandidates[0];
      }

      throw err;
    }
  },


  /**
   * Internal helper to parse and validate a single row.
   */
  validateRow: (
    row: ImportGridRow,
    index: number,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: Asset[] = [],
    categories: CategoryItem[] = []
  ): { transactions?: Partial<Transaction>[], reason?: string } => {
    try {
      const dateVal = row[mapping.dateIndex];
      
      // Amount Resolution
      const pendingTxs: Array<{ amount: number; type: TransactionType }> = [];
      const parseAmt = (v: ImportCell) => {
        if (typeof v === 'number') return v;
        const s = String(v || '').trim();
        if (!s) return 0;
        return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
      };

      if (mapping.amountInIndex !== undefined && mapping.amountInIndex >= 0) {
        const inAmt = parseAmt(row[mapping.amountInIndex]);
        if (inAmt > 0) pendingTxs.push({ amount: Math.abs(inAmt), type: TransactionType.INCOME });
      }
      if (mapping.amountOutIndex !== undefined && mapping.amountOutIndex >= 0) {
        const outAmt = parseAmt(row[mapping.amountOutIndex]);
        if (outAmt > 0) pendingTxs.push({ amount: Math.abs(outAmt), type: TransactionType.EXPENSE });
      }

      if (mapping.amountIndex !== undefined && mapping.amountIndex >= 0) {
        const amountVal = row[mapping.amountIndex];
        const rawTypeValue = mapping.typeIndex !== undefined && mapping.typeIndex >= 0
          ? row[mapping.typeIndex]
          : undefined;
        const explicitType = ImportService.parseTransactionTypeValue(rawTypeValue);
        let amount = 0;
        if (typeof amountVal === 'number') {
          amount = amountVal;
        } else {
          const s = String(amountVal || '').trim();
          if (!s) throw new Error("Empty Amount");
          const cleanAmt = s.replace(/[^0-9.-]/g, '');
          const parsedFloat = parseFloat(cleanAmt);
          if (isNaN(parsedFloat)) throw new Error("Invalid Amount");
          amount = parsedFloat;
        }
        if (amount !== 0) {
          if (
            mapping.typeIndex !== undefined &&
            mapping.typeIndex >= 0 &&
            String(rawTypeValue ?? '').trim() !== '' &&
            explicitType === null
          ) {
            throw new Error("Invalid Type");
          }

          const type = explicitType ?? (amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME);
          pendingTxs.push({ amount: Math.abs(amount), type });
        }
      }

      if (pendingTxs.length === 0) throw new Error("Zero Amount"); // 0원 전용 에러 (skip 처리)
      return ImportService._internalFinalizeRows(row, index, mapping, defaultAssetId, assets, categories, pendingTxs);
    } catch (err) {
      return { reason: (err as Error).message };
    }
  },

  /**
   * Internal helper with ULTRA-STRICT asset matching.
   */
  _internalFinalizeRows: (
    row: ImportGridRow,
    index: number,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: Asset[],
    categories: CategoryItem[],
    pendingAmounts: { amount: number, type: TransactionType }[]
  ): { transactions?: Partial<Transaction>[], reason?: string } => {
    try {
      const dateVal = row[mapping.dateIndex];
      const memoVal = mapping.memoIndex !== undefined && mapping.memoIndex >= 0
        ? row[mapping.memoIndex]
        : undefined;

      // --- Asset Resolution (ULTRA-STRICT) ---
      let currentAssetId = defaultAssetId;
      if (mapping.assetIndex !== undefined && mapping.assetIndex >= 0) {
        const mappedAssetId = ImportService.resolveAssetId(row[mapping.assetIndex], assets);
        if (mappedAssetId) {
          currentAssetId = mappedAssetId;
        }
      }

      if (currentAssetId === 'dynamic') {
        throw new Error("Account not found");
      }

      const timeVal = mapping.timeIndex !== undefined && mapping.timeIndex >= 0 ? row[mapping.timeIndex] : undefined;
      const d = ImportService.parseLooseDate(dateVal, timeVal);
      if (!d) throw new Error("Invalid Date");

      // toISOString().split('T')[0] 은 자정 근처 데이터가 어제로 밀리는 현상이 있음. 로컬 날짜 기준으로 생성.
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timestamp = d.getTime();

      // --- Merchant & Memo ---
      let merchantVal = undefined;
      let tagNames: string[] = [];
      let memoParts: string[] = [];
      const primaryMemo = String(memoVal || '').trim();
      if (primaryMemo) memoParts.push(primaryMemo);

      if (mapping.memoIndices && mapping.memoIndices.length > 0) {
        for (const mIdx of mapping.memoIndices) {
          if (mIdx >= 0 && mIdx !== mapping.memoIndex) {
            const extra = String(row[mIdx] || '').trim();
            if (extra && !memoParts.includes(extra)) memoParts.push(extra);
          }
        }
      }

      let finalMemo = memoParts.join(' ');

      if (mapping.merchantIndex !== undefined && mapping.merchantIndex >= 0) {
        const rawMerchant = String(row[mapping.merchantIndex] || '').trim();
        if (rawMerchant) {
          merchantVal = rawMerchant;
        }
      }

      if (mapping.tagIndex !== undefined && mapping.tagIndex >= 0) {
        const rawTag = String(row[mapping.tagIndex] || '').trim();
        if (rawTag) {
          tagNames = getTransactionTagNames(
            rawTag
              .split(/[;,|]/)
              .map(tag => tag.trim())
              .filter(Boolean)
          );
        }
      }

      if (!finalMemo && !merchantVal && tagNames.length === 0) throw new Error("Empty Details");

      // --- Category ---
      let categoryVal: CategoryId = Category.OTHER;
      if (mapping.categoryIndex !== undefined && mapping.categoryIndex >= 0) {
        const rawCat = String(row[mapping.categoryIndex] || '').trim();
        if (rawCat) {
          const match = categories.find(c => c.name.toLowerCase() === rawCat.toLowerCase());
          categoryVal = match ? match.id : rawCat;
        }
      }

      if ((categoryVal === Category.OTHER || !categoryVal) && finalMemo) {
        const memoLower = finalMemo.toLowerCase();
        for (const cat of categories) {
          if (cat.keywords?.some(k => memoLower.includes(k.toLowerCase()))) {
            categoryVal = cat.id;
            break;
          }
        }
      }

      // --- Build Transactions ---
      const defaultTransferCategory = categories.find(c => c.type === TransactionType.TRANSFER)?.id ?? Category.TRANSFER;
      const finalTransactions: Partial<Transaction>[] = [];

      pendingAmounts.forEach((p, subIdx) => {
        let txInstallment = undefined;
        if (p.type === TransactionType.EXPENSE && mapping.installmentIndex !== undefined && mapping.installmentIndex >= 0) {
          const rawInst = String(row[mapping.installmentIndex] || '').trim();
          const monthsMatch = rawInst.match(/(\d+)/);
          if (monthsMatch) {
            const totalMonths = parseInt(monthsMatch[1], 10);
            if (totalMonths > 1) {
              txInstallment = {
                totalMonths,
                currentMonth: 1,
                isInterestFree: true,
                remainingBalance: p.amount
              };
            }
          }
        }

        const resolvedCategory = p.type === TransactionType.TRANSFER && (categoryVal === Category.OTHER || !categoryVal)
          ? defaultTransferCategory
          : categoryVal;

        if (p.type === TransactionType.TRANSFER) {
          if (mapping.toAssetIndex === undefined || mapping.toAssetIndex < 0) {
            throw new Error("Transfer requires destination account column");
          }

          const destinationAssetId = ImportService.resolveAssetId(row[mapping.toAssetIndex], assets) || undefined;

          if (destinationAssetId && currentAssetId === destinationAssetId) {
            throw new Error("Source and destination accounts must be different");
          }

          finalTransactions.push({
            id: `imported-${Date.now()}-${index}-${subIdx}`,
            date: dateStr,
            timestamp,
            amount: p.amount,
            type: TransactionType.TRANSFER,
            category: resolvedCategory,
            memo: finalMemo,
            merchant: merchantVal,
            tags: tagNames,
            assetId: currentAssetId,
            toAssetId: destinationAssetId,
            originalText: finalMemo
          });

          return;
        }

        finalTransactions.push({
          id: `imported-${Date.now()}-${index}-${subIdx}`,
          date: dateStr,
          timestamp,
          amount: p.amount,
          type: p.type,
          category: resolvedCategory,
          memo: finalMemo,
          merchant: merchantVal,
          tags: tagNames,
          installment: txInstallment,
          assetId: currentAssetId,
          originalText: finalMemo
        });
      });

      return { transactions: finalTransactions };
    } catch (err) {
      return { reason: (err as Error).message };
    }
  },

  /**
   * Converts raw grid data into ImportRows.
   */
  mapRawDataToImportRows: (
    grid: ImportGrid,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: Asset[] = [],
    categories: CategoryItem[] = [],
    headerIndex: number = 0
  ): ImportRow[] => {
    const rows: ImportRow[] = [];
    const baseHashCounts = new Map<string, number>();

    // Start from the row after the header
    for (let i = headerIndex + 1; i < grid.length; i++) {
      const rawRowData = grid[i];
      if (!rawRowData || rawRowData.some(cell => cell !== '') === false) continue;

      const { transactions, reason } = ImportService.validateRow(rawRowData, i, mapping, defaultAssetId, assets, categories);

      if (transactions && transactions.length > 0) {
        transactions.forEach((tx, subIdx) => {
          const baseHash = ImportService.generateHashKey(
            tx.assetId!,
            tx.timestamp!,
            tx.amount!,
            tx.memo || tx.merchant || '',
            tx.type,
            tx.toAssetId
          );
          const currentCount = baseHashCounts.get(baseHash) || 0;
          baseHashCounts.set(baseHash, currentCount + 1);
          tx.hashKey = `${baseHash}#${currentCount}#${subIdx}`;

          rows.push({
            index: i,
            subIdx,
            data: rawRowData,
            status: 'valid',
            transaction: tx
          });
        });
      } else {
        // 0원 거래는 조용히 건너뜀 (INVALID 탭에 표시하지 않음)
        if (reason === 'Zero Amount') continue;
        rows.push({
          index: i,
          subIdx: 0,
          data: rawRowData,
          status: 'invalid',
          reason: reason || 'Unknown Error'
        });
      }
    }
    return rows;
  },

  /**
   * Reassigns hash keys for a list of ImportRows to ensure global uniqueness and consistent formatting.
   * Now cross-checks against dbHashBank to identify existing record duplicates.
   * Preserves the original subIdx from the transaction's existing hashKey (set by mapRawDataToImportRows)
   * so that multi-transaction rows (e.g. 결제+취소 simultaneously) maintain correct #count#subIdx.
   */
  // reconciliationCandidates Parameter Added (Tier 2 Evaluation)
  reassignHashKeys: (
    rows: ImportRow[],
    dbHashBank?: Set<string>,
    reconciliationCandidates?: ImportReconciliationCandidate[]
  ): ImportRow[] => {
    const baseHashCounts = new Map<string, number>();
    const duplicateDbHashKeys = new Set<string>();

    const stagedRows = rows.map(row => {
      // Keep invalid rows as they are, but re-calculate for others
      if (row.status === 'invalid' || !row.transaction) {
        return { ...row, review_candidates: undefined };
      }
      
      const tx = row.transaction;
      const baseHash = ImportService.generateHashKey(
        tx.assetId!,
        tx.timestamp!,
        tx.amount!,
        tx.memo || tx.merchant || '',
        tx.type,
        tx.toAssetId
      );
      
      const currentCount = baseHashCounts.get(baseHash) || 0;
      baseHashCounts.set(baseHash, currentCount + 1);
      
      const subIdx = row.subIdx || 0;
      const hashKey = `${baseHash}#${currentCount}#${subIdx}`;
      tx.hashKey = hashKey;

      if (dbHashBank && dbHashBank.has(hashKey)) {
        duplicateDbHashKeys.add(hashKey);
      }

      return {
        ...row,
        status: dbHashBank && dbHashBank.has(hashKey) ? 'duplicate' : 'valid',
        reason: row.reason,
        replace_target_id: undefined,
        review_candidates: undefined,
        transaction: { ...tx }
      };
    });

    const unresolvedCandidates = (reconciliationCandidates || []).filter(candidate => {
      if (!candidate?.hashKey) return true;
      return !duplicateDbHashKeys.has(String(candidate.hashKey));
    });

    const reassignedRows = stagedRows.map(row => {
      if (row.status !== 'valid' || !row.transaction || unresolvedCandidates.length === 0) {
        return row;
      }

      const tx = row.transaction;
      if (tx.type !== TransactionType.INCOME && tx.type !== TransactionType.EXPENSE) {
        return row;
      }

      const reviewCandidates = ImportService.buildNeedsReviewCandidates(tx, unresolvedCandidates);
      if (reviewCandidates.length === 0) {
        return row;
      }

      const typeLabel = ImportService.getNeedsReviewLabel(tx.type);

      return {
        ...row,
        status: 'needs_review' as const,
        reason: reviewCandidates.length === 1
          ? `기존 ${typeLabel} 교체 후보 1건`
          : `기존 ${typeLabel} 교체 후보 ${reviewCandidates.length}건`,
        replace_target_id: ImportService.selectNeedsReviewTarget(reviewCandidates),
        review_candidates: reviewCandidates.map(candidate => ({
          id: candidate.id,
          memo: candidate.memo,
          merchant: candidate.merchant,
          date: candidate.date,
          timestamp: candidate.timestamp,
          amount: candidate.amount,
          assetId: candidate.assetId,
          type: candidate.type,
          hashKey: candidate.hashKey,
        })),
      };
    });

    const targetUsageCounts = new Map<string, number>();
    reassignedRows.forEach(row => {
      if (row.replace_target_id) {
        targetUsageCounts.set(row.replace_target_id, (targetUsageCounts.get(row.replace_target_id) || 0) + 1);
      }
    });

    return reassignedRows.map(row => {
      if (!row.replace_target_id) return row;

      if ((targetUsageCounts.get(row.replace_target_id) || 0) > 1) {
        return {
          ...row,
          replace_target_id: undefined,
          reason: '교체 후보 충돌 - 직접 선택 필요'
        };
      }

      return row;
    });
  },


  mapRawDataToTransactions: (
    grid: ImportGrid,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: Asset[] = [],
    categories: CategoryItem[] = [],
    headerIndex: number = 0
  ): { valid: Partial<Transaction>[], invalid: InvalidImportRow[] } => {
    const rows = ImportService.mapRawDataToImportRows(grid, mapping, defaultAssetId, assets, categories, headerIndex);
    return {
      valid: rows.filter(r => r.status === 'valid').map(r => r.transaction!),
      invalid: rows.filter(r => r.status === 'invalid').map(r => ({ row: r.index + 1, data: r.data, reason: r.reason }))
    };
  },

  processImportedTransactions: (
    newTransactions: Partial<Transaction>[],
    existingTransactions: Transaction[]
  ): {
    finalNewTxs: Transaction[],
    updatedExistingTxs: Transaction[]
  } => {
    const finalNewTxs: Transaction[] = [];
    const updatedExistingTxs: Transaction[] = [];
    const processedHashKeys = new Set(existingTransactions.map(t => t.hashKey).filter(Boolean));

    for (const draftTx of newTransactions) {
      if (draftTx.hashKey && processedHashKeys.has(draftTx.hashKey)) continue;
      processedHashKeys.add(draftTx.hashKey!);
      finalNewTxs.push({ ...draftTx } as Transaction);
    }

    return { finalNewTxs, updatedExistingTxs };
  },
};
