import { describe, expect, it, vi } from 'vitest';
import {
    clearStorageByPrefix,
    CONCURRENT_LOGIN_LOGOUT_REASON,
    getStorageKeysByPrefix,
    LOGOUT_REASON_KEY,
    SMARTPENNY_DEVICE_ID_KEY,
    SMARTPENNY_STORAGE_PREFIX
} from '../utils/authStorage';

interface MockStorage {
    length: number;
    key: (index: number) => string | null;
    removeItem: (key: string) => void;
}

const createMockStorage = (keys: string[]): MockStorage => {
    const currentKeys = [...keys];

    return {
        get length() {
            return currentKeys.length;
        },
        key: (index: number) => currentKeys[index] ?? null,
        removeItem: vi.fn((key: string) => {
            const targetIndex = currentKeys.indexOf(key);
            if (targetIndex >= 0) {
                currentKeys.splice(targetIndex, 1);
            }
        }),
    };
};

describe('authStorage utilities', () => {
    it('collects only SmartPenny-prefixed localStorage keys', () => {
        const storage = createMockStorage([
            SMARTPENNY_DEVICE_ID_KEY,
            'smartpenny_import_presets',
            'third_party_theme',
        ]);

        expect(getStorageKeysByPrefix(storage, SMARTPENNY_STORAGE_PREFIX)).toEqual([
            SMARTPENNY_DEVICE_ID_KEY,
            'smartpenny_import_presets',
        ]);
    });

    it('clears only SmartPenny-prefixed localStorage keys and preserves unrelated keys', () => {
        const storage = createMockStorage([
            SMARTPENNY_DEVICE_ID_KEY,
            'smartpenny_transactions',
            'third_party_theme',
        ]);

        const removedKeys = clearStorageByPrefix(storage, SMARTPENNY_STORAGE_PREFIX);

        expect(removedKeys).toEqual([
            SMARTPENNY_DEVICE_ID_KEY,
            'smartpenny_transactions',
        ]);
        expect(storage.removeItem).toHaveBeenCalledTimes(2);
        expect(storage.removeItem).toHaveBeenNthCalledWith(1, SMARTPENNY_DEVICE_ID_KEY);
        expect(storage.removeItem).toHaveBeenNthCalledWith(2, 'smartpenny_transactions');
        expect(getStorageKeysByPrefix(storage, SMARTPENNY_STORAGE_PREFIX)).toEqual([]);
        expect(storage.key(0)).toBe('third_party_theme');
    });

    it('exposes stable auth-session constants', () => {
        expect(LOGOUT_REASON_KEY).toBe('logout_reason');
        expect(CONCURRENT_LOGIN_LOGOUT_REASON).toBe('concurrent_login');
    });
});
