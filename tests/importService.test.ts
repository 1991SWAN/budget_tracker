import { describe, expect, it, vi } from 'vitest';
import { ImportRow, ImportService } from '../services/importService';
import { TransactionType } from '../types';

const createIncomeRow = (overrides: Partial<ImportRow> = {}): ImportRow => ({
    index: 1,
    data: [],
    status: 'valid',
    subIdx: 0,
    transaction: {
        id: 'import-1',
        date: '2026-03-13',
        timestamp: new Date('2026-03-13T10:00:00+09:00').getTime(),
        amount: 3000,
        type: TransactionType.INCOME,
        category: 'income-other',
        memo: '주식회사 더스윙',
        assetId: 'asset-1',
    },
    ...overrides,
});

const createExpenseRow = (overrides: Partial<ImportRow> = {}): ImportRow => ({
    index: 1,
    data: [],
    status: 'valid',
    subIdx: 0,
    transaction: {
        id: 'import-expense-1',
        date: '2026-03-13',
        timestamp: new Date('2026-03-13T10:00:24+09:00').getTime(),
        amount: 3000,
        type: TransactionType.EXPENSE,
        category: 'expense-other',
        memo: '주식회사 더스윙',
        assetId: 'asset-1',
    },
    ...overrides,
});

describe('ImportService needs review rules', () => {
    it('normalizes review memos with unicode, spaces, and business suffix noise removed', () => {
        expect(ImportService.normalizeReviewMemo('  （주） 더 스윙  ')).toBe('더스윙');
        expect(ImportService.normalizeReviewMemo('주식회사더스윙')).toBe('더스윙');
        expect(ImportService.normalizeReviewMemo('The Corp, Inc.')).toBe('the');
    });

    it('marks surviving income rows as needs_review when an older DB income matches asset, amount, and normalized memo', () => {
        const row = createIncomeRow();
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '(주) 더스윙',
                timestamp: new Date('2026-03-12T09:00:00+09:00').getTime(),
                date: '2026-03-12',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-income-1');
        expect(result.review_candidates).toEqual([
            expect.objectContaining({
                id: 'db-income-1',
                memo: '(주) 더스윙',
            })
        ]);
    });

    it('matches income review candidates when numeric memos differ only by leading zeros', () => {
        const row = createIncomeRow({
            transaction: {
                ...createIncomeRow().transaction!,
                memo: '02033434',
            }
        });
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '2033434',
                timestamp: new Date('2026-03-12T09:00:00+09:00').getTime(),
                date: '2026-03-12',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-income-1');
        expect(result.reason).toBe('기존 수입 교체 후보 1건');
    });

    it('keeps same-timestamp income rows eligible for needs_review when numeric memos differ only by leading zeros', () => {
        const sharedTimestamp = new Date('2026-03-13T10:00:00+09:00').getTime();
        const row = createIncomeRow({
            transaction: {
                ...createIncomeRow().transaction!,
                timestamp: sharedTimestamp,
                memo: '0204452070306',
            }
        });
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '204452070306',
                timestamp: sharedTimestamp,
                date: '2026-03-13',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-income-1');
    });

    it('keeps strict duplicates out of needs_review even when review candidates exist', () => {
        const row = createIncomeRow();
        const tx = row.transaction!;
        const strictHash = `${ImportService.generateHashKey(
            tx.assetId!,
            tx.timestamp!,
            tx.amount!,
            tx.memo!,
            tx.type,
            tx.toAssetId
        )}#0#0`;
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '(주) 더스윙',
                timestamp: new Date('2026-03-12T09:00:00+09:00').getTime(),
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set([strictHash]), candidates);

        expect(result.status).toBe('duplicate');
        expect(result.replace_target_id).toBeUndefined();
        expect(result.review_candidates).toBeUndefined();
    });

    it('does not auto-select a replace target when multiple candidates are equally plausible', () => {
        const row = createIncomeRow();
        const sharedTimestamp = new Date('2026-03-12T09:00:00+09:00').getTime();
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '더스윙',
                timestamp: sharedTimestamp,
                date: '2026-03-12',
            },
            {
                id: 'db-income-2',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '더스윙',
                timestamp: sharedTimestamp,
                date: '2026-03-12',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBeUndefined();
        expect(result.reason).toBe('기존 수입 교체 후보 2건');
        expect(result.review_candidates).toHaveLength(2);
    });

    it('marks surviving expense rows as needs_review only when a DB expense matches in the same time key', () => {
        const row = createExpenseRow();
        const candidates = [
            {
                id: 'db-expense-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.EXPENSE,
                memo: '주식회사더스윙',
                timestamp: new Date('2026-03-13T10:00:51+09:00').getTime(),
                date: '2026-03-13',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-expense-1');
        expect(result.reason).toBe('기존 지출 교체 후보 1건');
    });

    it('keeps expense rows valid when only the memo and amount match but the time key differs', () => {
        const row = createExpenseRow();
        const candidates = [
            {
                id: 'db-expense-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.EXPENSE,
                memo: '주식회사더스윙',
                timestamp: new Date('2026-03-13T10:02:00+09:00').getTime(),
                date: '2026-03-13',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('valid');
        expect(result.replace_target_id).toBeUndefined();
        expect(result.review_candidates).toBeUndefined();
    });

    it('matches expense review candidates when numeric memos differ only by leading zeros', () => {
        const sharedTimestamp = new Date('2026-03-13T10:00:00+09:00').getTime();
        const row = createExpenseRow({
            transaction: {
                ...createExpenseRow().transaction!,
                timestamp: sharedTimestamp,
                memo: '0204452070306',
            }
        });
        const candidates = [
            {
                id: 'db-expense-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.EXPENSE,
                memo: '204452070306',
                timestamp: sharedTimestamp,
                date: '2026-03-13',
            }
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-expense-1');
        expect(result.reason).toBe('기존 지출 교체 후보 1건');
    });

    it('clears auto-selected replace targets when the same DB income is proposed for multiple uploaded rows', () => {
        const first = createIncomeRow({
            index: 1,
            transaction: {
                ...createIncomeRow().transaction!,
                id: 'import-1',
                timestamp: new Date('2026-03-13T10:00:00+09:00').getTime(),
            }
        });
        const second = createIncomeRow({
            index: 2,
            transaction: {
                ...createIncomeRow().transaction!,
                id: 'import-2',
                timestamp: new Date('2026-03-13T11:00:00+09:00').getTime(),
            }
        });
        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '(주) 더스윙',
                timestamp: new Date('2026-03-12T09:00:00+09:00').getTime(),
                date: '2026-03-12',
            }
        ];

        const results = ImportService.reassignHashKeys([first, second], new Set(), candidates);

        expect(results).toHaveLength(2);
        results.forEach(result => {
            expect(result.status).toBe('needs_review');
            expect(result.replace_target_id).toBeUndefined();
            expect(result.reason).toBe('교체 후보 충돌 - 직접 선택 필요');
        });
    });

    it('excludes DB rows already consumed by strict duplicates from later needs_review checks', () => {
        const duplicateRow = createIncomeRow({
            transaction: {
                ...createIncomeRow().transaction!,
                id: 'import-duplicate',
            }
        });
        const reviewRow = createIncomeRow({
            index: 2,
            transaction: {
                ...createIncomeRow().transaction!,
                id: 'import-review',
                timestamp: new Date('2026-03-14T10:00:00+09:00').getTime(),
            }
        });

        const duplicateHash = `${ImportService.generateHashKey(
            duplicateRow.transaction!.assetId!,
            duplicateRow.transaction!.timestamp!,
            duplicateRow.transaction!.amount!,
            duplicateRow.transaction!.memo!,
            duplicateRow.transaction!.type,
            duplicateRow.transaction!.toAssetId
        )}#0#0`;

        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 3000,
                type: TransactionType.INCOME,
                memo: '주식회사더스윙',
                timestamp: duplicateRow.transaction!.timestamp,
                date: duplicateRow.transaction!.date,
                hash_key: duplicateHash,
            }
        ];

        const results = ImportService.reassignHashKeys([duplicateRow, reviewRow], new Set([duplicateHash]), candidates);

        expect(results[0].status).toBe('duplicate');
        expect(results[1].status).toBe('valid');
        expect(results[1].replace_target_id).toBeUndefined();
    });

    it('does not let an outgoing row consume the incoming DB candidate when direction differs', () => {
        const sharedTimestamp = new Date('2025-06-13T10:18:03+09:00').getTime();
        const incomeRow = createIncomeRow({
            index: 224,
            transaction: {
                ...createIncomeRow().transaction!,
                id: 'import-income',
                date: '2025-06-13',
                timestamp: sharedTimestamp,
                amount: 114600,
                memo: '크림 주식회사',
            }
        });
        const expenseRow = createExpenseRow({
            index: 225,
            subIdx: 1,
            transaction: {
                ...createExpenseRow().transaction!,
                id: 'import-expense',
                date: '2025-06-13',
                timestamp: sharedTimestamp,
                amount: 114600,
                memo: '크림 주식회사',
            }
        });

        const dbHashBank = new Set([
            `${ImportService.generateHashKey(
                expenseRow.transaction!.assetId!,
                expenseRow.transaction!.timestamp!,
                expenseRow.transaction!.amount!,
                expenseRow.transaction!.memo!,
                expenseRow.transaction!.type,
                expenseRow.transaction!.toAssetId
            )}#0#1`,
        ]);

        const candidates = [
            {
                id: 'db-income-1',
                asset_id: 'asset-1',
                amount: 114600,
                type: TransactionType.INCOME,
                memo: '크림　주식회사',
                timestamp: sharedTimestamp,
                date: '2025-06-13',
                hash_key: `${ImportService.generateHashKey(
                    incomeRow.transaction!.assetId!,
                    incomeRow.transaction!.timestamp!,
                    incomeRow.transaction!.amount!,
                    '크림　주식회사',
                    incomeRow.transaction!.type,
                    incomeRow.transaction!.toAssetId
                )}#0#0`,
            },
            {
                id: 'db-expense-1',
                asset_id: 'asset-1',
                amount: 114600,
                type: TransactionType.EXPENSE,
                memo: '크림　주식회사',
                timestamp: sharedTimestamp,
                date: '2025-06-13',
                hash_key: `${ImportService.generateHashKey(
                    expenseRow.transaction!.assetId!,
                    expenseRow.transaction!.timestamp!,
                    expenseRow.transaction!.amount!,
                    '크림　주식회사',
                    expenseRow.transaction!.type,
                    expenseRow.transaction!.toAssetId
                )}#0#1`,
            }
        ];

        const [incomeResult, expenseResult] = ImportService.reassignHashKeys([incomeRow, expenseRow], dbHashBank, candidates);

        expect(incomeResult.status).toBe('needs_review');
        expect(incomeResult.replace_target_id).toBe('db-income-1');
        expect(expenseResult.status).toBe('duplicate');
    });
});

describe('ImportService type mapping', () => {
    it('maps a positive amount row to EXPENSE when the explicit type column says withdrawal', () => {
        const result = ImportService.validateRow(
            ['2026-03-13', '점심', '12,000', '출금'],
            1,
            {
                dateIndex: 0,
                memoIndex: 1,
                amountIndex: 2,
                typeIndex: 3,
            } as any,
            'asset-1'
        );

        expect(result.reason).toBeUndefined();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions?.[0]).toEqual(expect.objectContaining({
            amount: 12000,
            type: TransactionType.EXPENSE,
        }));
    });

    it('maps a positive amount row to a transfer row when explicit type and destination account are present', () => {
        const result = ImportService.validateRow(
            ['2026-03-13', '계좌 이동', '50,000', '이체', '적금통장'],
            1,
            {
                dateIndex: 0,
                memoIndex: 1,
                amountIndex: 2,
                typeIndex: 3,
                toAssetIndex: 4,
            } as any,
            'asset-1',
            [
                { id: 'asset-1', productName: '입출금통장', institution: '국민은행', accountNumber: '1111' },
                { id: 'asset-2', productName: '적금통장', institution: '국민은행', accountNumber: '2222' },
            ]
        );

        expect(result.reason).toBeUndefined();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions?.[0]).toEqual(expect.objectContaining({
            amount: 50000,
            type: TransactionType.TRANSFER,
            assetId: 'asset-1',
            toAssetId: 'asset-2',
        }));
    });

    it('maps transfer rows with an empty destination cell as incoming-side transfer rows', () => {
        const result = ImportService.validateRow(
            ['2026-03-13', '계좌 이동', '50,000', '이체', 'null'],
            1,
            {
                dateIndex: 0,
                memoIndex: 1,
                amountIndex: 2,
                typeIndex: 3,
                toAssetIndex: 4,
            } as any,
            'asset-1'
        );

        expect(result.reason).toBeUndefined();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions?.[0]).toEqual(expect.objectContaining({
            amount: 50000,
            type: TransactionType.TRANSFER,
            assetId: 'asset-1',
            toAssetId: undefined,
        }));
    });

    it('rejects transfer rows when the destination account column is not mapped', () => {
        const result = ImportService.validateRow(
            ['2026-03-13', '계좌 이동', '50,000', '이체'],
            1,
            {
                dateIndex: 0,
                memoIndex: 1,
                amountIndex: 2,
                typeIndex: 3,
            } as any,
            'asset-1'
        );

        expect(result.transactions).toBeUndefined();
        expect(result.reason).toBe('Transfer requires destination account column');
    });

    it('does not misread account-like labels as transaction types', () => {
        expect(ImportService.parseTransactionTypeValue('입출금통장')).toBeNull();
        expect(ImportService.parseTransactionTypeValue('카카오뱅크체크')).toBeNull();
    });

    it('suggests typeIndex for columns that look like transaction type labels', () => {
        const result = ImportService.analyzeColumns([
            ['거래구분', '거래금액', '적요', '거래일자'],
            ['입금', '10000', '용돈', '2026-03-13'],
            ['출금', '5000', '점심', '2026-03-14'],
            ['이체', '30000', '저축 이동', '2026-03-15'],
        ]);

        expect(result.columns[0]).toEqual(expect.objectContaining({
            suggestedField: 'typeIndex',
        }));
    });

    it('keeps imported merchant and tags structured instead of appending them to memo', () => {
        const result = ImportService.validateRow(
            ['2026-03-13', 'Coffee with client', '12,000', 'Blue Bottle Gangnam', 'coffee shop; client'],
            1,
            {
                dateIndex: 0,
                memoIndex: 1,
                amountIndex: 2,
                merchantIndex: 3,
                tagIndex: 4,
            } as any,
            'asset-1'
        );

        expect(result.reason).toBeUndefined();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions?.[0]).toEqual(expect.objectContaining({
            memo: 'Coffee with client',
            merchant: 'Blue Bottle Gangnam',
            tags: ['coffee shop', 'client'],
        }));
    });

    it('parses csv files via array-buffer fallback even when TextDecoder is unavailable', async () => {
        const originalTextDecoder = globalThis.TextDecoder;
        vi.stubGlobal('TextDecoder', class {
            constructor() {
                throw new Error('TextDecoder should not be used for CSV parsing');
            }
        });

        try {
            const file = new File(
                ['date,amount,memo\n2026-03-13,1000,Sample\n'],
                'sample.csv',
                { type: 'text/csv' }
            );

            const result = await ImportService.parseFileToGrid(file);

            expect(result.rawGrid[0]).toEqual(['date', 'amount', 'memo']);
            expect(result.rawGrid[1][1]).toBe(1000);
            expect(result.displayGrid[1][1]).toBe('1000');
            expect(result.displayGrid[1][2]).toBe('Sample');
        } finally {
            vi.stubGlobal('TextDecoder', originalTextDecoder);
        }
    });
});
