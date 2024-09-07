import axios from 'axios';
import {} from 'lodash'

import {PlayerDataDelta, PlayerDataModel} from 'dto';
import config from "./config.json"
import {
    get_random_devices,
    select_tags,
    now,
    u8_sign,
    mergeDict,
    log,
    decryptBattleReplay,
    encryptIsCheat, encryptBattleData, get_md5, getBattleDataAccess
} from "./utils";
import {
    AccountLoginRequest,
    AccountLoginResponse,
    AccountSyncDataRequest,
    AccountSyncDataResponse,
    BuildingGetClueFriendListResponse, GetSocialGoodListResponse,
    GetTokenResponse,
    MailGetMetaInfoListResponse,
    PlayerDeltaResponse, QuestBattleStartResponse,
    ResVersionResponse
} from "./models";

const phone = process.argv[2];
const pwd = process.argv[3];

class Player {
    uid: string;
    seqnum: number;
    secret: string;
    server: string;
    data!: PlayerDataModel;

    constructor(server = "cn") {
        this.seqnum = 0
        this.secret = ""
        this.uid = ""
        this.server = server;
    }

    async init(phone: string, pwd: string) {
        const resv = await get_res_version();
        log(`assetsVersion:${resv.resVersion}, clientVersion:${resv.clientVersion}`);
        const {deviceId, deviceId2, deviceId3} = get_random_devices()
        const {token, uid} = await get_token(deviceId, deviceId2, deviceId3, phone, pwd);
        this.uid = uid
        log(`uid:${uid}, access_token:${token}`);
        this.secret = (await this.post<AccountLoginRequest, AccountLoginResponse>("/account/login", {
            networkVersion: "5",
            uid,
            token,
            assetsVersion: resv.resVersion,
            clientVersion: resv.clientVersion,
            platform: 1,
            deviceId,
            deviceId2,
            deviceId3
        })).secret
        log(`secret:${this.secret}`);
        await this.syncData()
    }

    async auto_checkin() {
        if (this.data.checkIn.canCheckIn) {
            await this.post('/user/checkIn', {})
        }
        for (const [activityId, v] of Object.entries(this.data.activity.LOGIN_ONLY)) {
            if (v.reward) {
                await this.post('/activity/loginOnly/getReward', {activityId})
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ONLY)) {
            for (const v1 of v.history) {
                const index = v.history.indexOf(v1);
                await this.post('/activity/getActivityCheckInReward', {activityId, index})
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ACCESS)) {
            if (v.currentStatus) {
                await this.post('/activity/actCheckinAccess/getCheckInReward', {activityId})
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.GRID_GACHA_V2)) {
            if (!v.today.done) {
                await this.post('/activity/gridGachaV2/doTodayGacha', {activityId})
            }
        }
    }

    async auto_mail() {
        const mail_list = (await this.post<{ from: number }, MailGetMetaInfoListResponse>('/mail/getMetaInfoList', {
            from: now()
        })).result
        const mailIdList: number[] = []
        const sysMailIdList: number[] = []
        mail_list.forEach((mail) => {
            if (mail.state || !mail.hasItem) {
                return;
            }
            if (mail.type) {
                sysMailIdList.push(mail.mailId)
            } else {
                mailIdList.push(mail.mailId)
            }
        })
        if (mailIdList || sysMailIdList) {
            log("发现未领取邮件")
            await this.post('/mail/receiveAllMail', {
                mailIdList,
                sysMailIdList
            })
            log("已收取所有邮件", mailIdList, sysMailIdList)
        }
    }

    async auto_social() {
        if (this.data.building.rooms.MEETING["slot_36"].dailyReward) {
            await this.post('/building/getDailyClue', {})
        }
        if (this.data.building.rooms.MEETING["slot_36"].socialReward.daily) {
            await this.post('/building/getMeetingroomReward', {type: [0]})
        }
        if (this.data.building.rooms.MEETING["slot_36"].socialReward.search) {
            await this.post('/building/getMeetingroomReward', {type: [1]})
        }
        const id_list = (await this.post<{},
            BuildingGetClueFriendListResponse
        >('/building/getClueFriendList', {})).result
        let j = 0
        for (const id of id_list) {
            if (j < 10) {
                await this.post('/building/visitBuilding', {friendId: id.uid})
                j += 1
            }
        }
        if (Object.keys(this.data.building.rooms.MEETING["slot_36"].board).length == 7) {
            await this.post('/building/startInfoShare', {})
        }
        if (this.data.social.yesterdayReward.canReceive) {
            await this.post("/social/receiveSocialPoint", {})
        }

    }

    async auto_confirm_missions() {
        await this.post("/mission/autoConfirmMissions", {type: "DAILY"})
        await this.post("/mission/autoConfirmMissions", {type: "WEEKLY"})
    }

    async auto_recruit() {
        for (const [slotId, slot] of Object.entries(this.data.recruit.normal.slots)) {
            if (this.data.status.recruitLicense === 0) break;
            if (!slot.state) continue;
            if (slot.maxFinishTs > now()) continue;
            if (slot.state === 2) {
                log(`Found Unconfirmed Recruit:slot${slotId}`);
                await this.post('/gacha/finishNormalGacha', {slotId: slotId});
            }
            log(`Found Empty Slot:${slotId}, tag: ${slot.tags}`);
            let [tagList, specialTagId, duration] = select_tags(slot.tags);
            if (tagList.length === 0 && this.data.building.rooms.HIRE["slot_23"].refreshCount) {
                await this.post<{ slotId: string }, PlayerDeltaResponse>('/gacha/refreshTags', {slotId});
                const updatedSlot = this.data.recruit.normal.slots[slotId];
                log(`Refreshed Slot:${slotId}, tag: ${updatedSlot.tags}`);
                [tagList, specialTagId, duration] = select_tags(updatedSlot.tags);
            }
            if (specialTagId !== 11) {
                await this.post('/gacha/normalGacha', {
                    slotId, tagList, specialTagId, duration
                });
            }
        }
    }

    async auto_replay() {
        const stageId = "main_01-07"
        const {battleReplay} = await this.post<
            { stageId: string }, { battleReplay: string }
        >("/quest/getBattleReplay", {stageId})
        log("获取到录像",stageId)
        const battleLog = await decryptBattleReplay(battleReplay)
        const {battleId}=await this.post<any,QuestBattleStartResponse>("/quest/battleStart", {
            isRetro: 0,
            pry: 0,
            battleType: 0,
            continuous: null,
            usePracticeTicket: 0,
            stageId,
            squad: {
                squadId: "0",
                name: null,
                slots: new Array(12).fill(null).map((_,i)=>{
                    if(i>=battleLog.journal.squad.length){
                        return null
                    }
                    const {charInstId,skillIndex,uniequipId}=battleLog.journal.squad[i]
                    return {
                        charInstId,
                        skillIndex,
                        currentEquip: uniequipId
                    }
                })
            },
            assistFriend: null,
            isReplay: 1,
            startTs: now()
        })
        log("战斗开始",stageId,battleId)
        const battleStats=config["5d78668f18221717469556fe8a5ed85e"].battleLog[stageId]
        battleStats.stats.access=getBattleDataAccess(this.data.pushFlags.status)
        battleStats.isCheat=encryptIsCheat(battleId)
        battleStats.stats.beginTs=now()
        battleStats.stats.endTs=now()+battleStats.completeTime
        const battleData={
            battleId,
            interrupt: 0,
            giveUp: 0,
            percent: 100,
            completeState: 3,
            killCnt: battleStats.stats.killedEnemiesCnt,
            validKillCnt: battleStats.stats.killedEnemiesCnt,
            battleData: battleStats,
            currentIndex: 0,
            platform: 1
        }

        const res=await this.post("/quest/battleFinish", {
            data: encryptBattleData(battleData,this.data.pushFlags.status),
            battleData: {
                stats: {},
                isCheat: encryptIsCheat(battleId),
                completeTime: 0
            }
        })
        log("战斗结束",battleId)
        log(res)
    }

    async auto_building() {
        await this.post("/building/gainAllIntimacy", {})
        await this.post('/building/settleManufacture', {
            roomSlotIdList: Object.keys(this.data.building.rooms.MANUFACTURE),
            supplement: 1
        })
        await this.post("/building/deliveryBatchOrder", {
            slotList: Object.keys(this.data.building.rooms.TRADING)
        })

    }

    async auto_gacha() {
        for (const [poolId, v] of Object.entries(this.data.gacha.limit)) {
            if (v.leastFree) {
                await this.post("/gacha/advancedGacha", {
                    poolId,
                    useTkt: 3,
                    itemId: null
                })
            }
        }
    }

    async auto_buy() {
        const res = (await this.post<{}, GetSocialGoodListResponse>("/shop/getSocialGoodList", {}))
        for (const good of res.goodList.sort((a, b) => a.price - b.price)) {
            if (good.price <= this.data.status.socialPoint && good.availCount) {
                await this.post("/shop/buySocialGood", {
                    goodId: good.goodId,
                    count: good.availCount
                })
            } else {
                break
            }
        }
    }

    async auto_campaign() {
        const stage_id = this.data.campaignsV2.open.rotate
        if (this.data.campaignsV2.sweepMaxKills[stage_id] != 400) {
            return
        }
        if (this.data.campaignsV2.campaignCurrentFee >= this.data.campaignsV2.campaignCurrentFee) {
            return
        }
        if (!Object.values(this.data.consumable["EXTERMINATION_AGENT"]).some((v) => v.count > 0)) {
            return
        }
        const [inst_id] = Object.entries(this.data.consumable["EXTERMINATION_AGENT"]).find(([k, v]) => v.count > 0)!
        await this.post<any, any>("/campaignV2/battleSweep", {
            stageId: stage_id,
            itemId: "EXTERMINATION_AGENT",
            instId: inst_id
        })
    }

    async syncData() {
        await this.post<AccountSyncDataRequest, AccountSyncDataResponse>("/account/syncData", {
            platform: 1
        })
        log("data synced,uid:", this.uid)
        log(this.data.status)
    }

    merge(delta: PlayerDataDelta) {
        mergeDict(this.data, delta.modified, "modify")
    }

    async post<K = any, T = any>(cgi: string, data: K): Promise<T> {
        const headers: { [key: string]: string } = {
            uid: this.uid,
            secret: this.secret,
            seqnum: `${this.seqnum}`,
            'Content-Type': 'application/json',
            'X-Unity-Version': '2017.4.39f1',
            'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 6.0.1; X Build/V417IR)',
            'Connection': 'Keep-Alive'
        }
        const url = 'https://ak-gs-gf.hypergryph.com' + cgi;
        const response = await axios.post(url, data, {headers: headers});
        if (response.headers['seqnum'] && !isNaN(Number(response.headers['seqnum']))) {
            this.seqnum = Number(response.headers['seqnum'])
        } else {
            this.seqnum += 1;
        }
        if (response.data.user !== undefined) {
            this.data = response.data.user
        }
        if (response.data.playerDataDelta !== undefined) {
            this.merge(response.data.playerDataDelta)
        }
        return response.data;
    }
}

async function get_res_version(): Promise<ResVersionResponse> {
    return (await axios.get("https://ak-conf.hypergryph.com/config/prod/official/Android/version")).data;
}

async function get_token(deviceId: string, deviceId2: string, deviceId3: string, phone: string, pwd: string) {
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
        extension: JSON.stringify({code: token2, isSuc: true, type: 1}),
        worldId: "1",
        platform: 1,
        subChannel: "1",
        deviceId,
        deviceId2,
        deviceId3
    };
    get_token_req.sign = u8_sign(get_token_req);
    const res3 = await axios.post<any, GetTokenResponse>("https://as.hypergryph.com/u8/user/v1/getToken", get_token_req)
    return {token: res3.data.token, uid: res3.data.uid};
}

async function bootstrap() {
    const p = new Player()
    await p.init(phone, pwd)
    await p.auto_checkin()
    await p.auto_campaign()
    await p.auto_mail()
    await p.auto_recruit()
    await p.auto_confirm_missions()
    await p.auto_gacha()
    await p.auto_building()
    await p.auto_social()
    await p.auto_buy()
    await p.auto_replay()
}

bootstrap();