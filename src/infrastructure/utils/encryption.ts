/**
 * Encryption Utility
 * 의료 데이터 암호화/복호화 (AES-256-GCM)
 *
 * CRITICAL: 모든 민감한 의료 정보(혈액형, 알레르기, 기저질환)는
 * 저장 전 반드시 암호화해야 함 (Ironclad Law #1: Code Integrity)
 *
 * Web Crypto API 사용 (브라우저 네이티브, 고성능)
 */

/**
 * 암호화 결과
 */
export interface EncryptedData {
  ciphertext: string;  // Base64 인코딩된 암호문
  iv: string;          // Base64 인코딩된 Initialization Vector
  salt: string;        // Base64 인코딩된 Salt (키 유도용)
}

/**
 * 환경변수에서 마스터 키 가져오기
 */
function getMasterKey(): string {
  const key = import.meta.env.VITE_ENCRYPTION_KEY;

  if (!key || key === 'your_32_byte_hex_encryption_key_here') {
    console.error(
      'CRITICAL: VITE_ENCRYPTION_KEY not configured! Medical data will NOT be encrypted properly.'
    );
    // 개발 환경용 임시 키 (절대 프로덕션에서 사용 금지)
    return 'dev_fallback_key_not_secure_replace_in_production';
  }

  return key;
}

/**
 * 패스워드에서 AES 키 유도 (PBKDF2)
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      // @ts-expect-error - TypeScript의 Web Crypto API 타입 정의 이슈로 인한 불가피한 타입 단언
      salt: salt,
      iterations: 100000, // 높은 반복 횟수로 무차별 대입 공격 방어
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 데이터 암호화
 *
 * @param plaintext 암호화할 평문
 * @returns 암호화된 데이터 (ciphertext + iv + salt)
 */
export async function encryptData(plaintext: string): Promise<EncryptedData> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // 랜덤 Salt 생성 (키 유도용)
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // 랜덤 IV 생성 (Initialization Vector)
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // GCM 모드는 12 바이트 권장

    // 마스터 키에서 암호화 키 유도
    const masterKey = getMasterKey();
    const cryptoKey = await deriveKey(masterKey, salt);

    // AES-GCM 암호화
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      cryptoKey,
      data
    );

    // Base64 인코딩하여 문자열로 변환
    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 데이터 복호화
 *
 * @param encryptedData 암호화된 데이터
 * @returns 복호화된 평문
 */
export async function decryptData(encryptedData: EncryptedData): Promise<string> {
  if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.salt) {
    throw new Error('Invalid encrypted data format');
  }

  try {
    // Base64 디코딩
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const salt = base64ToArrayBuffer(encryptedData.salt);

    // 마스터 키에서 복호화 키 유도
    const masterKey = getMasterKey();
    const cryptoKey = await deriveKey(masterKey, new Uint8Array(salt));

    // AES-GCM 복호화
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      cryptoKey,
      ciphertext
    );

    // ArrayBuffer → 문자열
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);

  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. Data may be corrupted or key is wrong.');
  }
}

/**
 * 간편 암호화 (문자열 → 문자열)
 * DB 저장용 단일 문자열 포맷: "iv:salt:ciphertext"
 */
export async function encryptString(plaintext: string): Promise<string> {
  const encrypted = await encryptData(plaintext);
  return `${encrypted.iv}:${encrypted.salt}:${encrypted.ciphertext}`;
}

/**
 * 간편 복호화 (문자열 → 문자열)
 */
export async function decryptString(encryptedString: string): Promise<string> {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format. Expected "iv:salt:ciphertext"');
  }

  const [iv, salt, ciphertext] = parts;
  return decryptData({ iv: iv!, salt: salt!, ciphertext: ciphertext! });
}

/**
 * 배열 암호화 (예: 알레르기 목록)
 */
export async function encryptArray(items: string[]): Promise<string> {
  const json = JSON.stringify(items);
  return encryptString(json);
}

/**
 * 배열 복호화
 */
export async function decryptArray(encryptedString: string): Promise<string[]> {
  const json = await decryptString(encryptedString);
  return JSON.parse(json) as string[];
}

/**
 * 객체 암호화 (예: 응급 연락처)
 */
export async function encryptObject<T extends Record<string, unknown>>(
  obj: T
): Promise<string> {
  const json = JSON.stringify(obj);
  return encryptString(json);
}

/**
 * 객체 복호화
 */
export async function decryptObject<T extends Record<string, unknown>>(
  encryptedString: string
): Promise<T> {
  const json = await decryptString(encryptedString);
  return JSON.parse(json) as T;
}

/**
 * ArrayBuffer → Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary);
}

/**
 * Base64 → ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 암호화 키 유효성 검증 (앱 시작 시 호출 권장)
 */
export async function validateEncryptionSetup(): Promise<boolean> {
  try {
    const testData = 'test_encryption_setup';
    const encrypted = await encryptString(testData);
    const decrypted = await decryptString(encrypted);

    if (decrypted !== testData) {
      console.error('Encryption validation failed: decrypted data does not match original');
      return false;
    }

    console.log('✅ Encryption setup validated successfully');
    return true;
  } catch (error) {
    console.error('Encryption validation failed:', error);
    return false;
  }
}
