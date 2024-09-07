import crypto from "crypto";
import moment from "moment";
import JSZip from "jszip";
import {BattleLog} from "./models";

const HASH_KEY = "62AE221E4C5D4CAD4B851D7380F4ED2C"
const LOG_TOKEN_KEY = "pM6Umv*^hVQuB6t&";

export function now() {
    return moment().unix()
}

export function get_md5(str: string) {
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

export function sleep(time: number) {
    return new Promise(resolve =>
        setTimeout(resolve, time)
    )
}

export const log = console.log

export function select_tags(tags: number[]): [number[], number, number] {
    let selected: number[] = [], sp = 0, duration_ = 0

    return [selected, sp, duration_]
}