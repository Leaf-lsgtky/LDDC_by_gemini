/**
 * LDDC Core Decryption Logic (Ported to TypeScript)
 * Requires: crypto-js, pako
 */

declare global {
    var CryptoJS: any;
    var pako: any;
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

const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

export function krcDecrypt(data: Uint8Array): string {
    try {
        // 1. Skip first 4 bytes
        if (!data || data.length <= 4) throw new Error("KRC Data too short");
        const sliced = data.slice(4);

        // 2. XOR
        const xored = new Uint8Array(sliced.length);
        for (let i = 0; i < sliced.length; i++) {
            xored[i] = sliced[i] ^ KRC_KEY[i % KRC_KEY.length];
        }

        // 3. Decompress (zlib)
        if (typeof pako === 'undefined') throw new Error("pako library not loaded");
        
        try {
            const decompressed = pako.inflate(xored);
            return new TextDecoder('utf-8').decode(decompressed);
        } catch (pakoErr) {
            console.error("KRC inflat error", pakoErr);
            // If inflate fails, maybe it's not compressed? Try decode directly
            return new TextDecoder('utf-8').decode(xored);
        }
    } catch (e) {
        console.error("KRC Decrypt Failed", e);
        throw e;
    }
}

// ==========================================
// QRC (QQ Music)
// ==========================================

const QRC_KEY_STR = "!@#)(*$%123ZXC!@!@#)(NHL";

export function qrcDecrypt(data: Uint8Array): string {
    // Fix: Ensure data is not empty/undefined before processing
    if (!data || data.length === 0) {
        throw new Error("QRC Input data is empty or undefined");
    }

    try {
        if (typeof CryptoJS === 'undefined') throw new Error("CryptoJS not loaded");
        if (typeof pako === 'undefined') throw new Error("pako library not loaded");

        // console.log(`[QRC Decrypt] Input size: ${data.length} bytes`);

        const wordArray = CryptoJS.lib.WordArray.create(data);
        const keyHex = CryptoJS.enc.Utf8.parse(QRC_KEY_STR);

        // Use NoPadding to prevent Pkcs7 errors. pako will ignore trailing garbage.
        const decrypted = CryptoJS.TripleDES.decrypt(
            { ciphertext: wordArray } as any,
            keyHex,
            {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.NoPadding 
            }
        );

        const decryptedBytes = convertWordArrayToUint8Array(decrypted);
        
        if (decryptedBytes.length === 0) {
             throw new Error("DES Decryption resulted in empty data");
        }

        // 5. Decompress
        // We wrap pako in a try-catch to provide specific logging
        try {
            const decompressed = pako.inflate(decryptedBytes);
            return new TextDecoder('utf-8').decode(decompressed);
        } catch (inflateErr) {
            throw inflateErr;
        }

    } catch (e) {
        // console.warn("QRC Decrypt Error:", e);
        
        // Fallback: Try direct decompression (sometimes data is just zlib compressed without DES)
        try {
            // console.log("[QRC Decrypt] Trying Direct Inflate Fallback...");
            const decompressed = pako.inflate(data);
            return new TextDecoder('utf-8').decode(decompressed);
        } catch (zlibError) {
            // console.error("QRC Decrypt Fallback Failed", zlibError);
            throw e;
        }
    }
}

function convertWordArrayToUint8Array(wordArray: any) {
    const words = wordArray.words;
    // With NoPadding, sigBytes might be unreliable or negative if crypto-js fails to calculate it purely.
    // We trust the word array length which represents the full block data.
    let sigBytes = wordArray.sigBytes;
    if (sigBytes < 0) {
        // If sigBytes is invalid, calculate from words length
        // Each word is 4 bytes
        sigBytes = words.length * 4;
    }

    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        u8[i] = byte;
    }
    return u8;
}
