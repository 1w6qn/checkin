import {MailMetaInfo, PlayerDataDelta, PlayerDataModel} from "./dto";
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