import { Transaction, TransactionType, Category, CategoryItem } from '../types';
import { read, utils } from 'xlsx';

export interface ColumnMapping {
  dateIndex: number;
  amountIndex: number;
  amountInIndex?: number;
  amountOutIndex?: number;
  memoIndex: number;
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
  createdAt: number;
}

const PRESET_STORAGE_KEY = 'smartpenny_import_presets';

export interface ImportRow {
  index: number;
  data: any[];
  status: 'valid' | 'invalid';
  transaction?: Partial<Transaction>;
  reason?: string;
  assetId?: string; // Manually assigned assetId or detected one
}

export const ImportService = {
  /**
   * Generates a hash/signature for CSV Headers to identify the format.
   * e.g., ["Date", "Description", "Amount"] -> "Date|Description|Amount"
   */
  generateHeaderHash: (headers: any[]): string => {
    // Take first 10 columns to form a signature, joined by pipe
    // Clean strings to improve matching (trim, lowercase?) -> Keeping it case-sensitive for now for precision
    return headers.slice(0, 10).map(h => String(h || '').trim()).join('|');
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
    // We don't update headerHash usually because the format ID key is the header.
    // But if we wanted to support 'renaming' or 're-hashing', we could. 
    // For now, only mapping update is safe.

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

  /**
   * Finds a preset that matches the given CSV headers.
   * Prioritizes presets bound to the specific targetAssetId.
   */
  findMatchingPreset: (headers: any[], targetAssetId?: string): ImportPreset | null => {
    const hash = ImportService.generateHeaderHash(headers);
    const presets = ImportService.getPresets();

    // 1. Try to find a preset specifically for this asset
    if (targetAssetId) {
      const strictMatch = presets.find(p => p.headerHash === hash && p.linkedAssetId === targetAssetId);
      if (strictMatch) return strictMatch;
    }

    // 2. Fallback to global preset (no linkedAssetId)
    // We strictly avoid returning a preset that belongs to a DIFFERENT asset.
    return presets.find(p => p.headerHash === hash && !p.linkedAssetId) || null;
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
    // Round timestamp to minute to handle slight OCR/CSV format differences
    // 60000ms = 1 minute
    const timeKey = Math.floor(timestamp / 60000);
    const raw = `${assetId}|${timeKey}|${amount}|${memo.trim()}`;

    // Simple hash function for browser environment
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  },

  /**
   * Reads a file (CSV or Excel) and returns raw 2D array data.
   * This is Step 1 of the wizard.
   */
  parseFileToGrid: async (file: File): Promise<any[][]> => {
    const buffer = await file.arrayBuffer();

    // Strategy 1: Prioritize Binary Read for Excel Files (.xls, .xlsx)
    // This prevents "TextDecoder" from corrupting binary BIFF8/ZIP content.
    if (file.name.match(/\.(xls|xlsx)$/i)) {
      try {
        console.log(`Detected Excel file (${file.name}), attempting binary read...`);
        // type: 'array' handles binary buffers (BIFF8, ZIP) correctly
        const workbook = read(buffer, { type: 'array', cellDates: true });

        if (workbook.SheetNames.length > 0) {
          const firstSheetName = workbook.SheetNames[0];
          const rows = utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1, defval: '' }) as any[][];
          if (rows.length > 0) return rows;
        }
      } catch (e) {
        console.warn("Binary Excel read failed, falling back to text decoding...", e);
      }
    }

    // Strategy 2: Text Decoding (CSV, HTML-as-XLS)
    // 1. Try UTF-8 with fatal: true checks for invalid sequences (usually robust)
    let decodedText = '';
    let encoding = 'utf-8';

    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decodedText = decoder.decode(buffer);
    } catch (e) {
      // 2. Fallback to EUC-KR (Common for Korean Bank CSVs)
      try {
        console.warn("UTF-8 decoding failed, trying EUC-KR/CP949");
        const decoder = new TextDecoder('euc-kr');
        decodedText = decoder.decode(buffer);
        encoding = 'euc-kr';
      } catch (err) {
        console.error("Failed to decode file locally, trying SheetJS binary fallback", err);
        // Fallback to reading as buffer and letting SheetJS guess (best effort)
        const workbook = read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        return utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1, defval: '' }) as any[][];
      }
    }

    // Pass the correctly decoded string to SheetJS
    const workbook = read(decodedText, { type: 'string', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON array of arrays (header: 1)
    const rows = utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    return rows;
  },

  /**
   * Internal helper to parse and validate a single row.
   * Extracted from the main loop to support real-time re-validation.
   */
  validateRow: (
    row: any[],
    index: number,
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
    categories: CategoryItem[] = []
  ): { transaction?: Partial<Transaction>, reason?: string } => {
    try {
      const dateVal = row[mapping.dateIndex];
      const memoVal = row[mapping.memoIndex];

      // Amount Resolution
      let amount = 0;
      let determinedType: TransactionType | null = null;

      if (mapping.amountInIndex !== undefined && mapping.amountInIndex >= 0 && mapping.amountOutIndex !== undefined && mapping.amountOutIndex >= 0) {
        const inVal = row[mapping.amountInIndex];
        const outVal = row[mapping.amountOutIndex];

        const parseAmt = (v: any) => {
          if (typeof v === 'number') return v;
          const s = String(v || '').trim();
          if (!s) return 0;
          return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
        };

        const inAmount = parseAmt(inVal);
        const outAmount = parseAmt(outVal);

        if (inAmount > 0) {
          amount = inAmount;
          determinedType = TransactionType.INCOME;
        } else if (outAmount > 0) {
          amount = outAmount;
          determinedType = TransactionType.EXPENSE;
        }
      } else {
        const amountVal = row[mapping.amountIndex];
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
      }

      // Asset Resolution
      let currentAssetId = defaultAssetId;
      if (mapping.assetIndex !== undefined && mapping.assetIndex >= 0) {
        const assetVal = String(row[mapping.assetIndex] || '').trim();
        if (assetVal) {
          const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
          const searchNorm = normalize(assetVal);
          const tokenize = (str: string) => str.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(t => t.length > 0);
          const searchTokens = tokenize(assetVal);

          let bestMatchId = null;
          let highestScore = 0;

          for (const a of assets) {
            const nameNorm = normalize(a.name);
            const instNorm = normalize(a.institution || '');
            const combinedNorm = instNorm + nameNorm;
            const accLast4 = a.accountNumber ? normalize(a.accountNumber).slice(-4) : '';

            // 1. Perfect matches (Full string)
            if (searchNorm === combinedNorm || searchNorm === nameNorm) {
              bestMatchId = a.id;
              highestScore = 999;
              break;
            }

            // 2. Token scoring
            let score = 0;
            const nameTokens = new Set(tokenize(a.name));
            const instTokens = new Set(tokenize(a.institution || ''));

            for (const token of searchTokens) {
              if (token.length < 2 && isNaN(Number(token))) continue;

              // Heavy weight for institution match
              if (instTokens.has(token)) {
                score += 30;
              }
              // Medium weight for name match
              else if (nameTokens.has(token)) {
                score += 15;
              }
              // Account number match (last 4 digits)
              else if (accLast4 && token.endsWith(accLast4)) {
                score += 50;
              }
              else {
                // Partial inclusion
                for (const nt of nameTokens) {
                  if (nt.length > 2 && token.length > 2 && (nt.includes(token) || token.includes(nt))) {
                    score += 5;
                    break;
                  }
                }
              }
            }

            // Inclusion bonuses
            if (nameNorm.length > 2 && searchNorm.includes(nameNorm)) score += 10;
            if (instNorm.length > 2 && searchNorm.includes(instNorm)) score += 20;

            if (score > highestScore) {
              highestScore = score;
              bestMatchId = a.id;
            }
          }

          if (bestMatchId && highestScore >= 10) {
            currentAssetId = bestMatchId;
          }
        }
      }

      if (currentAssetId === 'dynamic') throw new Error("Account not found");

      // Date Parsing
      const parseLooseDate = (val: any): Date | null => {
        if (val instanceof Date) return val;
        let s = String(val || '').trim();
        if (!s) return null;

        const complexMatch = s.match(/(\d{4})[\.\/\-년]\s*(\d{1,2})[\.\/\-월]\s*(\d{1,2})[일]?\s*(?:(오전|오후|AM|PM)\s*)?(\d{1,2})?:?(\d{1,2})?(?::(\d{1,2}))?/i);
        if (complexMatch) {
          let [_, y, m, d, meridiem, hourStr, min, sec] = complexMatch;
          let hour = hourStr ? parseInt(hourStr, 10) : 0;
          let minute = min ? parseInt(min, 10) : 0;
          let second = sec ? parseInt(sec, 10) : 0;
          if (meridiem) {
            if ((meridiem === '오후' || meridiem.toUpperCase() === 'PM') && hour < 12) hour += 12;
            if ((meridiem === '오전' || meridiem.toUpperCase() === 'AM') && hour === 12) hour = 0;
          }
          return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hour, minute, second);
        }

        const simpleDateMatch = s.match(/^(\d{4})\s*[\.\/\-년]\s*(\d{1,2})\s*[\.\/\-월]\s*(\d{1,2})[일]?/);
        if (simpleDateMatch) {
          const [_, y, m, d] = simpleDateMatch;
          return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        }

        const cleanS = s.replace(/[\.\/]/g, '-').replace(/\s/g, '');
        if (/^\d{8}$/.test(cleanS)) {
          return new Date(parseInt(cleanS.substring(0, 4)), parseInt(cleanS.substring(4, 6)) - 1, parseInt(cleanS.substring(6, 8)));
        }

        const dDate = new Date(s);
        return isNaN(dDate.getTime()) ? null : dDate;
      };

      const d = parseLooseDate(dateVal);
      if (!d) throw new Error("Invalid Date");

      const dateStr = d.toISOString().split('T')[0];
      const timestamp = d.getTime();

      // Merchant & Memo
      let merchantVal = undefined;
      let finalMemo = String(memoVal || '').trim();

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

      // Installment
      let installmentObj = undefined;
      if (mapping.installmentIndex !== undefined && mapping.installmentIndex >= 0) {
        const rawInst = String(row[mapping.installmentIndex] || '').trim();
        const monthsMatch = rawInst.match(/(\d+)/);
        if (monthsMatch) {
          const totalMonths = parseInt(monthsMatch[1], 10);
          if (totalMonths > 1) {
            installmentObj = {
              totalMonths,
              currentMonth: 1,
              isInterestFree: true,
              remainingBalance: Math.abs(amount)
            };
          }
        }
      }

      // Category
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

      // Build Transaction
      let type = determinedType || (amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME);
      const finalAmount = Math.abs(amount);

      return {
        transaction: {
          id: `imported-${Date.now()}-${index}`,
          date: dateStr,
          timestamp,
          amount: finalAmount,
          type,
          category: categoryVal,
          memo: finalMemo,
          merchant: merchantVal,
          installment: installmentObj,
          assetId: currentAssetId,
          originalText: finalMemo
        }
      };
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
    categories: CategoryItem[] = []
  ): ImportRow[] => {
    const rows: ImportRow[] = [];
    const baseHashCounts = new Map<string, number>();

    // Skip header row
    for (let i = 1; i < grid.length; i++) {
      const rawRowData = grid[i];
      if (!rawRowData || rawRowData.some(cell => cell !== '') === false) continue;

      const { transaction, reason } = ImportService.validateRow(rawRowData, i, mapping, defaultAssetId, assets, categories);

      if (transaction) {
        // Generate Unique HashKey for duplicate prevention
        const baseHash = ImportService.generateHashKey(
          transaction.assetId!,
          transaction.timestamp!,
          transaction.amount!,
          transaction.memo!
        );
        const currentCount = baseHashCounts.get(baseHash) || 0;
        baseHashCounts.set(baseHash, currentCount + 1);
        transaction.hashKey = `${baseHash}#${currentCount}`;

        rows.push({
          index: i,
          data: rawRowData,
          status: 'valid',
          transaction
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

  // (Keeping the rest of the legacy mapping for backward compatibility if needed, 
  // but we should eventually migrate ImportWizardModal to use mapRawDataToImportRows)
  mapRawDataToTransactions: (
    grid: any[][],
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
    categories: CategoryItem[] = []
  ): { valid: Partial<Transaction>[], invalid: any[] } => {
    const rows = ImportService.mapRawDataToImportRows(grid, mapping, defaultAssetId, assets, categories);
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
