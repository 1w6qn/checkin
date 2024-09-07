import {ItemBundle, MailMetaInfo, PlayerDataDelta, PlayerDataModel} from "./dto";
export interface GetTokenResponse {
    data:{
        token: string,
        uid: string
    }
}
export interface AccountLoginRequest {
    networkVersion: string,
    uid: string,
    token: string,
    assetsVersion: string,
    clientVersion: string,
    platform: number,
    deviceId: string,
    deviceId2: string,
    deviceId3: string
}
export interface AccountSyncDataRequest {
    platform: number,
}
export interface AccountLoginResponse {
    result: number,
    uid: string,
    secret: string,
    serviceLicenseVersion: number,
    majorVersion: string
}
export interface PlayerDeltaResponse {
    playerDataDelta:PlayerDataDelta,
    pushMessage:any
}
export interface AccountSyncDataResponse extends PlayerDeltaResponse{
    result: number,
    ts: number,
    user: PlayerDataModel
}
export interface MailGetMetaInfoListResponse extends PlayerDeltaResponse{
    result:MailMetaInfo[]
}
export interface BuildingGetClueFriendListResponse extends PlayerDeltaResponse{
    result:{
        uid: string,
        level: number,
    }[]
}
export interface ResVersionResponse {
    resVersion:string,
    clientVersion:string
}
export interface GetSocialGoodListResponse extends PlayerDeltaResponse{
    goodList: SocialGoodList[];
    charPurchase:{[key:string]:number}
    costSocialPoint:number
    creditGroup:string
}
export interface SocialGoodList{
    goodId: string;
    displayName: string;
    item: ItemBundle;
    price: number;
    availCount: number;
    slotId:number
    discount:number
    originPrice: number;
}
export interface QuestBattleStartResponse extends PlayerDeltaResponse{
    "result": number,
    "battleId": string,
    "apFailReturn": number,
    "isApProtect": number,
    "inApProtectPeriod": boolean,
    "notifyPowerScoreNotEnoughIfFailed": boolean,
}
export interface BattleLog {
    campaignOnlyVersion: number;
    timestamp:           string;
    journal:             Journal;
}

export interface Journal {
    metadata:   Metadata;
    squad:      Squad[];
    logs:       Log[];
    randomSeed: number;
    runeList:   null;
}

export interface Log {
    timestamp: number;
    signiture: Signiture;
    op:        number;
    direction: number;
    pos:       Pos;
}

export interface Pos {
    row: number;
    col: number;
}

export interface Signiture {
    uniqueId: number;
    charId:   string;
}

export interface Metadata {
    standardPlayTime:      number;
    gameResult:            number;
    saveTime:              Date;
    remainingCost:         number;
    remainingLifePoint:    number;
    killedEnemiesCnt:      number;
    missedEnemiesCnt:      number;
    levelId:               string;
    stageId:               string;
    validKilledEnemiesCnt: number;
}

export interface Squad {
    charInstId:       number;
    skinId:           string;
    tmplId:           null;
    skillId:          string;
    skillIndex:       number;
    skillLvl:         number;
    level:            number;
    phase:            number;
    potentialRank:    number;
    favorBattlePhase: number;
    isAssistChar:     boolean;
    uniequipId:       string;
    uniequipLevel:    number;
}
