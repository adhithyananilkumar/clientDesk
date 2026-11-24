import 'expo-sqlite/localStorage/install';

import type { SupportedStorage } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the signed-in session lives on the device.
 *
 * A Supabase session is far larger than SecureStore's ~2 KB value limit, so it
 * is stored encrypted: a fresh AES-256 key is generated for every write and kept
 * in the platform keychain (SecureStore); only the ciphertext goes into SQLite
 * `localStorage`. Reading the session needs both halves.
 */
class EncryptedSessionStorage implements SupportedStorage {
  async getItem(key: string): Promise<string | null> {
    const ciphertext = localStorage.getItem(key);
    if (!ciphertext) return null;

    try {
      const keyHex = await SecureStore.getItemAsync(key);
      if (!keyHex) return null;

      const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(ciphertext)));
    } catch {
      // Unreadable (e.g. keychain was reset): treat as signed out rather than crash.
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = Crypto.getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    localStorage.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
  }

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    localStorage.removeItem(key);
  }
}

export const authStorage: SupportedStorage = new EncryptedSessionStorage();
