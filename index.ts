
import axios from 'axios';
import crypto from 'crypto';
import { PlayerDataModel } from 'models';

const phone = process.argv[2];
const pwd = process.argv[3];
const temp: { [token: string]: { [key: string]: string } } = {};
console.log(phone, pwd)
async function post(cgi: string, data: any, token: string): Promise<any> {
    const url = 'https://ak-gs-gf.hypergryph.com' + cgi;
    const response = await axios.post(url, data, { headers: temp[token] });

    if (response.headers['seqnum'] && !isNaN(Number(response.headers['seqnum']))) {
        temp[token]["seqnum"] = response.headers['seqnum'];
    } else {
        temp[token]["seqnum"] = String(Number(temp[token]["seqnum"]) + 1);
    }
    return response.data;
}

async function get_res_version() {
    const res = await axios.get("https://ak-conf.hypergryph.com/config/prod/official/Android/version");
    return res.data;
}

async function get_token(device_id1: string, device_id2: string, device_id3: string, phone: string, pwd: string) {
    const res1 = await axios.post("https://as.hypergryph.com/user/auth/v1/token_by_phone_password", {
        phone: phone,
        password: pwd
    })
    const token1 = res1.data.data.token;
    const res2 = await axios.post("https://as.hypergryph.com/user/oauth2/v2/grant", {
        token: token1,
        appCode: "7318def77669979d",
        type: 0
    })
    const token2 = res2.data.data.code;
    const get_token_req: { [key: string]: any } = {
        appId: "1",
        channelId: "1",
        extension: JSON.stringify({ code: token2, isSuc: true, type: 1 }),
        worldId: "1",
        platform: 1,
        subChannel: "1",
        deviceId: device_id1,
        deviceId2: device_id2,
        deviceId3: device_id3
    };
    let sign_str = '';
    for (let i in get_token_req) {
        sign_str += `${i}=${get_token_req[i]}&`;
    }
    sign_str = sign_str.slice(0, -1);
    const sign_ = u8_sign(sign_str);
    get_token_req.sign = sign_;
    const res3 = await axios.post("https://as.hypergryph.com/u8/user/v1/getToken", get_token_req)
    return { token: res3.data.token, uid: res3.data.uid };
}

function get_md5(str: string) {
    return crypto.createHash('md5').update(str).digest('hex');
}

function u8_sign(data: string): string {
    const secretKey = '91240f70c09a08a6bc72af1a5c8d4670';
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(data);
    return hmac.digest('hex');
}

async function bootstrap() {
    const resv = await get_res_version();
    const device_id1 = get_md5(''.concat(Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    const device_id2 = '85' + ''.concat(Array.from({ length: 13 }, () => Math.floor(Math.random() * 10).toString()).join(''));
    const device_id3 = get_md5(''.concat(Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')));
    const { token, uid } = await get_token(device_id1, device_id2, device_id3, phone, pwd);
    temp[token] = {
        uid: uid,
        secret: "",
        seqnum: "0",
        'Content-Type': 'application/json',
        'X-Unity-Version': '2017.4.39f1',
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 6.0.1; X Build/V417IR)',
        'Connection': 'Keep-Alive'
    };
    const res1 = await post("/account/login", {
        networkVersion: "5",
        uid: uid,
        token: token,
        assetsVersion: resv.resVersion,
        clientVersion: resv.clientVersion,
        platform: 1,
        deviceId: device_id1,
        deviceId2: device_id2,
        deviceId3: device_id3
    }, token)
    temp[token].secret = res1.secret;
    const res2 = await post("/account/syncData", { platform: 1 }, token)
    const player_data:PlayerDataModel = res2.user;
    console.log({ token, uid })

    Object.entries(player_data.activity.LOGIN_ONLY).forEach(async ([k,v]) => {
        let res=await post('/activity/loginOnly/getReward', {activityId: k}, token)
    })
    Object.entries(player_data.activity.BLESS_ONLY).forEach(async ([k,v]) => {

    })
    Object.entries(player_data.recruit.normal.slots).forEach(async([k,v]) => {

    })

}
bootstrap();