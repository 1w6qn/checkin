import crypto from "crypto";
import moment from "moment";
export function now(){
    return moment().unix()
}
export function get_md5(str: string) {
    return crypto.createHash('md5').update(str).digest('hex');
}

export function u8_sign(data: { [key: string]: any }): string {
    let sign_str = Object.entries(data).map(([k,v]) => `${k}=${v}`).join("&");
    const secretKey = '91240f70c09a08a6bc72af1a5c8d4670';
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(sign_str);
    return hmac.digest('hex');
}
export function get_random_devices(): {deviceId: string, deviceId2: string,deviceId3:string} {
    const deviceId = get_md5(''.concat(Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    const deviceId2 = '85' + ''.concat(Array.from({ length: 13 }, () => Math.floor(Math.random() * 10).toString()).join(''));
    const deviceId3 = get_md5(''.concat(Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    return {deviceId,deviceId2,deviceId3}
}
export function mergeDict(old: any, newDict: any,key="modify"): void {
    for (const k in newDict) {
        if (old[k] !== undefined) {
            if (typeof newDict[k] !== 'object') {
                if(key=="modify"){
                    old[k] = newDict[k];
                }else if(key=="delete"){
                    delete old[k]
                }
                continue;
            }
            mergeDict(old[k], newDict[k],key);
        } else {
            old[k] = newDict[k];
        }
    }
}
export const log=console.log
export function select_tags(tags:number[]):[number[],number,number]  {
    return [[],0,0]
}
