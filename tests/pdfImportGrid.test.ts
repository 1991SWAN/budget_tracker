import { describe, expect, it } from 'vitest';
import { buildPdfImportGrid } from '../utils/pdfImportGrid';

describe('buildPdfImportGrid', () => {
    it('groups positioned text items into stable rows and columns', () => {
        const grid = buildPdfImportGrid([
            {
                items: [
                    { str: 'Date', transform: [1, 0, 0, 12, 10, 700], width: 24, height: 12 },
                    { str: 'Details', transform: [1, 0, 0, 12, 120, 700], width: 42, height: 12 },
                    { str: 'Amount', transform: [1, 0, 0, 12, 360, 700], width: 40, height: 12 },
                    { str: '2026-03-01', transform: [1, 0, 0, 12, 10, 680], width: 60, height: 12 },
                    { str: 'Starbucks', transform: [1, 0, 0, 12, 120, 680], width: 54, height: 12 },
                    { str: 'Gangnam', transform: [1, 0, 0, 12, 182, 680], width: 42, height: 12 },
                    { str: '-6,500', transform: [1, 0, 0, 12, 360, 680], width: 38, height: 12 },
                    { str: '2026-03-02', transform: [1, 0, 0, 12, 10, 660], width: 60, height: 12 },
                    { str: 'Payroll', transform: [1, 0, 0, 12, 120, 660], width: 42, height: 12 },
                    { str: '1,200,000', transform: [1, 0, 0, 12, 360, 660], width: 55, height: 12 },
                ],
            },
        ]);

        expect(grid).toEqual([
            ['Date', 'Details', 'Amount'],
            ['2026-03-01', 'Starbucks Gangnam', '-6,500'],
            ['2026-03-02', 'Payroll', '1,200,000'],
        ]);
    });

    it('appends rows across multiple pages while keeping column alignment', () => {
        const grid = buildPdfImportGrid([
            {
                items: [
                    { str: '2026-03-01', transform: [1, 0, 0, 12, 10, 700], width: 60, height: 12 },
                    { str: 'Coffee', transform: [1, 0, 0, 12, 120, 700], width: 36, height: 12 },
                    { str: '-4,900', transform: [1, 0, 0, 12, 350, 700], width: 40, height: 12 },
                ],
            },
            {
                items: [
                    { str: '2026-03-02', transform: [1, 0, 0, 12, 10, 700], width: 60, height: 12 },
                    { str: 'Lunch', transform: [1, 0, 0, 12, 120, 700], width: 30, height: 12 },
                    { str: '-12,000', transform: [1, 0, 0, 12, 350, 700], width: 45, height: 12 },
                ],
            },
        ]);

        expect(grid).toEqual([
            ['2026-03-01', 'Coffee', '-4,900'],
            ['2026-03-02', 'Lunch', '-12,000'],
        ]);
    });

    it('merges merchant continuation rows back into the previous transaction row', () => {
        const grid = buildPdfImportGrid([
            {
                items: [
                    { str: '03/01', transform: [1, 0, 0, 8, 10, 300], width: 24, height: 8 },
                    { str: 'Mega', transform: [1, 0, 0, 8, 60, 300], width: 20, height: 8 },
                    { str: 'Coffee', transform: [1, 0, 0, 8, 60, 293], width: 26, height: 8 },
                    { str: '4,900', transform: [1, 0, 0, 8, 180, 300], width: 22, height: 8 },
                ],
            },
        ]);

        expect(grid).toEqual([
            ['03/01', 'Mega Coffee', '4,900'],
        ]);
    });

    it('keeps nearby numeric statement columns separate from merchant text', () => {
        const grid = buildPdfImportGrid([
            {
                items: [
                    { str: '09/14', transform: [1, 0, 0, 8, 10, 300], width: 24, height: 8 },
                    { str: 'KT SHOP(', transform: [1, 0, 0, 8, 60, 304], width: 42, height: 8 },
                    { str: '장기무이자)', transform: [1, 0, 0, 8, 103, 304], width: 34, height: 8 },
                    { str: '스마트', transform: [1, 0, 0, 8, 140, 304], width: 20, height: 8 },
                    { str: '1,638,100', transform: [1, 0, 0, 8, 180, 300], width: 27, height: 8 },
                    { str: '24', transform: [1, 0, 0, 8, 221, 300], width: 8, height: 8 },
                    { str: '18', transform: [1, 0, 0, 8, 244, 300], width: 7, height: 8 },
                    { str: '68,254', transform: [1, 0, 0, 8, 282, 300], width: 20, height: 8 },
                    { str: '68,254', transform: [1, 0, 0, 8, 424, 300], width: 20, height: 8 },
                    { str: '409,524', transform: [1, 0, 0, 8, 459, 300], width: 24, height: 8 },
                    { str: '로-주식회사케', transform: [1, 0, 0, 8, 60, 296], width: 44, height: 8 },

                    { str: '03/01', transform: [1, 0, 0, 8, 10, 280], width: 24, height: 8 },
                    { str: '선결제-KT SHOP', transform: [1, 0, 0, 8, 60, 280], width: 62, height: 8 },
                    { str: '1', transform: [1, 0, 0, 8, 246, 280], width: 4, height: 8 },
                    { str: '-68,254', transform: [1, 0, 0, 8, 280, 280], width: 23, height: 8 },
                    { str: '-68,254', transform: [1, 0, 0, 8, 422, 280], width: 23, height: 8 },

                    { str: '12/08', transform: [1, 0, 0, 8, 10, 260], width: 24, height: 8 },
                    { str: 'NICE_와디즈', transform: [1, 0, 0, 8, 60, 260], width: 44, height: 8 },
                    { str: '616,850', transform: [1, 0, 0, 8, 189, 260], width: 23, height: 8 },
                    { str: '5', transform: [1, 0, 0, 8, 223, 260], width: 4, height: 8 },
                    { str: '3', transform: [1, 0, 0, 8, 246, 260], width: 4, height: 8 },
                    { str: '123,370', transform: [1, 0, 0, 8, 280, 260], width: 22, height: 8 },
                    { str: '123,370', transform: [1, 0, 0, 8, 423, 260], width: 22, height: 8 },
                    { str: '246,740', transform: [1, 0, 0, 8, 459, 260], width: 24, height: 8 },

                    { str: '03/01', transform: [1, 0, 0, 8, 10, 240], width: 24, height: 8 },
                    { str: '선결제-NICE', transform: [1, 0, 0, 8, 60, 240], width: 52, height: 8 },
                    { str: '1', transform: [1, 0, 0, 8, 246, 240], width: 4, height: 8 },
                    { str: '-123,370', transform: [1, 0, 0, 8, 278, 240], width: 24, height: 8 },
                    { str: '-123,370', transform: [1, 0, 0, 8, 421, 240], width: 24, height: 8 },

                    { str: '02/10', transform: [1, 0, 0, 8, 10, 220], width: 24, height: 8 },
                    { str: 'AMZ DOWNLOADER', transform: [1, 0, 0, 8, 60, 220], width: 62, height: 8 },
                    { str: '10,307', transform: [1, 0, 0, 8, 193, 220], width: 19, height: 8 },
                    { str: '30', transform: [1, 0, 0, 8, 330, 220], width: 8, height: 8 },
                    { str: '10,337', transform: [1, 0, 0, 8, 426, 220], width: 19, height: 8 },
                ],
            },
        ]);

        expect(grid[0].slice(0, 6)).toEqual([
            '이용 일자',
            '이용가맹점',
            '이용금액',
            '기간',
            '회차',
            '청구금액',
        ]);

        const installmentRow = grid.find(row => row[0] === '09/14');
        const recurringRow = grid.find(row => row[0] === '12/08');

        expect(installmentRow?.[1]).toContain('KT SHOP(');
        expect(installmentRow?.[1]).toContain('로-주식회사케');
        expect(installmentRow?.[2]).toBe('1,638,100');
        expect(installmentRow?.[3]).toBe('24');
        expect(installmentRow?.[4]).toBe('18');
        expect(installmentRow).toContain('68,254');
        expect(installmentRow).toContain('409,524');
        expect(installmentRow?.some(cell => cell.includes('1,638,100 24'))).toBe(false);

        expect(recurringRow?.[1]).toContain('NICE_와디즈');
        expect(recurringRow?.[2]).toBe('616,850');
        expect(recurringRow?.[3]).toBe('5');
        expect(recurringRow?.[4]).toBe('3');
        expect(recurringRow).toContain('123,370');
        expect(recurringRow).toContain('246,740');
        expect(recurringRow?.some(cell => cell.includes('616,850 5'))).toBe(false);
    });
});
