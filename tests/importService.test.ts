import { describe, expect, it, vi } from 'vitest';
import { ColumnMapping, ImportGrid, ImportRow, ImportService } from '../services/importService';
import { Asset, AssetType, ImportReconciliationCandidate, TransactionType } from '../types';

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

const createCandidate = (overrides: Partial<ImportReconciliationCandidate> = {}): ImportReconciliationCandidate => ({
    id: 'db-candidate-1',
    assetId: 'asset-1',
    date: '2026-03-12',
    amount: 3000,
    type: TransactionType.INCOME,
    memo: '더스윙',
    timestamp: new Date('2026-03-12T09:00:00+09:00').getTime(),
    ...overrides,
});

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    name: '입출금통장',
    type: AssetType.CHECKING,
    balance: 0,
    initialBalance: 0,
    currency: 'KRW',
    institution: '국민은행',
    accountNumber: '1111',
    productName: '입출금통장',
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
        const candidates = [createCandidate({
            id: 'db-income-1',
            memo: '(주) 더스윙',
        })];

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
        const candidates = [createCandidate({
            id: 'db-income-1',
            memo: '2033434',
        })];

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
        const candidates = [createCandidate({
            id: 'db-income-1',
            memo: '204452070306',
            timestamp: sharedTimestamp,
            date: '2026-03-13',
        })];

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
        const candidates = [createCandidate({
            id: 'db-income-1',
            memo: '(주) 더스윙',
        })];

        const [result] = ImportService.reassignHashKeys([row], new Set([strictHash]), candidates);

        expect(result.status).toBe('duplicate');
        expect(result.replace_target_id).toBeUndefined();
        expect(result.review_candidates).toBeUndefined();
    });

    it('does not auto-select a replace target when multiple candidates are equally plausible', () => {
        const row = createIncomeRow();
        const sharedTimestamp = new Date('2026-03-12T09:00:00+09:00').getTime();
        const candidates = [
            createCandidate({
                id: 'db-income-1',
                memo: '더스윙',
                timestamp: sharedTimestamp,
            }),
            createCandidate({
                id: 'db-income-2',
                memo: '더스윙',
                timestamp: sharedTimestamp,
            })
        ];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBeUndefined();
        expect(result.reason).toBe('기존 수입 교체 후보 2건');
        expect(result.review_candidates).toHaveLength(2);
    });

    it('marks surviving expense rows as needs_review only when a DB expense matches in the same time key', () => {
        const row = createExpenseRow();
        const candidates = [createCandidate({
            id: 'db-expense-1',
            type: TransactionType.EXPENSE,
            memo: '주식회사더스윙',
            timestamp: new Date('2026-03-13T10:00:51+09:00').getTime(),
            date: '2026-03-13',
        })];

        const [result] = ImportService.reassignHashKeys([row], new Set(), candidates);

        expect(result.status).toBe('needs_review');
        expect(result.replace_target_id).toBe('db-expense-1');
        expect(result.reason).toBe('기존 지출 교체 후보 1건');
    });

    it('keeps expense rows valid when only the memo and amount match but the time key differs', () => {
        const row = createExpenseRow();
        const candidates = [createCandidate({
            id: 'db-expense-1',
            type: TransactionType.EXPENSE,
            memo: '주식회사더스윙',
            timestamp: new Date('2026-03-13T10:02:00+09:00').getTime(),
            date: '2026-03-13',
        })];

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
        const candidates = [createCandidate({
            id: 'db-expense-1',
            type: TransactionType.EXPENSE,
            memo: '204452070306',
            timestamp: sharedTimestamp,
            date: '2026-03-13',
        })];

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
            createCandidate({
                id: 'db-income-1',
                memo: '(주) 더스윙',
            })
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
            createCandidate({
                id: 'db-income-1',
                memo: '주식회사더스윙',
                timestamp: duplicateRow.transaction!.timestamp,
                date: duplicateRow.transaction!.date,
                hashKey: duplicateHash,
            })
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
            createCandidate({
                id: 'db-income-1',
                amount: 114600,
                memo: '크림　주식회사',
                timestamp: sharedTimestamp,
                date: '2025-06-13',
                hashKey: `${ImportService.generateHashKey(
                    incomeRow.transaction!.assetId!,
                    incomeRow.transaction!.timestamp!,
                    incomeRow.transaction!.amount!,
                    '크림　주식회사',
                    incomeRow.transaction!.type,
                    incomeRow.transaction!.toAssetId
                )}#0#0`,
            }),
            createCandidate({
                id: 'db-expense-1',
                amount: 114600,
                type: TransactionType.EXPENSE,
                memo: '크림　주식회사',
                timestamp: sharedTimestamp,
                date: '2025-06-13',
                hashKey: `${ImportService.generateHashKey(
                    expenseRow.transaction!.assetId!,
                    expenseRow.transaction!.timestamp!,
                    expenseRow.transaction!.amount!,
                    '크림　주식회사',
                    expenseRow.transaction!.type,
                    expenseRow.transaction!.toAssetId
                )}#0#1`,
            })
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

    it('parses xlsx files into separate raw and display grids when cells carry display formatting', async () => {
        const { utils, write } = await import('xlsx');
        const workbook = utils.book_new();
        const worksheet = utils.aoa_to_sheet([
            ['거래일자', '거래금액', '적요'],
            ['2026-03-13', 1234, '급여'],
        ]);

        worksheet.B2.z = '#,##0';
        utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const file = new File(
            [write(workbook, { bookType: 'xlsx', type: 'array' })],
            'sample.xlsx',
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );

        const result = await ImportService.parseFileToGrid(file);

        expect(result.rawGrid[0]).toEqual(['거래일자', '거래금액', '적요']);
        expect(result.rawGrid[1]).toEqual(['2026-03-13', 1234, '급여']);
        expect(result.displayGrid[1]).toEqual(['2026-03-13', '1,234', '급여']);
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

    it('maps realistic import grids into valid, split, and invalid import rows while skipping zero-amount rows', () => {
        const mapping: ColumnMapping = {
            dateIndex: 0,
            amountIndex: -1,
            memoIndex: 1,
            amountInIndex: 2,
            amountOutIndex: 3,
            assetIndex: 4,
            merchantIndex: 5,
            tagIndex: 6,
        };
        const assets: Asset[] = [
            createAsset(),
            createAsset({
                id: 'asset-2',
                name: '적금통장',
                accountNumber: '2222',
                productName: '적금통장',
            }),
        ];
        const grid: ImportGrid = [
            ['다운로드 정보', '2026-03-17'],
            ['거래일자', '적요', '입금', '출금', '계좌명', '거래처', '태그'],
            ['2026-03-13', '월급', '3200000', '', '입출금통장', '스마트컴퍼니', 'salary; monthly'],
            ['2026-03-14', '생활비 정산', '50000', '50000', '적금통장', '', 'shared'],
            ['2026-03-15', '0원 행', '0', '', '입출금통장', '', ''],
            ['bad-date', '파싱 오류', '1000', '', '입출금통장', '', ''],
        ];

        const rows = ImportService.mapRawDataToImportRows(grid, mapping, 'dynamic', assets, [], 1);

        expect(rows).toHaveLength(4);
        expect(rows.map(({ index, status, subIdx }) => ({ index, status, subIdx }))).toEqual([
            { index: 2, status: 'valid', subIdx: 0 },
            { index: 3, status: 'valid', subIdx: 0 },
            { index: 3, status: 'valid', subIdx: 1 },
            { index: 5, status: 'invalid', subIdx: 0 },
        ]);

        expect(rows[0].transaction).toEqual(expect.objectContaining({
            amount: 3200000,
            type: TransactionType.INCOME,
            assetId: 'asset-1',
            merchant: '스마트컴퍼니',
            tags: ['salary', 'monthly'],
        }));
        expect(rows[1].transaction).toEqual(expect.objectContaining({
            amount: 50000,
            type: TransactionType.INCOME,
            assetId: 'asset-2',
        }));
        expect(rows[2].transaction).toEqual(expect.objectContaining({
            amount: 50000,
            type: TransactionType.EXPENSE,
            assetId: 'asset-2',
        }));
        expect(rows[1].transaction?.hashKey).toMatch(/#0#0$/);
        expect(rows[2].transaction?.hashKey).toMatch(/#0#1$/);
        expect(rows[3]).toEqual(expect.objectContaining({
            status: 'invalid',
            reason: 'Invalid Date',
            data: grid[5],
        }));
    });
});
