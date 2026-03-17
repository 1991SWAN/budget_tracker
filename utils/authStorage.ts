export const SMARTPENNY_STORAGE_PREFIX = 'smartpenny_';
export const SMARTPENNY_DEVICE_ID_KEY = `${SMARTPENNY_STORAGE_PREFIX}device_id`;
export const LOGOUT_REASON_KEY = 'logout_reason';
export const CONCURRENT_LOGIN_LOGOUT_REASON = 'concurrent_login';

interface StorageKeyReader {
    length: number;
    key: (index: number) => string | null;
}

interface StorageKeyRemover extends StorageKeyReader {
    removeItem: (key: string) => void;
}

export const getStorageKeysByPrefix = (
    storage: StorageKeyReader,
    prefix: string
): string[] => {
    const keys: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(prefix)) {
            keys.push(key);
        }
    }

    return keys;
};

export const clearStorageByPrefix = (
    storage: StorageKeyRemover,
    prefix: string
): string[] => {
    const keys = getStorageKeysByPrefix(storage, prefix);
    keys.forEach(key => storage.removeItem(key));
    return keys;
};
