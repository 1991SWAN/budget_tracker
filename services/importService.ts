import { Transaction, TransactionType, Category, CategoryItem } from '../types';
import { read, utils } from 'xlsx';

export interface ColumnMapping {
  dateIndex: number;
  amountIndex: number;
  memoIndex: number;
  typeIndex?: number;
  assetIndex?: number;
  categoryIndex?: number;
  merchantIndex?: number;
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

    // Encoding Detection Logic
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
        console.error("Failed to decode file", err);
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
   * Converts raw grid data into Draft Transactions using the user's Column Mapping.
   * This is Step 3 of the wizard (Preview).
   */
  /**
   * Maps raw grid data to transaction objects based on user selection.
   * Performs basic validation and parsing.
   */
  mapRawDataToTransactions: (
    grid: any[][],
    mapping: ColumnMapping,
    defaultAssetId: string,
    assets: any[] = [],
    categories: CategoryItem[] = []
  ): { valid: Partial<Transaction>[], invalid: any[] } => {
    const valid: Partial<Transaction>[] = [];
    const invalid: any[] = [];

    // Skip header row
    const startRow = 1;

    for (let i = startRow; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.length === 0) continue;

      try {
        // 1. Extract Values
        const dateVal = row[mapping.dateIndex];
        const memoVal = row[mapping.memoIndex];
        const amountVal = row[mapping.amountIndex];

        // Asset Resolution
        let currentAssetId = defaultAssetId;
        if (mapping.assetIndex !== undefined && mapping.assetIndex >= 0) {
          const assetVal = String(row[mapping.assetIndex] || '').trim();
          if (assetVal) {
            // Enhanced Fuzzy Matching
            // 1. Normalize both strings (lowercase, remove spaces & special chars)
            const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const searchNorm = normalize(assetVal);

            let bestMatchId = null;
            let highestScore = 0;

            // Iterate ALL assets to find the best candidate
            for (const a of assets) {
              let score = 0;

              const tokenize = (str: string) => str.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(t => t.length > 0);
              const nameTokens = new Set(tokenize(a.name));
              const corpusTokens = new Set([
                ...tokenize(a.description || ''),
                ...tokenize(a.institution || ''),
                ...tokenize(a.accountNumber || ''),
                ...(a.bankDetails?.isMainAccount ? ['main'] : [])
              ]);

              // 1. Exact Name Match (Instant Winner)
              const nameNorm = normalize(a.name);
              if (searchNorm === nameNorm) {
                bestMatchId = a.id;
                highestScore = 999;
                break;
              }

              // 2. Token Scoring
              const searchTokens = tokenize(assetVal);
              for (const token of searchTokens) {
                if (token.length < 2 && isNaN(Number(token))) continue;

                if (nameTokens.has(token)) {
                  score += 10;
                } else if (corpusTokens.has(token)) {
                  score += 5;
                } else {
                  // Partial match
                  for (const nt of nameTokens) {
                    if (nt.length > 2 && token.length > 2 && (nt.includes(token) || token.includes(nt))) {
                      score += 2;
                      break;
                    }
                  }
                }
              }

              // 3. Containment Boost
              if (nameNorm.length > 2 && searchNorm.includes(nameNorm)) {
                score += 15;
              }

              if (score > highestScore) {
                highestScore = score;
                bestMatchId = a.id;
              }

              if (score > 5) {
                console.log(`[Score] Candidate: ${a.name} (${score}) vs "${assetVal}"`);
              }
            }

            if (bestMatchId && highestScore >= 5) {
              currentAssetId = bestMatchId;
              console.log(`✅ MATCH SELECTED: Score ${highestScore}`);
            }
          }
        }

        if (currentAssetId === 'dynamic') {
          throw new Error("Missing or Unmatched Asset");
        }

        // 2. Validate & Parse Date
        let dateStr = '';
        let timestamp = 0;

        // 2. Validate & Parse Date (Robust)
        // 2. Validate & Parse Date (Robust)
        const parseLooseDate = (val: any): Date | null => {
          if (val instanceof Date) return val;
          if (!val) return null;
          let s = String(val).trim();

          // 1. Try to extract YYYY-MM-DD pattern first
          // Matches "2024/04/03 오후 8:13", "2025.05.01 14:00"
          const complexMatch = s.match(/(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})\s*(?:(오전|오후|AM|PM)\s*)?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/i);

          if (complexMatch) {
            let [_, y, m, d, meridiem, hourStr, min, sec] = complexMatch;
            let hour = parseInt(hourStr, 10);

            // Handle AM/PM
            if (meridiem) {
              if ((meridiem === '오후' || meridiem.toUpperCase() === 'PM') && hour < 12) hour += 12;
              if ((meridiem === '오전' || meridiem.toUpperCase() === 'AM') && hour === 12) hour = 0;
            }

            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hour, parseInt(min), sec ? parseInt(sec) : 0);
            return isNaN(date.getTime()) ? null : date;
          }

          // 2. Fallback: Standard Date-only Parsing
          const simpleDateMatch = s.match(/^(\d{4})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})/);

          if (simpleDateMatch) {
            const [_, y, m, d] = simpleDateMatch;
            // Return midnight date
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          }

          // 3. Fallback: Clean string and try standard Date constructor
          const cleanS = s.replace(/[\.\/]/g, '-').replace(/\s/g, '');
          if (/^\d{8}$/.test(cleanS)) {
            const y = parseInt(cleanS.substring(0, 4));
            const m = parseInt(cleanS.substring(4, 6)) - 1;
            const d = parseInt(cleanS.substring(6, 8));
            return new Date(y, m, d);
          }

          const d = new Date(s);
          return isNaN(d.getTime()) ? null : d;
        };

        const d = parseLooseDate(dateVal);
        if (d) {
          dateStr = d.toISOString().split('T')[0];
          timestamp = d.getTime();
        } else {
          // Try one more fallback for Excel serial dates if needed, but SheetJS usually handles them.
          // If SheetJS failed to parse cellDates: true, we might get the raw number here?
          // But existing code assumes string or Date.
          throw new Error(`Invalid Date Format: "${dateVal}"`);
        }

        // 3. Validate & Parse Amount
        let amount = 0;
        if (typeof amountVal === 'number') {
          amount = amountVal;
        } else {
          const cleanAmt = String(amountVal).replace(/[^0-9.-]/g, '');
          const parsedFloat = parseFloat(cleanAmt);
          if (isNaN(parsedFloat)) throw new Error("Invalid Amount");
          amount = parsedFloat;
        }

        // 4. Memo
        const memo = String(memoVal || '').trim();
        if (!memo) throw new Error("Empty Memo");

        // 5. Category (Optional)
        // If mapped, try to match by name, otherwise store raw string (legacy mode supports names)
        let categoryVal = Category.OTHER; // Default to Other
        // If we have categories provided, let's try to find "Other" ID or default
        // But Transaction.category expects ID or Name. 

        if (mapping.categoryIndex !== undefined && mapping.categoryIndex >= 0) {
          const rawCat = String(row[mapping.categoryIndex] || '').trim();
          if (rawCat) {
            // Try to find matching CategoryItem
            const match = categories.find(c => c.name.toLowerCase() === rawCat.toLowerCase());
            if (match) {
              categoryVal = match.id as any;
            } else {
              // If no ID match, store the raw name - the system might handle it or user can fix it
              categoryVal = rawCat as any;
            }
          }
        }

        // 6. Merchant (Optional)
        let merchantVal = undefined;
        if (mapping.merchantIndex !== undefined && mapping.merchantIndex >= 0) {
          merchantVal = String(row[mapping.merchantIndex] || '').trim();
        }

        // 7. Build Object
        // Fix: Determine type from sign, then store absolute amount.
        const type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        const finalAmount = Math.abs(amount);

        const hashKey = ImportService.generateHashKey(currentAssetId, timestamp, finalAmount, memo);

        valid.push({
          id: `imported-${Date.now()}-${i}`,
          date: dateStr,
          timestamp: timestamp,
          amount: finalAmount, // Always positive
          type: type,
          category: categoryVal,
          memo: memo,
          merchant: merchantVal,
          assetId: currentAssetId,
          hashKey: hashKey,
          originalText: memo
        });

      } catch (err) {
        invalid.push({ row: i + 1, data: row, reason: (err as Error).message });
      }
    }
    return { valid, invalid };
  },

  /**
   * Main logic for processing imported transactions.
   * 1. Filters duplicates via hashKey.
   * 2. Performs Transfer Matching Algorithm.
   */
  processImportedTransactions: (
    newTransactions: Partial<Transaction>[],
    existingTransactions: Transaction[]
  ): {
    finalNewTxs: Transaction[],
    updatedExistingTxs: Transaction[]
  } => {
    const finalNewTxs: Transaction[] = [];
    const updatedExistingTxs: Transaction[] = [];

    // Track hash keys to prevent duplicates
    const processedHashKeys = new Set(existingTransactions.map(t => t.hashKey).filter(Boolean));

    // CRITICAL FIX: Track IDs that have been matched IN THIS BATCH to prevent double-spending the same match
    const newlyMatchedIds = new Set<string>();

    for (const draftTx of newTransactions) {
      // 1. DUPLICATE CHECK
      if (draftTx.hashKey && processedHashKeys.has(draftTx.hashKey)) {
        console.log(`Skipping duplicate: ${draftTx.memo} (${draftTx.amount})`);
        continue;
      }
      processedHashKeys.add(draftTx.hashKey!);

      // Prepare the transaction object
      const newTx = { ...draftTx } as Transaction;

      // 2. TRANSFER MATCHING ALGORITHM
      // Look for a counterpart in existing transactions that is NOT already linked
      const matchCandidate = existingTransactions.find(existing => {
        if (existing.linkedTransactionId) return false; // Already persistently linked
        if (newlyMatchedIds.has(existing.id)) return false; // Already matched in this current loop! (Fix for Edge Case #1)

        const amountMatch = existing.amount === -newTx.amount;

        // Time diff check (5 minutes = 300,000 ms)
        const timeDiff = Math.abs((newTx.timestamp || 0) - (existing.timestamp || 0));
        const timeMatch = timeDiff <= 300000;

        return amountMatch && timeMatch;
      });

      if (matchCandidate) {
        // MATCH FOUND!
        console.log(`Transfer Match Found: ${newTx.memo} <-> ${matchCandidate.memo}`);

        // Mark as matched in this batch
        newlyMatchedIds.add(matchCandidate.id);

        // Update New Transaction
        newTx.type = TransactionType.TRANSFER;
        newTx.category = Category.TRANSFER;
        newTx.linkedTransactionId = matchCandidate.id;
        newTx.toAssetId = matchCandidate.assetId;
        newTx.toAssetId = matchCandidate.assetId;

        // Update Existing Transaction
        // We need to clone it to avoid mutating the prop directly before state update
        const updatedMatch = { ...matchCandidate };
        updatedMatch.type = TransactionType.TRANSFER;
        updatedMatch.category = Category.TRANSFER;
        updatedMatch.linkedTransactionId = newTx.id;
        updatedMatch.toAssetId = newTx.assetId;
        updatedMatch.toAssetId = newTx.assetId;

        updatedExistingTxs.push(updatedMatch);
      }

      finalNewTxs.push(newTx);
    }

    // 3. NEW-TO-NEW MATCHING (Self-Correction within the batch)
    // For transactions that didn't find a match in DB, they might match each other in this file.
    matchNewToNew(finalNewTxs);

    return { finalNewTxs, updatedExistingTxs };
  }
};

/**
 * Helper to match unmatched New transactions against each other.
 * (New-to-New Matching)
 */
function matchNewToNew(mainTxs: Transaction[]) {
  const matchedIds = new Set<string>();

  for (let i = 0; i < mainTxs.length; i++) {
    const txA = mainTxs[i];
    if (txA.linkedTransactionId || matchedIds.has(txA.id)) continue;

    for (let j = i + 1; j < mainTxs.length; j++) {
      const txB = mainTxs[j];
      if (txB.linkedTransactionId || matchedIds.has(txB.id)) continue;

      // 1. Amount Match (Inverse)
      if (txA.amount !== -txB.amount) continue;

      // 2. Time Match (5 mins)
      const timeDiff = Math.abs((txA.timestamp || 0) - (txB.timestamp || 0));
      if (timeDiff > 300000) continue;

      // MATCH FOUND!
      console.log(`New-to-New Match: ${txA.memo} <-> ${txB.memo}`);

      // Link A -> B
      txA.type = TransactionType.TRANSFER;
      txA.category = Category.TRANSFER;
      txA.linkedTransactionId = txB.id;
      txA.toAssetId = txB.assetId;

      // Link B -> A
      txB.type = TransactionType.TRANSFER;
      txB.category = Category.TRANSFER;
      txB.linkedTransactionId = txA.id;
      txB.toAssetId = txA.assetId;

      matchedIds.add(txA.id);
      matchedIds.add(txB.id);
      break; // Move to next txA
    }
  }
}
