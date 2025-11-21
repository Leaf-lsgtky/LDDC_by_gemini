
/**
 * LDDC Core Decryption Logic (Ported to TypeScript)
 * Requires: crypto-js, pako
 */

declare global {
    const CryptoJS: any;
    const pako: any;
}

// ==========================================
// QMC1 (QQ Music)
// ==========================================

const QMC_PRIVKEY = [
    0xc3, 0x4a, 0xd6, 0xca, 0x90, 0x67, 0xf7, 0x52,
    0xd8, 0xa1, 0x66, 0x62, 0x9f, 0x5b, 0x09, 0x00,
    0xc3, 0x5e, 0x95, 0x23, 0x9f, 0x13, 0x11, 0x7e,
    0xd8, 0x92, 0x3f, 0xbc, 0x90, 0xbb, 0x74, 0x0e,
    0xc3, 0x47, 0x74, 0x3d, 0x90, 0xaa, 0x3f, 0x51,
    0xd8, 0xf4, 0x11, 0x84, 0x9f, 0xde, 0x95, 0x1d,
    0xc3, 0xc6, 0x09, 0xd5, 0x9f, 0xfa, 0x66, 0xf9,
    0xd8, 0xf0, 0xf7, 0xa0, 0x90, 0xa1, 0xd6, 0xf3,
    0xc3, 0xf3, 0xd6, 0xa1, 0x90, 0xa0, 0xf7, 0xf0,
    0xd8, 0xf9, 0x66, 0xfa, 0x9f, 0xd5, 0x09, 0xc6,
    0xc3, 0x1d, 0x95, 0xde, 0x9f, 0x84, 0x11, 0xf4,
    0xd8, 0x51, 0x3f, 0xaa, 0x90, 0x3d, 0x74, 0x47,
    0xc3, 0x0e, 0x74, 0xbb, 0x90, 0xbc, 0x3f, 0x92,
    0xd8, 0x7e, 0x11, 0x13, 0x9f, 0x23, 0x95, 0x5e,
    0xc3, 0x00, 0x09, 0x5b, 0x9f, 0x62, 0x66, 0xa1,
    0xd8, 0x52, 0xf7, 0x67, 0x90, 0xca, 0xd6, 0x4a,
];

export function qmc1Decrypt(data: Uint8Array): Uint8Array {
    for (let i = 0; i < data.length; i++) {
        let keyIndex;
        if (i > 0x7FFF) {
            keyIndex = (i % 0x7FFF) & 0x7F;
        } else {
            keyIndex = i & 0x7F;
        }
        data[i] ^= QMC_PRIVKEY[keyIndex];
    }
    return data;
}

// ==========================================
// KRC (Kugou)
// ==========================================

// b"@Gaw^2tGQ61-\xce\xd2ni"
const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

export function krcDecrypt(data: Uint8Array): string {
    try {
        // 1. Skip first 4 bytes
        if (data.length <= 4) throw new Error("Data too short");
        const sliced = data.slice(4);

        // 2. XOR
        const xored = new Uint8Array(sliced.length);
        for (let i = 0; i < sliced.length; i++) {
            xored[i] = sliced[i] ^ KRC_KEY[i % KRC_KEY.length];
        }

        // 3. Decompress (zlib)
        if (typeof pako === 'undefined') throw new Error("pako library not loaded");
        const decompressed = pako.inflate(xored);
        
        // 4. Decode UTF-8
        return new TextDecoder('utf-8').decode(decompressed);
    } catch (e) {
        console.error("KRC Decrypt Failed", e);
        throw e;
    }
}

// ==========================================
// QRC (QQ Music)
// ==========================================

// b"!@#)(*$%123ZXC!@!@#)(NHL"
const QRC_KEY_STR = "!@#)(*$%123ZXC!@!@#)(NHL";

export function qrcDecrypt(data: Uint8Array): string {
    try {
        if (typeof CryptoJS === 'undefined') throw new Error("CryptoJS not loaded");
        if (typeof pako === 'undefined') throw new Error("pako library not loaded");

        // 1. Convert Uint8Array to WordArray for CryptoJS
        const wordArray = CryptoJS.lib.WordArray.create(data);
        
        // 2. Key parsing
        const keyHex = CryptoJS.enc.Utf8.parse(QRC_KEY_STR);

        // 3. TripleDES Decrypt (ECB Mode)
        const decrypted = CryptoJS.TripleDES.decrypt(
            { ciphertext: wordArray } as any,
            keyHex,
            {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        // 4. Convert back to Uint8Array
        const decryptedBytes = convertWordArrayToUint8Array(decrypted);

        // 5. Decompress
        const decompressed = pako.inflate(decryptedBytes);

        // 6. Decode
        return new TextDecoder('utf-8').decode(decompressed);
    } catch (e) {
        console.error("QRC Decrypt Failed", e);
        throw e;
    }
}

function convertWordArrayToUint8Array(wordArray: any) {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        u8[i] = byte;
    }
    return u8;
}
