import { Transaction, TransactionType, Category } from '../types';

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
   * Parses a CSV string into partial Transaction objects.
   * Assumes columns: Date (YYYY-MM-DD HH:mm), Description, Amount
   */
  parseCSV: (csvContent: string, assetId: string): Partial<Transaction>[] => {
    const lines = csvContent.split('\n');
    const parsed: Partial<Transaction>[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV split (Note: robust CSV parsing should handle quoted commas)
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      
      // Assuming Format: Date, Description, Amount
      // Adjust indices based on actual bank CSV format
      if (cols.length < 3) continue;

      const dateStr = cols[0]; // Expecting YYYY-MM-DD HH:mm or similar
      const memo = cols[1];
      const amount = parseFloat(cols[2]);

      if (isNaN(amount)) continue;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) continue;

      const timestamp = dateObj.getTime();
      const type = amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
      
      const hashKey = ImportService.generateHashKey(assetId, timestamp, amount, memo);

      parsed.push({
        id: `imported-${Date.now()}-${i}`,
        date: dateStr.split(' ')[0], // YYYY-MM-DD
        timestamp: timestamp,
        amount: amount,
        type: type,
        category: Category.OTHER, // Default, allow user to categorize later
        memo: memo,
        assetId: assetId,
        hashKey: hashKey,
        originalText: memo
      });
    }
    return parsed;
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
        newTx.emoji = '💸';

        // Update Existing Transaction
        // We need to clone it to avoid mutating the prop directly before state update
        const updatedMatch = { ...matchCandidate };
        updatedMatch.type = TransactionType.TRANSFER;
        updatedMatch.category = Category.TRANSFER;
        updatedMatch.linkedTransactionId = newTx.id;
        updatedMatch.toAssetId = newTx.assetId;
        updatedMatch.emoji = '💸';

        updatedExistingTxs.push(updatedMatch);
      } 

      finalNewTxs.push(newTx);
    }

    return { finalNewTxs, updatedExistingTxs };
  }
};
