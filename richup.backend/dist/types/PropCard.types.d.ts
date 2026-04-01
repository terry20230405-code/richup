import type { Timestamp } from './Common.types';
/**
 * The six property card types defined in the PRD.
 * Card hand contents are server-private; only the *type* is revealed when used.
 */
export declare enum PropCardType {
    FORCED_TRADE = "FORCED_TRADE",// 强制交易卡：按原价强买他人空地
    REMOTE_DICE = "REMOTE_DICE",// 遥控骰子：自选5/6/7步移动
    PLUNDER = "PLUNDER",// 掠夺卡：抢目标玩家现金的50%
    IMMUNITY = "IMMUNITY",// 免付卡：下次踩他人地盘免过路费
    AUDIT = "AUDIT",// 验资卡：私密查看所有人当前现金
    PRICE_HIKE = "PRICE_HIKE"
}
export interface PropCard {
    id: string;
    type: PropCardType;
    acquiredAt: Timestamp;
}
//# sourceMappingURL=PropCard.types.d.ts.map