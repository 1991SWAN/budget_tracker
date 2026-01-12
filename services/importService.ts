import { Transaction, TransactionType, Category } from '../types';
import { read, utils } from 'xlsx';

export interface ColumnMapping {
  dateIndex: number;
  amountIndex: number;
  memoIndex: number;
  // Optional: typeIndex for cases where Income/Expense is a separate column
  typeIndex?: number;
}

export const ImportService = {
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
    const workbook = read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON array of arrays (header: 1)
    // defval: '' limits issues with empty cells
    const rows = utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    return rows;
  },

  /**
   * Converts raw grid data into Draft Transactions using the user's Column Mapping.
   * This is Step 3 of the wizard (Preview).
   */
  mapRawDataToTransactions: (
    rawData: any[][],
    mapping: ColumnMapping,
    assetId: string
  ): { valid: Partial<Transaction>[], invalid: any[] } => {
    const valid: Partial<Transaction>[] = [];
    const invalid: any[] = [];

    // Skip header row (index 0) - or maybe user selects if header exists?
    // For now assume row 0 is header if it looks like strings, but better to just parse all selected rows.
    // Let's assume the wizard passes DATA rows (slicing done in UI) or we just iterate from 1.
    // SAFE DEFAULT: Iterate from 1, assume row 0 is header.
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      try {
        // 1. Extract Values based on Mapping
        const dateVal = row[mapping.dateIndex];
        const memoVal = row[mapping.memoIndex];
        const amountVal = row[mapping.amountIndex];

        // 2. Validate & Parse Date
        let dateStr = '';
        let timestamp = 0;

        if (dateVal instanceof Date) {
          dateStr = dateVal.toISOString().split('T')[0];
          timestamp = dateVal.getTime();
        } else {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
            timestamp = d.getTime();
          } else {
            throw new Error("Invalid Date");
          }
        }

        // 3. Validate & Parse Amount
        let amount = 0;
        if (typeof amountVal === 'number') {
          amount = amountVal;
        } else {
          // Handle string inputs like "1,000", "-500", "$10.00"
          const cleanAmt = String(amountVal).replace(/[^0-9.-]/g, '');
          const parsedFloat = parseFloat(cleanAmt);
          if (isNaN(parsedFloat)) throw new Error("Invalid Amount");
          amount = parsedFloat;
        }

        // 4. Memo
        const memo = String(memoVal || '').trim();
        if (!memo) throw new Error("Empty Memo");

        // 5. Build Object
        const type = amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
        // Normalize hash key
        const hashKey = ImportService.generateHashKey(assetId, timestamp, amount, memo);

        valid.push({
          id: `imported-${Date.now()}-${i}`,
          date: dateStr,
          timestamp: timestamp,
          amount: amount,
          type: type,
          category: Category.OTHER,
          memo: memo,
          assetId: assetId,
          hashKey: hashKey,
          originalText: memo
        });

      } catch (err) {
        // Capture invalid rows for feedback
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
