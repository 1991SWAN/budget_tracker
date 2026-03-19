import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportService } from '../services/importService';

const getDocument = vi.fn();
const globalWorkerOptions = { workerSrc: '' };

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    GlobalWorkerOptions: globalWorkerOptions,
    getDocument,
}));

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({
    default: '/pdf.worker.min.mjs',
}));

describe('ImportService.parseFileToGrid pdf support', () => {
    beforeEach(() => {
        getDocument.mockReset();
    });

    it('parses text-based PDF files into identical raw and display grids', async () => {
        const cleanup = vi.fn();

        getDocument.mockReturnValue({
            promise: Promise.resolve({
                numPages: 1,
                getPage: vi.fn().mockResolvedValue({
                    getTextContent: vi.fn().mockResolvedValue({
                        items: [
                            { str: 'Date', transform: [1, 0, 0, 12, 10, 700], width: 24, height: 12 },
                            { str: 'Details', transform: [1, 0, 0, 12, 120, 700], width: 42, height: 12 },
                            { str: 'Amount', transform: [1, 0, 0, 12, 360, 700], width: 40, height: 12 },
                            { str: '2026-03-01', transform: [1, 0, 0, 12, 10, 680], width: 60, height: 12 },
                            { str: 'Lunch', transform: [1, 0, 0, 12, 120, 680], width: 30, height: 12 },
                            { str: '-12,000', transform: [1, 0, 0, 12, 360, 680], width: 45, height: 12 },
                        ],
                    }),
                    cleanup,
                }),
            }),
            destroy: vi.fn().mockResolvedValue(undefined),
        });

        const file = new File([new Uint8Array([1, 2, 3])], 'statement.pdf', { type: 'application/pdf' });
        const result = await ImportService.parseFileToGrid(file);

        expect(getDocument).toHaveBeenCalledTimes(1);
        expect(globalWorkerOptions.workerSrc).toBe('/pdf.worker.min.mjs');
        expect(result.rawGrid).toEqual([
            ['Date', 'Details', 'Amount'],
            ['2026-03-01', 'Lunch', '-12,000'],
        ]);
        expect(result.displayGrid).toEqual(result.rawGrid);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('collapses PDF preamble rows into a synthesized header aligned to transaction columns', async () => {
        const cleanup = vi.fn();

        getDocument.mockReturnValue({
            promise: Promise.resolve({
                numPages: 1,
                getPage: vi.fn().mockResolvedValue({
                    getTextContent: vi.fn().mockResolvedValue({
                        items: [
                            { str: 'Statement', transform: [1, 0, 0, 12, 260, 760], width: 48, height: 12 },
                            { str: '이용', transform: [1, 0, 0, 12, 10, 700], width: 20, height: 12 },
                            { str: '이용가맹점', transform: [1, 0, 0, 12, 120, 700], width: 54, height: 12 },
                            { str: '이용금액', transform: [1, 0, 0, 12, 220, 700], width: 42, height: 12 },
                            { str: '일자', transform: [1, 0, 0, 12, 10, 690], width: 20, height: 12 },
                            { str: '03/01', transform: [1, 0, 0, 12, 10, 670], width: 30, height: 12 },
                            { str: 'Coffee', transform: [1, 0, 0, 12, 60, 670], width: 36, height: 12 },
                            { str: '4,900', transform: [1, 0, 0, 12, 220, 670], width: 26, height: 12 },
                            { str: '03/02', transform: [1, 0, 0, 12, 10, 650], width: 30, height: 12 },
                            { str: 'Lunch', transform: [1, 0, 0, 12, 60, 650], width: 30, height: 12 },
                            { str: '12,000', transform: [1, 0, 0, 12, 220, 650], width: 32, height: 12 },
                            { str: '03/03', transform: [1, 0, 0, 12, 10, 630], width: 30, height: 12 },
                            { str: 'Taxi', transform: [1, 0, 0, 12, 60, 630], width: 24, height: 12 },
                            { str: '18,500', transform: [1, 0, 0, 12, 220, 630], width: 34, height: 12 },
                            { str: '03/04', transform: [1, 0, 0, 12, 10, 610], width: 30, height: 12 },
                            { str: 'Books', transform: [1, 0, 0, 12, 60, 610], width: 30, height: 12 },
                            { str: '9,900', transform: [1, 0, 0, 12, 220, 610], width: 26, height: 12 },
                            { str: '03/05', transform: [1, 0, 0, 12, 10, 590], width: 30, height: 12 },
                            { str: 'Market', transform: [1, 0, 0, 12, 60, 590], width: 38, height: 12 },
                            { str: '25,000', transform: [1, 0, 0, 12, 220, 590], width: 34, height: 12 },
                        ],
                    }),
                    cleanup,
                }),
            }),
            destroy: vi.fn().mockResolvedValue(undefined),
        });

        const file = new File([new Uint8Array([1, 2, 3])], 'statement.pdf', { type: 'application/pdf' });
        const result = await ImportService.parseFileToGrid(file);

        expect(result.rawGrid).toEqual([
            ['이용 일자', '이용가맹점', '이용금액'],
            ['03/01', 'Coffee', '4,900'],
            ['03/02', 'Lunch', '12,000'],
            ['03/03', 'Taxi', '18,500'],
            ['03/04', 'Books', '9,900'],
            ['03/05', 'Market', '25,000'],
        ]);
    });
});
