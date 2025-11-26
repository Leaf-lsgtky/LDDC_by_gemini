// services/decryptor.ts

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
    if (!data) return new Uint8Array(0);
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
        if (!data || data.length <= 4) throw new Error("KRC Data too short or undefined");
        const sliced = data.slice(4);

        const xored = new Uint8Array(sliced.length);
        for (let i = 0; i < sliced.length; i++) {
            xored[i] = sliced[i] ^ KRC_KEY[i % KRC_KEY.length];
        }

        if (typeof pako === 'undefined') throw new Error("pako library not loaded");

        try {
            const decompressed = pako.inflate(xored);
            return new TextDecoder('utf-8').decode(decompressed);
        } catch (pakoErr) {
            console.error("KRC inflate error", pakoErr);
            return new TextDecoder('utf-8').decode(xored);
        }
    } catch (e) {
        console.error("KRC Decrypt Failed", e);
        throw e;
    }
}

// ==========================================
// QRC (QQ Music) - 使用自定义TripleDES实现
// ==========================================

const QRC_KEY = "!@#)(*$%123ZXC!@!@#)(NHL";

// DES S-boxes
const SBOX = [
    // sbox1
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
     0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
     4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
     15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
    // sbox2
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
     3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5,
     0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
     13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
    // sbox3
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
     13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
     13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
     1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
    // sbox4
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
     13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
     10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
     3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
    // sbox5
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
     14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
     4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
     11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
    // sbox6
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
     10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
     9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
     4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
    // sbox7
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
     13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
     1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
     6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
    // sbox8
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
     1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
     7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
     2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

const KEY_RND_SHIFT = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const KEY_PERM_C = [56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35];
const KEY_PERM_D = [62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3];
const KEY_COMPRESSION = [13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51, 30, 36,
                         46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31];

const ENCRYPT = 1;
const DECRYPT = 0;

function bitnum(a: Uint8Array, b: number, c: number): number {
    return ((a[Math.floor(b / 32) * 4 + 3 - Math.floor((b % 32) / 8)] >> (7 - b % 8)) & 1) << c;
}

function bitnum_intr(a: number, b: number, c: number): number {
    return ((a >>> (31 - b)) & 1) << c;
}

function bitnum_intl(a: number, b: number, c: number): number {
    return ((a << b) & 0x80000000) >>> c;
}

function sbox_bit(a: number): number {
    return (a & 32) | ((a & 31) >> 1) | ((a & 1) << 4);
}

function initial_permutation(input_data: Uint8Array): [number, number] {
    const s0 = (bitnum(input_data, 57, 31) | bitnum(input_data, 49, 30) | bitnum(input_data, 41, 29) | bitnum(input_data, 33, 28) |
         bitnum(input_data, 25, 27) | bitnum(input_data, 17, 26) | bitnum(input_data, 9, 25) | bitnum(input_data, 1, 24) |
         bitnum(input_data, 59, 23) | bitnum(input_data, 51, 22) | bitnum(input_data, 43, 21) | bitnum(input_data, 35, 20) |
         bitnum(input_data, 27, 19) | bitnum(input_data, 19, 18) | bitnum(input_data, 11, 17) | bitnum(input_data, 3, 16) |
         bitnum(input_data, 61, 15) | bitnum(input_data, 53, 14) | bitnum(input_data, 45, 13) | bitnum(input_data, 37, 12) |
         bitnum(input_data, 29, 11) | bitnum(input_data, 21, 10) | bitnum(input_data, 13, 9) | bitnum(input_data, 5, 8) |
         bitnum(input_data, 63, 7) | bitnum(input_data, 55, 6) | bitnum(input_data, 47, 5) | bitnum(input_data, 39, 4) |
         bitnum(input_data, 31, 3) | bitnum(input_data, 23, 2) | bitnum(input_data, 15, 1) | bitnum(input_data, 7, 0)) >>> 0;

    const s1 = (bitnum(input_data, 56, 31) | bitnum(input_data, 48, 30) | bitnum(input_data, 40, 29) | bitnum(input_data, 32, 28) |
         bitnum(input_data, 24, 27) | bitnum(input_data, 16, 26) | bitnum(input_data, 8, 25) | bitnum(input_data, 0, 24) |
         bitnum(input_data, 58, 23) | bitnum(input_data, 50, 22) | bitnum(input_data, 42, 21) | bitnum(input_data, 34, 20) |
         bitnum(input_data, 26, 19) | bitnum(input_data, 18, 18) | bitnum(input_data, 10, 17) | bitnum(input_data, 2, 16) |
         bitnum(input_data, 60, 15) | bitnum(input_data, 52, 14) | bitnum(input_data, 44, 13) | bitnum(input_data, 36, 12) |
         bitnum(input_data, 28, 11) | bitnum(input_data, 20, 10) | bitnum(input_data, 12, 9) | bitnum(input_data, 4, 8) |
         bitnum(input_data, 62, 7) | bitnum(input_data, 54, 6) | bitnum(input_data, 46, 5) | bitnum(input_data, 38, 4) |
         bitnum(input_data, 30, 3) | bitnum(input_data, 22, 2) | bitnum(input_data, 14, 1) | bitnum(input_data, 6, 0)) >>> 0;

    return [s0, s1];
}

function inverse_permutation(s0: number, s1: number): Uint8Array {
    const data = new Uint8Array(8);
    data[3] = (bitnum_intr(s1, 7, 7) | bitnum_intr(s0, 7, 6) | bitnum_intr(s1, 15, 5) |
               bitnum_intr(s0, 15, 4) | bitnum_intr(s1, 23, 3) | bitnum_intr(s0, 23, 2) |
               bitnum_intr(s1, 31, 1) | bitnum_intr(s0, 31, 0));
    data[2] = (bitnum_intr(s1, 6, 7) | bitnum_intr(s0, 6, 6) | bitnum_intr(s1, 14, 5) |
               bitnum_intr(s0, 14, 4) | bitnum_intr(s1, 22, 3) | bitnum_intr(s0, 22, 2) |
               bitnum_intr(s1, 30, 1) | bitnum_intr(s0, 30, 0));
    data[1] = (bitnum_intr(s1, 5, 7) | bitnum_intr(s0, 5, 6) | bitnum_intr(s1, 13, 5) |
               bitnum_intr(s0, 13, 4) | bitnum_intr(s1, 21, 3) | bitnum_intr(s0, 21, 2) |
               bitnum_intr(s1, 29, 1) | bitnum_intr(s0, 29, 0));
    data[0] = (bitnum_intr(s1, 4, 7) | bitnum_intr(s0, 4, 6) | bitnum_intr(s1, 12, 5) |
               bitnum_intr(s0, 12, 4) | bitnum_intr(s1, 20, 3) | bitnum_intr(s0, 20, 2) |
               bitnum_intr(s1, 28, 1) | bitnum_intr(s0, 28, 0));
    data[7] = (bitnum_intr(s1, 3, 7) | bitnum_intr(s0, 3, 6) | bitnum_intr(s1, 11, 5) |
               bitnum_intr(s0, 11, 4) | bitnum_intr(s1, 19, 3) | bitnum_intr(s0, 19, 2) |
               bitnum_intr(s1, 27, 1) | bitnum_intr(s0, 27, 0));
    data[6] = (bitnum_intr(s1, 2, 7) | bitnum_intr(s0, 2, 6) | bitnum_intr(s1, 10, 5) |
               bitnum_intr(s0, 10, 4) | bitnum_intr(s1, 18, 3) | bitnum_intr(s0, 18, 2) |
               bitnum_intr(s1, 26, 1) | bitnum_intr(s0, 26, 0));
    data[5] = (bitnum_intr(s1, 1, 7) | bitnum_intr(s0, 1, 6) | bitnum_intr(s1, 9, 5) |
               bitnum_intr(s0, 9, 4) | bitnum_intr(s1, 17, 3) | bitnum_intr(s0, 17, 2) |
               bitnum_intr(s1, 25, 1) | bitnum_intr(s0, 25, 0));
    data[4] = (bitnum_intr(s1, 0, 7) | bitnum_intr(s0, 0, 6) | bitnum_intr(s1, 8, 5) |
               bitnum_intr(s0, 8, 4) | bitnum_intr(s1, 16, 3) | bitnum_intr(s0, 16, 2) |
               bitnum_intr(s1, 24, 1) | bitnum_intr(s0, 24, 0));
    return data;
}

function des_f(state: number, key: number[]): number {
    const t1 = (bitnum_intl(state, 31, 0) | ((state & 0xf0000000) >>> 1) | bitnum_intl(state, 4, 5) |
          bitnum_intl(state, 3, 6) | ((state & 0x0f000000) >>> 3) | bitnum_intl(state, 8, 11) |
          bitnum_intl(state, 7, 12) | ((state & 0x00f00000) >>> 5) | bitnum_intl(state, 12, 17) |
          bitnum_intl(state, 11, 18) | ((state & 0x000f0000) >>> 7) | bitnum_intl(state, 16, 23)) >>> 0;

    const t2 = (bitnum_intl(state, 15, 0) | ((state & 0x0000f000) << 15) | bitnum_intl(state, 20, 5) |
          bitnum_intl(state, 19, 6) | ((state & 0x00000f00) << 13) | bitnum_intl(state, 24, 11) |
          bitnum_intl(state, 23, 12) | ((state & 0x000000f0) << 11) | bitnum_intl(state, 28, 17) |
          bitnum_intl(state, 27, 18) | ((state & 0x0000000f) << 9) | bitnum_intl(state, 0, 23)) >>> 0;

    const lrgstate = [
        ((t1 >>> 24) & 0xff) ^ key[0],
        ((t1 >>> 16) & 0xff) ^ key[1],
        ((t1 >>> 8) & 0xff) ^ key[2],
        ((t2 >>> 24) & 0xff) ^ key[3],
        ((t2 >>> 16) & 0xff) ^ key[4],
        ((t2 >>> 8) & 0xff) ^ key[5],
    ];

    let newState = ((SBOX[0][sbox_bit(lrgstate[0] >> 2)] << 28) |
             (SBOX[1][sbox_bit(((lrgstate[0] & 0x03) << 4) | (lrgstate[1] >> 4))] << 24) |
             (SBOX[2][sbox_bit(((lrgstate[1] & 0x0f) << 2) | (lrgstate[2] >> 6))] << 20) |
             (SBOX[3][sbox_bit(lrgstate[2] & 0x3f)] << 16) |
             (SBOX[4][sbox_bit(lrgstate[3] >> 2)] << 12) |
             (SBOX[5][sbox_bit(((lrgstate[3] & 0x03) << 4) | (lrgstate[4] >> 4))] << 8) |
             (SBOX[6][sbox_bit(((lrgstate[4] & 0x0f) << 2) | (lrgstate[5] >> 6))] << 4) |
             SBOX[7][sbox_bit(lrgstate[5] & 0x3f)]) >>> 0;

    return (bitnum_intl(newState, 15, 0) | bitnum_intl(newState, 6, 1) | bitnum_intl(newState, 19, 2) |
            bitnum_intl(newState, 20, 3) | bitnum_intl(newState, 28, 4) | bitnum_intl(newState, 11, 5) |
            bitnum_intl(newState, 27, 6) | bitnum_intl(newState, 16, 7) | bitnum_intl(newState, 0, 8) |
            bitnum_intl(newState, 14, 9) | bitnum_intl(newState, 22, 10) | bitnum_intl(newState, 25, 11) |
            bitnum_intl(newState, 4, 12) | bitnum_intl(newState, 17, 13) | bitnum_intl(newState, 30, 14) |
            bitnum_intl(newState, 9, 15) | bitnum_intl(newState, 1, 16) | bitnum_intl(newState, 7, 17) |
            bitnum_intl(newState, 23, 18) | bitnum_intl(newState, 13, 19) | bitnum_intl(newState, 31, 20) |
            bitnum_intl(newState, 26, 21) | bitnum_intl(newState, 2, 22) | bitnum_intl(newState, 8, 23) |
            bitnum_intl(newState, 18, 24) | bitnum_intl(newState, 12, 25) | bitnum_intl(newState, 29, 26) |
            bitnum_intl(newState, 5, 27) | bitnum_intl(newState, 21, 28) | bitnum_intl(newState, 10, 29) |
            bitnum_intl(newState, 3, 30) | bitnum_intl(newState, 24, 31)) >>> 0;
}

function des_crypt(input_data: Uint8Array, key: number[][]): Uint8Array {
    let [s0, s1] = initial_permutation(input_data);

    for (let idx = 0; idx < 15; idx++) {
        const previous_s1 = s1;
        s1 = (des_f(s1, key[idx]) ^ s0) >>> 0;
        s0 = previous_s1;
    }
    s0 = (des_f(s1, key[15]) ^ s0) >>> 0;

    return inverse_permutation(s0, s1);
}

function key_schedule(keyBytes: Uint8Array, mode: number): number[][] {
    const schedule: number[][] = Array.from({length: 16}, () => Array(6).fill(0));

    let c = 0;
    for (let i = 0; i < 28; i++) {
        c |= bitnum(keyBytes, KEY_PERM_C[i], 31 - i);
    }
    let d = 0;
    for (let i = 0; i < 28; i++) {
        d |= bitnum(keyBytes, KEY_PERM_D[i], 31 - i);
    }

    for (let i = 0; i < 16; i++) {
        c = (((c << KEY_RND_SHIFT[i]) | (c >>> (28 - KEY_RND_SHIFT[i]))) & 0xfffffff0) >>> 0;
        d = (((d << KEY_RND_SHIFT[i]) | (d >>> (28 - KEY_RND_SHIFT[i]))) & 0xfffffff0) >>> 0;

        const togen = mode === DECRYPT ? 15 - i : i;

        for (let j = 0; j < 6; j++) {
            schedule[togen][j] = 0;
        }

        for (let j = 0; j < 24; j++) {
            schedule[togen][Math.floor(j / 8)] |= bitnum_intr(c, KEY_COMPRESSION[j], 7 - (j % 8));
        }

        for (let j = 24; j < 48; j++) {
            schedule[togen][Math.floor(j / 8)] |= bitnum_intr(d, KEY_COMPRESSION[j] - 27, 7 - (j % 8));
        }
    }

    return schedule;
}

function tripledes_key_setup(keyStr: string, mode: number): number[][][] {
    const key = new Uint8Array(keyStr.length);
    for (let i = 0; i < keyStr.length; i++) {
        key[i] = keyStr.charCodeAt(i);
    }

    if (mode === ENCRYPT) {
        return [
            key_schedule(key.slice(0), ENCRYPT),
            key_schedule(key.slice(8), DECRYPT),
            key_schedule(key.slice(16), ENCRYPT)
        ];
    }
    return [
        key_schedule(key.slice(16), DECRYPT),
        key_schedule(key.slice(8), ENCRYPT),
        key_schedule(key.slice(0), DECRYPT)
    ];
}

function tripledes_crypt(data: Uint8Array, key: number[][][]): Uint8Array {
    let result = data;
    for (let i = 0; i < 3; i++) {
        result = des_crypt(result, key[i]);
    }
    return result;
}

// 缓存密钥调度
let cachedKeySchedule: number[][][] | null = null;

export function qrcDecrypt(data: Uint8Array): string {
    if (!data || data.length < 8) {
        throw new Error("QRC Input data too short (min 8 bytes)");
    }

    try {
        if (typeof pako === 'undefined') throw new Error("pako library not loaded");

        // 初始化密钥调度（缓存）
        if (!cachedKeySchedule) {
            cachedKeySchedule = tripledes_key_setup(QRC_KEY, DECRYPT);
        }

        // 以8字节为单位解密
        const decryptedData = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i += 8) {
            const block = data.slice(i, i + 8);
            // 确保块是8字节（填充0）
            const paddedBlock = new Uint8Array(8);
            paddedBlock.set(block);

            const decryptedBlock = tripledes_crypt(paddedBlock, cachedKeySchedule);
            decryptedData.set(decryptedBlock, i);
        }

        // Zlib解压
        const decompressed = pako.inflate(decryptedData);
        return new TextDecoder('utf-8').decode(decompressed);
    } catch (e: any) {
        console.error("[QRC] Decrypt error:", e.message);
        // Fallback: 尝试直接解压
        try {
            const decompressed = pako.inflate(data);
            return new TextDecoder('utf-8').decode(decompressed);
        } catch (zlibError) {
            throw e;
        }
    }
}

// 辅助函数
function convertWordArrayToUint8Array(wordArray: any) {
    const words = wordArray.words;
    let sigBytes = wordArray.sigBytes;
    if (sigBytes < 0) {
        sigBytes = words.length * 4;
    }

    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        u8[i] = byte;
    }
    return u8;
}
