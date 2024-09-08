import axios from 'axios';

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
    encryptIsCheat,
    encryptBattleData,
    get_md5,
    getBattleDataAccess,
    sleep
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
import moment from "moment";


const phone = process.argv[2];
const pwd = process.argv[3];

class Player {
    uid: string;
    seqnum: number;
    secret: string;
    server: string;
    config: {
        battleLog: {
            [key: string]: {
                stats: any
                isCheat: string
                completeTime: number
            }
        }
    }
    data!: PlayerDataModel;

    constructor(server = "cn") {
        this.seqnum = 0
        this.secret = ""
        this.uid = ""
        this.server = server;
        this.config = (<{ [key: string]: any }>config)[get_md5(phone)]
    }
    printStatus(){
        const status=this.data.status
        log(`${status.nickName}#${status.nickNumber}`)
        log(`uid：${status.uid}`)
        log(`等级：${status.level}(${status.exp})/120`)
        log(`理智：${status.ap}/${status.maxAp}`)
        log(`源石：${status.androidDiamond}`)
        log(`赤金：${status.gold}`)
        log(`签名：${status.resume}`)
        log(`助理：${status.secretary}`)
        log(`信用点：${status.socialPoint}`)
        log(`绿票：${status.lggShard}`)
        log(`黄票：${status.hggShard}`)
        log(`公招券：${status.recruitLicense}`)


    }
    async init(phone: string, pwd: string) {
        await import("./config.json")
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
            log("已完成签到")
        }
        for (const [activityId, v] of Object.entries(this.data.activity.LOGIN_ONLY)) {
            log("发现LOGIN_ONLY活动",activityId)
            if (v.reward) {
                await this.post('/activity/loginOnly/getReward', {activityId})
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ONLY)) {
            log("发现CHECKIN_ONLY活动",activityId)
            for (const v1 of v.history) {
                if(v1){
                    const index = v.history.indexOf(v1);
                    await this.post('/activity/getActivityCheckInReward', {activityId, index})
                }
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ACCESS)) {
            log("发现CHECKIN_ACCESS活动",activityId)
            if (v.currentStatus) {
                await this.post('/activity/actCheckinAccess/getCheckInReward', {activityId})
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.GRID_GACHA_V2)) {
            log("发现GRID_GACHA_V2活动",activityId)
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
                log("[building] visit",id.uid)
                j += 1
            }
        }
        /*
        if(this.data.building.rooms.MEETING["slot_36"].receiveStock){
            await this.post('/building/receiveClueToStock', {
                clues:this.data.building.rooms.MEETING["slot_36"].receiveStock.map(v=>v.id)
            })
            log("[building] receive clue to stock")
        }

         */
        for (const stock of this.data.building.rooms.MEETING["slot_36"].ownStock) {
            if(!Object.keys(this.data.building.rooms.MEETING["slot_36"].board).includes(stock.type)){
                await this.post('/building/putClueToTheBoard', {clueId:stock.id})
                log("[building] put",stock.type,"to the board")
            }
        }

        if (Object.keys(this.data.building.rooms.MEETING["slot_36"].board).length == 7) {
            await this.post('/building/startInfoShare', {})
            log("[building] startInfoShare")
        }
        if (this.data.social.yesterdayReward.canReceive) {
            await this.post("/social/receiveSocialPoint", {})
            log("[building] receiveSocialPoint")

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

    async auto_replay(stageId:string,apCost:number) {
        if(this.data.status.ap<apCost){
            return
        }
        const {battleReplay} = await this.post<
            { stageId: string }, { battleReplay: string }
        >("/quest/getBattleReplay", {stageId})
        log("获取到录像", stageId)
        const battleLog = await decryptBattleReplay(battleReplay)
        const {battleId} = await this.post<any, QuestBattleStartResponse>("/quest/battleStart", {
            isRetro: 0,
            pry: 0,
            battleType: 0,
            continuous: null,
            usePracticeTicket: 0,
            stageId,
            squad: {
                squadId: "0",
                name: null,
                slots: new Array(12).fill(null).map((_, i) => {
                    if (i >= battleLog.journal.squad.length) {
                        return null
                    }
                    const {charInstId, skillIndex, uniequipId} = battleLog.journal.squad[i]
                    return {
                        charInstId,
                        skillIndex,
                        currentEquip: uniequipId || null
                    }
                })
            },
            assistFriend: null,
            isReplay: 1,
            startTs: now()
        })
        log("战斗开始", stageId, battleId)
        const battleStats = this.config.battleLog[stageId]
        battleStats.stats.access = getBattleDataAccess(this.data.pushFlags.status)
        battleStats.isCheat = encryptIsCheat(battleId)
        battleStats.stats.beginTs = now()
        battleStats.stats.endTs = now() + battleStats.completeTime
        const battleData = {
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
        await sleep(battleStats.completeTime * 1000)
        const res = await this.post("/quest/battleFinish", {
            data: encryptBattleData(battleData, this.data.pushFlags.status),
            battleData: {
                stats: {},
                isCheat: encryptIsCheat(battleId),
                completeTime: battleStats.completeTime
            }
        })
        log("战斗结束", battleId)
    }

    async auto_building() {
        await this.post("/building/gainAllIntimacy", {})
        log("[building] gainAllIntimacy")
        await this.post('/building/settleManufacture', {
            roomSlotIdList: Object.keys(this.data.building.rooms.MANUFACTURE),
            supplement: 1
        })
        log("[building] settleManufacture")

        await this.post("/building/deliveryBatchOrder", {
            slotList: Object.keys(this.data.building.rooms.TRADING)
        })
        log("[building] deliveryBatchOrder")
        if(moment().diff(moment([2024,9,7]),"days")%2==0){
            await this.post('/building/assignChar', {"roomSlotId": "slot_34", "charInstIdList": [244, 224, 257, 134, 132]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_26", "charInstIdList": [27]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_25", "charInstIdList": [46, 53, 205]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_24", "charInstIdList": [24, 201, 204]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_28", "charInstIdList": [193, 249, 165, 9, 253]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_36", "charInstIdList": [213, 160]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_16", "charInstIdList": [263]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_15", "charInstIdList": [141, 11, 22]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_14", "charInstIdList": [28, 29, 50]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_20", "charInstIdList": [60, 179, 94, 217, 97]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_23", "charInstIdList": [79]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_7", "charInstIdList": [98]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_6", "charInstIdList": [5, 2, 34]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_5", "charInstIdList": [15, 33, 92]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_9", "charInstIdList": [240, 10, 28, 12, 19]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_3", "charInstIdList": [42, 206, 178, 29, 50]})
        }else{
            await this.post('/building/assignChar', {"roomSlotId": "slot_34", "charInstIdList": [128, 190, 170, 278, 280]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_26", "charInstIdList": [193]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_25", "charInstIdList": [249, 165, 9]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_24", "charInstIdList": [124, 135, 93]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_28", "charInstIdList": [192, 92, 151, 213, 27]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_36", "charInstIdList": [253, 60]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_16", "charInstIdList": [179]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_15", "charInstIdList": [94, 217, 97]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_14", "charInstIdList": [28, 29, 50]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_20", "charInstIdList": [263, 98, 79, 160, 34]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_23", "charInstIdList": [240]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_7", "charInstIdList": [10]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_6", "charInstIdList": [2, 12, 19]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_5", "charInstIdList": [42, 206, 178]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_9", "charInstIdList": [5, 205, 15, 33, 204]})
            await this.post('/building/assignChar', {"roomSlotId": "slot_3", "charInstIdList": [24, 201, 141, 11, 46]})
        }
        log("[building] assign chars")
    }

    async auto_gacha() {
        for (const [poolId, v] of Object.entries(this.data.gacha.limit)) {
            if (v.leastFree) {
                log("发现每日单抽",poolId)
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
            if(this.data.shop.SOCIAL.info.some(v=>v.id==good.goodId)){
                continue
            }
            if ((good.price <= this.data.status.socialPoint) && good.availCount) {
                await this.post("/shop/buySocialGood", {
                    goodId: good.goodId,
                    count: 1
                })
                log(`[信用商店]购买 ${good.goodId}*${good.availCount}`)
                log(`[信用商店]消耗 ${good.price} 信用点`)

            } else {
                break
            }
        }
    }

    async auto_campaign() {
        const stageId = this.data.campaignsV2.open.rotate
        if (this.data.campaignsV2.sweepMaxKills[stageId] != 400) {
            return
        }
        if (this.data.campaignsV2.campaignCurrentFee >= this.data.campaignsV2.campaignCurrentFee) {
            return
        }
        if (!Object.values(this.data.consumable["EXTERMINATION_AGENT"]).some((v) => v.count > 0)) {
            return
        }
        const [instId] = Object.entries(this.data.consumable["EXTERMINATION_AGENT"]).find(([k, v]) => v.count > 0)!
        await this.post<any, any>("/campaignV2/battleSweep", {
            stageId,
            itemId: "EXTERMINATION_AGENT",
            instId
        })
        log("完成剿灭扫荡",stageId)
    }

    async syncData() {
        await this.post<AccountSyncDataRequest, AccountSyncDataResponse>("/account/syncData", {
            platform: 1
        })
        log("data synced,uid:", this.uid)
        this.printStatus()
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
        try{
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
        }catch (e) {
            log(e)
        }
        return {} as T

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
    if(!phone || !pwd){
        log("error: no phone or pwd")
        return
    }
    const p = new Player()
    await p.init(phone, pwd)
    await p.auto_checkin()
    await p.auto_mail()
    await p.auto_gacha()
    await p.auto_building()
    await p.auto_social()
    await p.auto_buy()
    await p.auto_recruit()
    await p.auto_campaign()
    while (p.data.status.ap>=21){
        log(p.data.status.ap)
        await p.auto_replay("act36side_07",21)
    }
    await p.auto_confirm_missions()
}

bootstrap();

