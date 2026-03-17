import { describe, expect, it } from 'vitest';
import { formatTransactionDetailsInput, getTransactionTagNames, parseTransactionDetailsInput } from '../utils/transactionDetails';

describe('transactionDetails utilities', () => {
    it('parses details input into memo, merchant, and tags', () => {
        expect(parseTransactionDetailsInput('Lunch @Starbucks Gangnam #food #work')).toEqual({
            memo: 'Lunch',
            merchant: 'Starbucks Gangnam',
            tags: ['food', 'work'],
        });
    });

    it('round-trips quoted tags with spaces', () => {
        const formatted = formatTransactionDetailsInput({
            memo: 'Coffee',
            merchant: 'Blue Bottle',
            tags: ['coffee shop', 'team'],
        });

        expect(formatted).toBe('Coffee @Blue Bottle #"coffee shop" #team');
        expect(parseTransactionDetailsInput(formatted)).toEqual({
            memo: 'Coffee',
            merchant: 'Blue Bottle',
            tags: ['coffee shop', 'team'],
        });
    });

    it('normalizes tag arrays from strings and tag objects', () => {
        expect(getTransactionTagNames([
            'food',
            { name: 'food' },
            '#work',
            { name: 'coffee shop' },
        ])).toEqual(['food', 'work', 'coffee shop']);
    });
});
