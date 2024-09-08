import crypto from "crypto";
import moment from "moment";
import JSZip from "jszip";
import {BattleLog} from "./models";

const HASH_KEY = "62AE221E4C5D4CAD4B851D7380F4ED2C"
const LOG_TOKEN_KEY = "pM6Umv*^hVQuB6t&";

export function now() {
    return moment().unix()
}

export function get_md5(str: string):string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export function u8_sign(data: { [key: string]: any }): string {
    let sign_str = Object.entries(data).map(([k, v]) => `${k}=${v}`).join("&");
    const secretKey = '91240f70c09a08a6bc72af1a5c8d4670';
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(sign_str);
    return hmac.digest('hex');
}

export function get_random_devices(): { deviceId: string, deviceId2: string, deviceId3: string } {
    const deviceId = get_md5(''.concat(Array.from({length: 12}, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    const deviceId2 = '85' + ''.concat(Array.from({length: 13}, () => Math.floor(Math.random() * 10).toString()).join(''));
    const deviceId3 = get_md5(''.concat(Array.from({length: 12}, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    return {deviceId, deviceId2, deviceId3}
}

export function mergeDict(old: any, newDict: any, key = "modify"): void {
    for (const k in newDict) {
        if (old[k] !== undefined) {
            if (typeof newDict[k] !== 'object') {
                if (key == "modify") {
                    old[k] = newDict[k];
                } else if (key == "delete") {
                    delete old[k]
                }
                continue;
            }
            mergeDict(old[k], newDict[k], key);
        } else {
            old[k] = newDict[k];
        }
    }
}

export function decryptBattleData(data: string, loginTime: number) {
    const battleData = Buffer.from(data.slice(0, data.length - 32), 'hex');
    const src = LOG_TOKEN_KEY + loginTime.toString();
    const key = crypto.createHash('md5').update(src).digest();
    const iv = Buffer.from(data.slice(data.length - 32), 'hex');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    let decryptedData = decipher.update(battleData);
    let decrypt = Buffer.concat([decryptedData, decipher.final()]).toString();
    return JSON.parse(decrypt)
}

export function encryptBattleData(data: any, loginTime: number): string {
    const jsonData = JSON.stringify(data);
    const src = LOG_TOKEN_KEY + loginTime.toString();
    const key = crypto.createHash('md5').update(src).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encryptedData = cipher.update(jsonData, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    return encryptedData + iv.toString('hex');
}

export function encryptIsCheat(battleId: string): string {
    return btoa(Buffer.from(battleId).map(v => v + 7).toString())
}

export function decryptIsCheat(isCheat: string): string {
    return Buffer.from(isCheat, "base64").map(v => v - 7).toString()
}

export function getBattleDataAccess(loginTime: number): string {
    return get_md5(HASH_KEY + loginTime).toUpperCase()
}

export async function decryptBattleReplay(battleReplay: string): Promise<BattleLog> {
    const data = Buffer.from(battleReplay, 'base64');
    const zip = await new JSZip().loadAsync(data)
    return JSON.parse(await zip.files["default_entry"].async("string"));
}
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoices<T>(arr: T[], weights: number[], k: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < k; i++) {
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (let j = 0; j < arr.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                result.push(arr[j]);
                break;
            }
        }
    }
    return result;
}

export function randomSample<T>(arr: T[], k: number): T[] {
    return arr.sort(() => 0.5 - Math.random()).slice(0, k);
}

export function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
export function sleep(time: number) {
    return new Promise(resolve =>
        setTimeout(resolve, time)
    )
}

export const log = console.log

export function select_tags(tags: number[]): [number[], number, number] {
    let selected: number[] = [], sp = 0, duration_ = 32400
    if (tags.includes(11)) {
        sp = 11;  // 6
    } else if (tags.includes(14)) {
        sp = 14;  // 5
        selected = [14];
    } else if (tags.includes(27)) {
        selected = [27];
    } else if (tags.includes(7) && tags.includes(12)) {
        selected = [7, 12];
    } else if (tags.includes(7) && tags.includes(20)) {
        selected = [7, 20];
    } else if (tags.includes(7) && tags.includes(23)) {
        selected = [7, 23];
    } else if (tags.includes(7) && tags.includes(24)) {
        selected = [7, 24];
    } else if (tags.includes(26) && tags.includes(19)) {
        selected = [26, 19];
    } else if (tags.includes(26) && tags.includes(22)) {
        selected = [26, 22];
    } else if (tags.includes(26) && tags.includes(3)) {
        selected = [26, 3];
    } else if (tags.includes(26) && tags.includes(23)) {
        selected = [26, 23];
    } else if (tags.includes(25) && tags.includes(12)) {
        selected = [25, 12];
    } else if (tags.includes(25) && tags.includes(24)) {
        selected = [25, 24];
    } else if (tags.includes(21) && tags.includes(24)) {
        selected = [21, 24];
    } else if (tags.includes(9) && tags.includes(24)) {
        selected = [9, 24];
    } else if (tags.includes(4) && tags.includes(24)) {
        selected = [4, 24];
    } else if (tags.includes(13) && tags.includes(21)) {
        selected = [13, 21];
    } else if (tags.includes(13) && tags.includes(6)) {
        selected = [4, 24];
    } else if (tags.includes(13) && tags.includes(19) && tags.includes(10)) {
        selected = [13, 19, 10];
    } else if (tags.includes(13) && tags.includes(19) && tags.includes(2)) {
        selected = [13, 19, 2];
    } else if (tags.includes(12) && tags.includes(8)) {
        selected = [12, 8];
    } else if (tags.includes(12) && tags.includes(18)) {
        selected = [12, 18];
    } else if (tags.includes(12) && tags.includes(23)) {
        selected = [12, 23];
    } else if (tags.includes(16) && tags.includes(8)) {
        selected = [16, 8];
    } else if (tags.includes(16) && tags.includes(18)) {
        selected = [16, 18];
    } else if (tags.includes(16) && tags.includes(5)) {
        selected = [16, 5];
    } else if (tags.includes(16) && tags.includes(20)) {
        selected = [16, 20];
    } else if (tags.includes(15) && tags.includes(6)) {
        selected = [15, 6];
    } else if (tags.includes(15) && tags.includes(19)) {
        selected = [15, 19];
    } else if (tags.includes(23) && tags.includes(19) && tags.includes(6)) {
        selected = [23, 19, 6];
    } else if (tags.includes(19) && tags.includes(5)) {
        selected = [19, 5];
    } else if (tags.includes(19) && tags.includes(21)) {
        selected = [19, 21];
    } else if (tags.includes(19) && tags.includes(3)) {
        selected = [19, 3];
    } else if (tags.includes(22) && tags.includes(1)) {
        selected = [22, 1];
    } else if (tags.includes(22) && tags.includes(6)) {
        selected = [22, 6];
    } else if (tags.includes(22) && tags.includes(10)) {
        selected = [22, 10];
    } else if (tags.includes(22) && tags.includes(21)) {
        selected = [22, 21];
    } else if (tags.includes(20) && tags.includes(22)) {
        selected = [20, 22];
    } else if (tags.includes(20) && tags.includes(3)) {
        selected = [20, 3];
    } else if (tags.includes(20) && tags.includes(5)) {
        selected = [20, 5];
    } else if (tags.includes(7)) {
        selected = [7];  // 4
    } else if (tags.includes(26)) {
        selected = [26];
    } else if (tags.includes(24)) {
        selected = [24];
    } else if (tags.includes(25)) {
        selected = [25];
    } else if (tags.includes(12)) {
        selected = [12];
    } else if (tags.includes(13)) {
        selected = [13];
    } else if (tags.includes(16)) {
        selected = [16];
    } else if (tags.includes(15) && tags.includes(8)) {
        selected = [15, 8];
    } else if (tags.includes(15) && tags.includes(18)) {
        selected = [15, 18];
    } else if (tags.includes(15) && tags.includes(5)) {
        selected = [15, 5];
    } else if (tags.includes(15) && tags.includes(23)) {
        selected = [15, 23];
    } else if (tags.includes(20) && tags.includes(2)) {
        selected = [20, 2];
    } else if (tags.includes(20) && tags.includes(10)) {
        selected = [20, 10];
    } else if (tags.includes(23) && tags.includes(19) && tags.includes(2)) {
        selected = [23, 19, 6];
    } else if (tags.includes(23) && tags.includes(6)) {
        selected = [23, 6];
    } else if (tags.includes(23) && tags.includes(2)) {
        selected = [23, 2];
    } else if (tags.includes(23) && tags.includes(9)) {
        selected = [23, 9];
    } else if (tags.includes(23) && tags.includes(1)) {
        selected = [23, 1];
    }
    return [selected, sp, duration_]
}