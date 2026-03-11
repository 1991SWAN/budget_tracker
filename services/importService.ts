import { Transaction, TransactionType, Category, CategoryItem } from '../types';
import { read, utils } from 'xlsx';

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

export interface ImportRow {
  index: number;
  data: any[];
  status: 'valid' | 'invalid' | 'duplicate';
  transaction?: Partial<Transaction>;
  reason?: string;
  assetId?: string; // Manually assigned assetId or detected one
}

export interface ColumnAnalysis {
  index: number;
  header?: string;
  dataType: 'date' | 'number' | 'text' | 'unknown';
  sampleValues: any[];
  uniqueValueCount: number;
  confidence: number;
  suggestedField?: keyof ColumnMapping;
}

export interface GridAnalysisResult {
  headerIndex: number;
  columns: ColumnAnalysis[];
}

export const ImportService = {

  /**
   * Parses a flexible date/time string or Excel serial number.
   */
  parseLooseDate: (dateVal: any, timeVal?: any): Date | null => {
    let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
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
      // 1. YYYY.MM.DD HH:mm:ss 스타일 파싱 (Regex)
      const complexMatch = s.match(/(\d{4})[\.\/\-년]\s*(\d{1,2})[\.\/\-월]\s*(\d{1,2})[일]?\s*(?:(오전|오후|AM|PM)\s*)?(\d{1,2})?:?(\d{1,2})?(?::(\d{1,2}))?/i);
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

    return new Date(year, month, day, hour, minute, second);
  },
  discoverHeaderIndex: (grid: any[][]): number => {
    if (grid.length < 2) return 0;

    const getCellType = (v: any): string => {
      const s = String(v || '').trim();
      if (/^\d{2,4}[./-]\d{1,2}([./-]\d{1,2})?/.test(s)) return 'date';
      const num = s.replace(/[,|원|\\$|\s]/g, '');
      if (num !== '' && !isNaN(Number(num))) return 'num';
      return 'txt';
    };

    const getRowSignature = (row: any[]) => row.map(getCellType).join('|');

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
  analyzeColumns: (grid: any[][], displayGrid?: any[][]): GridAnalysisResult => {
    if (grid.length === 0) return { headerIndex: 0, columns: [] };
    
    // Use displayGrid for UI preview, fallback to rawGrid
    const uiGrid = displayGrid || grid;
    
    // Extract first 20 rows of the file for the UI preview
    const previewRows = uiGrid.slice(0, 20);
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

  generateHeaderHash: (headers: any[]): string => {
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

  findMatchingPreset: (headers: any[], targetAssetId?: string): ImportPreset | null => {
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
   * Logic: AssetID + Timestamp(minute precision) + Amount + Memo
   */
  generateHashKey: (assetId: string, timestamp: number, amount: number, memo: string): string => {
    const timeKey = Math.floor(timestamp / 60000);
    // 방안 C: memo 공백 완전 제거 (파일 출처별 공백 차이 무력화)
    const normalizedMemo = memo.trim().replace(/\s/g, '');
    const raw = `${assetId}|${timeKey}|${amount}|${normalizedMemo}`;

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; 
    }
    return hash.toString(16);
  },

  /**
   * Reads a file (CSV or Excel) and returns raw 2D array data.
   */
  parseFileToGrid: async (file: File): Promise<{ rawGrid: any[][], displayGrid: any[][] }> => {
    const buffer = await file.arrayBuffer();

    const parseWorkbook = (wb: any) => {
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      // rawGrid: 숫자/날짜 Serial 원본 (계산·파싱용)
      const rawGrid = utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }) as any[][];
      // displayGrid: Excel에서 실제로 보이는 포맷 문자열 (매핑 화면 표시용)
      const displayGrid = utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][];
      return { rawGrid, displayGrid };
    };

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

    const workbook = read(decodedText, { type: 'string', cellText: true });
    return parseWorkbook(workbook);
  },


  /**
   * Internal helper to parse and validate a single row.
   */
  validateRow: (
    row: any[],
    index: number,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
    categories: CategoryItem[] = []
  ): { transactions?: Partial<Transaction>[], reason?: string } => {
    try {
      const dateVal = row[mapping.dateIndex];
      
      // Amount Resolution
      const pendingTxs = [];
      const parseAmt = (v: any) => {
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
          const type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
          pendingTxs.push({ amount: Math.abs(amount), type });
        }
      }

      if (pendingTxs.length === 0) throw new Error("No Amount detected");
      return ImportService._internalFinalizeRows(row, index, mapping, defaultAssetId, assets, categories, pendingTxs);
    } catch (err) {
      return { reason: (err as Error).message };
    }
  },

  /**
   * Internal helper with ULTRA-STRICT asset matching.
   */
  _internalFinalizeRows: (
    row: any[],
    index: number,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[],
    categories: CategoryItem[],
    pendingAmounts: { amount: number, type: TransactionType }[]
  ): { transactions?: Partial<Transaction>[], reason?: string } => {
    try {
      const dateVal = row[mapping.dateIndex];
      const memoVal = row[mapping.memoIndex];

      // --- Asset Resolution (ULTRA-STRICT) ---
      let currentAssetId = defaultAssetId;
      if (mapping.assetIndex !== undefined && mapping.assetIndex >= 0) {
        const assetVal = String(row[mapping.assetIndex] || '').trim();
        if (assetVal) {
          const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');
          const normInput = normalize(assetVal);
          let bestMatchId: string | null = null;

          // Tier 0: Direct ID Match (DB export CSV 전용 - 10자 이상 순수 숫자 ID)
          if (/^\d{10,}$/.test(assetVal)) {
            const directMatch = assets.find(a => String(a.id) === assetVal);
            if (directMatch) bestMatchId = directMatch.id;
          }

          // Tier 1: Product Name Match
          if (!bestMatchId) for (const a of assets) {
            const prodNorm = normalize(a.productName || '');
            if (prodNorm && (normInput === prodNorm || normInput.includes(prodNorm))) {
              bestMatchId = a.id;
              break;
            }
          }

          // Tier 2: Institution + Account Suffix (Both Required)
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

          if (bestMatchId) {
            currentAssetId = bestMatchId;
          }
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
          if (!finalMemo.toLowerCase().includes(`@${rawMerchant.toLowerCase()}`)) {
            finalMemo = finalMemo ? `${finalMemo} @${rawMerchant}` : `@${rawMerchant}`;
          }
        }
      }

      if (mapping.tagIndex !== undefined && mapping.tagIndex >= 0) {
        const rawTag = String(row[mapping.tagIndex] || '').trim();
        if (rawTag) {
          const cleanTag = rawTag.replace(/\s+/g, '_');
          const formattedTag = cleanTag.startsWith('#') ? cleanTag : `#${cleanTag}`;
          if (!finalMemo.toLowerCase().includes(formattedTag.toLowerCase())) {
            finalMemo = `${finalMemo} ${formattedTag}`;
          }
        }
      }

      if (!finalMemo) throw new Error("Empty Description");

      // --- Category ---
      let categoryVal = Category.OTHER;
      if (mapping.categoryIndex !== undefined && mapping.categoryIndex >= 0) {
        const rawCat = String(row[mapping.categoryIndex] || '').trim();
        if (rawCat) {
          const match = categories.find(c => c.name.toLowerCase() === rawCat.toLowerCase());
          categoryVal = match ? (match.id as any) : (rawCat as any);
        }
      }

      if ((categoryVal === Category.OTHER || !categoryVal) && finalMemo) {
        const memoLower = finalMemo.toLowerCase();
        for (const cat of categories) {
          if (cat.keywords?.some(k => memoLower.includes(k.toLowerCase()))) {
            categoryVal = cat.id as any;
            break;
          }
        }
      }

      // --- Build Transactions ---
      const finalTransactions: Partial<Transaction>[] = pendingAmounts.map((p, subIdx) => {
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

        return {
          id: `imported-${Date.now()}-${index}-${subIdx}`,
          date: dateStr,
          timestamp,
          amount: p.amount,
          type: p.type,
          category: categoryVal,
          memo: finalMemo,
          merchant: merchantVal,
          installment: txInstallment,
          assetId: currentAssetId,
          originalText: finalMemo
        };
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
    grid: any[][],
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
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
            tx.memo!
          );
          const currentCount = baseHashCounts.get(baseHash) || 0;
          baseHashCounts.set(baseHash, currentCount + 1);
          tx.hashKey = `${baseHash}#${currentCount}#${subIdx}`;

          rows.push({
            index: i,
            data: rawRowData,
            status: 'valid',
            transaction: tx
          });
        });
      } else {
        rows.push({
          index: i,
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
  reassignHashKeys: (rows: ImportRow[], dbHashBank?: Set<string>): ImportRow[] => {
    const baseHashCounts = new Map<string, number>();
    
    return rows.map(row => {
      // Keep invalid rows as they are, but re-calculate for others
      if (row.status === 'invalid' || !row.transaction) return row;
      
      const tx = row.transaction;
      const baseHash = ImportService.generateHashKey(
        tx.assetId!,
        tx.timestamp!,
        tx.amount!,
        tx.memo!
      );
      
      const currentCount = baseHashCounts.get(baseHash) || 0;
      baseHashCounts.set(baseHash, currentCount + 1);
      
      // Preserve the original subIdx from mapRawDataToImportRows.
      // The existing hashKey format is "{baseHash}#{count}#{subIdx}" — extract the last segment.
      // Falls back to 0 if there's no pre-existing hashKey (e.g., manually added rows).
      const existingSubIdx = tx.hashKey
        ? parseInt(tx.hashKey.split('#').pop() ?? '0', 10)
        : 0;
      const subIdx = isNaN(existingSubIdx) ? 0 : existingSubIdx;
      
      const hashKey = `${baseHash}#${currentCount}#${subIdx}`;
      tx.hashKey = hashKey;

      // CROSS-CHECK against DB Hash Bank
      let newStatus: 'valid' | 'duplicate' = 'valid';
      if (dbHashBank && dbHashBank.has(hashKey)) {
        newStatus = 'duplicate';
      }

      return { ...row, status: newStatus, transaction: { ...tx } };
    });
  },


  mapRawDataToTransactions: (
    grid: any[][],
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
    categories: CategoryItem[] = [],
    headerIndex: number = 0
  ): { valid: Partial<Transaction>[], invalid: any[] } => {
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
