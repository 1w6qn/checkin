import axios, {AxiosError} from 'axios';

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
import {floor} from "lodash";


const phone = process.argv[2];
const pwd = process.argv[3];

class Player {
    uid: string;
    seqnum: number;
    secret: string;
    server: string;
    config: {
        enableRecruit:boolean
        enableBattle:boolean
        assignChars:boolean
        enableBatchBuilding:boolean
        battleStage:string
        battleLog: {
            [key: string]: {
                stats: any
                isCheat: string
                completeTime: number
            }
        },
        building:{
            [key:string]:{
                [key:string]:string[]
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
        const resVersion = await get_res_version();
        log(`assetsVersion:${resVersion.resVersion}, clientVersion:${resVersion.clientVersion}`);
        const {deviceId, deviceId2, deviceId3} = get_random_devices()
        const {token, uid} = await get_token(deviceId, deviceId2, deviceId3, phone, pwd);
        this.uid = uid
        log(`uid:${uid}, access_token:${token}`);
        this.secret = (await this.post<AccountLoginRequest, AccountLoginResponse>("/account/login", {
            networkVersion: "5",
            uid,
            token,
            assetsVersion: resVersion.resVersion,
            clientVersion: resVersion.clientVersion,
            platform: 1,
            deviceId,
            deviceId2,
            deviceId3
        })).secret
        log(`[main] secret`,this.secret);
        await this.syncData()
    }

    async auto_checkin() {
        if (this.data.checkIn.canCheckIn) {
            await this.post('/user/checkIn', {})
            log("[活动]已完成签到")
        }
        for (const [activityId, v] of Object.entries(this.data.activity.LOGIN_ONLY)) {
            log("[活动]发现LOGIN_ONLY活动",activityId)

            if (v.reward) {
                await this.post('/activity/loginOnly/getReward', {activityId})
                log("[活动][LOGIN_ONLY] getReward",activityId)
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ONLY)) {
            log("[活动]发现CHECKIN_ONLY活动",activityId)
            if (v.dynOpt){
                continue
            }
            for (const v1 of v.history) {
                if(v1){
                    const index = v.history.indexOf(v1);
                    await this.post('/activity/getActivityCheckInReward', {activityId, index})
                    log("[活动][CHECKIN_ONLY] getReward",activityId, index)
                }
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.CHECKIN_ACCESS)) {
            log("[活动]发现CHECKIN_ACCESS活动",activityId)
            if (v.currentStatus) {
                await this.post('/activity/actCheckinAccess/getCheckInReward', {activityId})
                log("[活动][CHECKIN_ACCESS] getReward",activityId)
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.GRID_GACHA_V2)) {
            log("[活动]发现GRID_GACHA_V2活动",activityId)
            if (!v.today.done) {
                await this.post('/activity/gridGachaV2/doTodayGacha', {activityId})
                log("[活动][GRID_GACHA_V2] doTodayGacha",activityId)
            }
        }
        for (const [activityId, v] of Object.entries(this.data.activity.PRAY_ONLY)) {
            log("[活动]发现PRAY_ONLY活动",activityId)
            if (!v.praying) {
                let prayArray=[1,2]
                if(v.extraCount==1)prayArray=[1,2,3]
                await this.post('/activity/prayOnly/getReward', {prayArray,activityId})
                log("[活动][PRAY_ONLY] getReward",activityId)
            }
        }
    }
    async auto_ra(){
        for(let i=0;i<50;i++){
            log(i+1,"/",50)
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                topicId: "sandbox_1",
                nodeId: "nCF3F",
                eventId: "mission_iron_m2",
                choiceId: "choice_iron_m2_2",
                charList: [29, 7, 16, 17, 20, 30]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                topicId: "sandbox_1",
                nodeId: "nCF3F",
                eventId: "mission_iron_m2",
                choiceId: "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n0446",
                "eventId": "mission_wood_m2",
                "choiceId": "choice_wood_m2_2",
                "charList": [52, 53, 56, 76, 89, 105]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n0446",
                "eventId": "mission_wood_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n42D8",
                "eventId": "mission_wood_stone_m2",
                "choiceId": "choice_wood_stone_m2_2",
                "charList": [110, 111, 118, 125, 136, 147]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n42D8",
                "eventId": "mission_wood_stone_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n9B77",
                "eventId": "mission_stone_m2",
                "choiceId": "choice_stone_m2_2",
                "charList": [148, 169, 172, 202, 211, 238]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n9B77",
                "eventId": "mission_stone_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/settleDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                topicId: "sandbox_1",
                nodeId: "nCF3F",
                eventId: "mission_iron_m2",
                choiceId: "choice_iron_m2_2",
                charList: [277, 287, 44, 62, 68, 80]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                topicId: "sandbox_1",
                nodeId: "nCF3F",
                eventId: "mission_iron_m2",
                choiceId: "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n0446",
                "eventId": "mission_wood_m2",
                "choiceId": "choice_wood_m2_2",
                "charList": [83, 84, 86, 87, 92, 95]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n0446",
                "eventId": "mission_wood_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n42D8",
                "eventId": "mission_wood_stone_m2",
                "choiceId": "choice_wood_stone_m2_2",
                "charList": [96, 98, 100, 102, 106, 108]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n42D8",
                "eventId": "mission_wood_stone_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/startMission", {
                "topicId": "sandbox_1",
                "nodeId": "n9B77",
                "eventId": "mission_stone_m2",
                "choiceId": "choice_stone_m2_2",
                "charList": [114, 115, 117, 120, 123, 126]
            })
            await this.post("/sandboxPerm/sandboxV2/eventChoice", {
                "topicId": "sandbox_1",
                "nodeId": "n9B77",
                "eventId": "mission_stone_m2",
                "choiceId": "choice_missionleave_1"
            })
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/discardAp", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/nextDay", {"topicId": "sandbox_1"})
            await this.post("/sandboxPerm/sandboxV2/settleDay", {"topicId": "sandbox_1"})
        }
        log("[ra] complete")
    }
    async auto_mail() {
        const mailMetaInfoList = (await this.post<{ from: number }, MailGetMetaInfoListResponse>('/mail/getMetaInfoList', {
            from: now()
        })).result.filter((mail)=>(mail.state || mail.hasItem))
        const mailIdList: number[] = mailMetaInfoList.filter((mail)=>!mail.type).map((mail)=>mail.mailId)
        const sysMailIdList: number[] = mailMetaInfoList.filter((mail)=>mail.type).map((mail)=>mail.mailId)
        if (mailIdList || sysMailIdList) {
            log("[邮件]发现未领取邮件")
            await this.post('/mail/receiveAllMail', {
                mailIdList,
                sysMailIdList
            })
            log("[邮件]已收取所有邮件", mailIdList, sysMailIdList)
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
                log("[基建] 访问好友",id.uid)
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
                log("[基建] 已放置线索",stock.type)
            }
        }

        if (Object.keys(this.data.building.rooms.MEETING["slot_36"].board).length == 7) {
            await this.post('/building/startInfoShare', {})
            log("[基建] 开始信赖交流")
        }
        if (this.data.social.yesterdayReward.canReceive) {
            await this.post("/social/receiveSocialPoint", {})
            log("[基建] 获取信用点完成")

        }

    }

    async auto_confirm_missions() {
        await this.post("/mission/autoConfirmMissions", {type: "DAILY"})
        log("[任务]已领取日常任务奖励")
        await this.post("/mission/autoConfirmMissions", {type: "WEEKLY"})
        log("[任务]已领取周常任务奖励")
    }

    async auto_recruit() {
        for (const [slotId, slot] of Object.entries(this.data.recruit.normal.slots)) {
            if (this.data.status.recruitLicense === 0) break;
            if (!slot.state) continue;
            if (slot.maxFinishTs > now()) continue;
            if (slot.state === 2) {
                log(`[公开招募]发现已完成公招：Slot#${slotId}`);
                await this.post('/gacha/finishNormalGacha', {slotId: slotId});
            }
            log(`Found Empty Slot:${slotId}, tag: ${slot.tags}`);
            let [tagList, specialTagId, duration] = select_tags(slot.tags);
            if (tagList.length === 0 && this.data.building.rooms.HIRE["slot_23"].refreshCount && !slot.tags.includes(11)) {
                await this.post<{ slotId: string }, PlayerDeltaResponse>('/gacha/refreshTags', {slotId});
                const updatedSlot = this.data.recruit.normal.slots[slotId];
                log(`[公开招募]刷新公招Slot:${slotId}, tag: ${updatedSlot.tags}`);
                [tagList, specialTagId, duration] = select_tags(updatedSlot.tags);
            }
            if (specialTagId !== 11) {
                await this.post('/gacha/normalGacha', {
                    slotId, tagList, specialTagId, duration
                });
            }else{
                log(`[公开招募]发现高级资深tag：Slot#${slotId}`);
            }
        }
    }

    async auto_replay(stageId:string,apCost:number,times:number) {
        let t=times<=6?times:6
        if(t<=1){
            return
        }
        if(this.data.status.ap<apCost*t){
            return
        }
        const {battleReplay} = await this.post<
            { stageId: string }, { battleReplay: string }
        >("/quest/getBattleReplay", {stageId})
        log("[战斗]获取到录像", stageId)
        const battleLog = await decryptBattleReplay(battleReplay)
        const {battleId} = await this.post<any, QuestBattleStartResponse>("/quest/battleStart", {
            isRetro: 0,
            pry: 0,
            battleType: 2,
            multiple: {battleTimes:t},
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
        log("[战斗]战斗开始", stageId, battleId)
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
        await this.post("/quest/battleFinish", {
            data: encryptBattleData(battleData, this.data.pushFlags.status),
            battleData: {
                stats: {},
                isCheat: encryptIsCheat(battleId),
                completeTime: battleStats.completeTime
            }
        })
        log("[战斗]战斗结束", battleId)
    }

    async auto_building() {
        await this.post("/building/gainAllIntimacy", {})
        log("[基建]获取干员信赖完成")
        await this.post('/building/settleManufacture', {
            roomSlotIdList: Object.keys(this.data.building.rooms.MANUFACTURE),
            supplement: 1
        })
        log("[基建]获取制造站收益完成")

        await this.post("/building/deliveryBatchOrder", {
            slotList: Object.keys(this.data.building.rooms.TRADING)
        })
        log("[基建]获取贸易站收益完成")
        if(this.config.assignChars){
            let [_,config]=Object.entries(this.config.building).find(
                ([condition,_])=> eval(condition)
            )!
            for(let [roomSlotId,charIds] of Object.entries(config)){
                await this.post('/building/assignChar', {
                    roomSlotId,
                    charInstIdList: charIds.map(id =>
                        this.data.dexNav.character[id]?.charInstId || -1
                    )
                })
            }
            log("[基建]换班完成")
        }
        if(this.config.enableBatchBuilding){
            await this.post("/building/batchChangeWorkChar", {})
            await this.post("/building/batchRestChar", {})
            log("[基建]自动换班完成")
        }

    }
    /*
    exportBuilding(){
        let m=Object.entries(this.data.dexNav.character).reduce((acc,[k,v])=>{
            return {
                [v.charInstId]:k,
                ...acc
            }
        },{} as {[key:number]:string})
        let c=Object.entries(this.data.building.roomSlots).filter(([_,v])=>v.charInstIds)
            .reduce((acc,[slotId,slot])=>{
            return {
                [slotId]:slot.charInstIds.map((v)=> m[v]||""),
                ...acc
            }
        },{} as {[key:string]:string[]})

        writeFileSync("2.json",JSON.stringify(c,null," "))
        log("exported building config to 2.json")
    }*/
    async auto_gacha() {
        for (const [poolId, v] of Object.entries(this.data.gacha.limit)) {
            if (v.leastFree) {
                log("[限时寻访]发现每日单抽",poolId)
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
        if(this.data.status.ap<25){
            return
        }
        const stageId = this.data.campaignsV2.open.rotate
        if (this.data.campaignsV2.sweepMaxKills[stageId] != 400) {
            return
        }
        if (this.data.campaignsV2.campaignCurrentFee >= this.data.campaignsV2.campaignTotalFee) {
            return
        }
        if (!Object.values(this.data.consumable["EXTERMINATION_AGENT"]).some((v) => v.count > 0)) {
            return
        }
        const [instId] = Object.entries(this.data.consumable["EXTERMINATION_AGENT"]).find(([_, v]) => v.count > 0)!
        await this.post<any, any>("/campaignV2/battleSweep", {
            stageId,
            itemId: "EXTERMINATION_AGENT",
            instId
        })
        log("[战斗]完成剿灭扫荡",stageId)
    }

    async syncData() {
        await this.post<AccountSyncDataRequest, AccountSyncDataResponse>("/account/syncData", {
            platform: 1
        })
        this.data.status.ap+=floor((now()-this.data.status.lastApAddTime)/360)
        if(this.data.status.ap>this.data.status.maxAp){
            this.data.status.ap=this.data.status.maxAp
        }
        log("[main] data synced,uid:", this.uid)
        this.printStatus()
    }

    merge(delta: PlayerDataDelta) {
        mergeDict(this.data, delta.modified, "modify")
        //mergeDict(this.data, delta.deleted, "delete")
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
        }catch (err) {
            let error = err as AxiosError;
            if (error.response) {
                console.log(error.response.data);
            } else if (error.request) {
                console.log(error.request);
            } else {
                console.log('Error', error.message);
            }
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
        type: 1
    })
    const token2 = res2.data.data.token;
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
    return res3.data;
}

async function bootstrap() {
    if(!phone || !pwd){
        log("error: no phone or pwd")
        return
    }
    const p = new Player()
    await p.init(phone, pwd)
    //await p.auto_ra()
    await p.auto_checkin()
    await p.auto_mail()
    await p.auto_gacha()
    await p.auto_building()
    await p.auto_social()
    await p.auto_buy()
    if(p.config.enableRecruit){
        await p.auto_recruit()
    }
    await p.auto_campaign()
    while(p.config.enableBattle && p.data.status.ap>=12){
        let times=Math.floor(p.data.status.ap/6)
        await p.auto_replay(p.config.battleStage,6,times)
        //p.printStatus()
    }
    p.printStatus()
    await p.auto_confirm_missions()
    await axios.get("https://pt.vclib.online/attendance.php",{headers:{
            "Cookie":atob("Y19zZWN1cmVfbG9naW49Ym05d1pRJTNEJTNEO2Nfc2VjdXJlX3Bhc3M9M2E1M2RkNzc1MDFiNjM2NGQ1YWUzNGUwZGRjMGI3Mzc7Y19zZWN1cmVfc3NsPWJtOXdaUSUzRCUzRDtjX3NlY3VyZV90cmFja2VyX3NzbD1ibTl3WlElM0QlM0Q7Y19zZWN1cmVfdWlkPU1UQXdNVE0lM0Q7")
        }})
    
    
    
}

bootstrap().then(_ => {
    log("[main] 已完成")
});

