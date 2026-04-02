import type { ProposeTrade, TileId, UsePropCard } from '@/types';
import type { ReconnectActionPayload } from '@/types/socket';

import { gameSocket } from './client';

type EmptyPayload = Record<string, never>;

interface AmountPayload {
  amount: number;
}

interface TileActionPayload {
  tileId: TileId;
}

interface TradeDecisionPayload {
  tradeId: string;
}

export type GameActionEvent =
  | 'action:START_GAME'
  | 'action:ROLL_DICE'
  | 'action:ROLL_FOR_DOUBLE'
  | 'action:END_TURN'
  | 'action:DECLARE_BANKRUPTCY'
  | 'action:BUY_PROPERTY'
  | 'action:CHOOSE_AUCTION'
  | 'action:SKIP_PURCHASE'
  | 'action:TEMPLE_PRAY'
  | 'action:CASINO_BET'
  | 'action:PAY_BAIL'
  | 'action:PAY_TAX'
  | 'action:AUCTION_BID'
  | 'action:AUCTION_PASS'
  | 'action:BUILD_HOUSE'
  | 'action:BUILD_HOTEL'
  | 'action:SELL_BUILDING'
  | 'action:MORTGAGE'
  | 'action:UNMORTGAGE'
  | 'action:PROPOSE_TRADE'
  | 'action:ACCEPT_TRADE'
  | 'action:REJECT_TRADE'
  | 'action:CANCEL_TRADE'
  | 'action:USE_PROP_CARD'
  | 'action:RECONNECT';

const EMPTY_PAYLOAD: EmptyPayload = {};

const emitAction = <TPayload>(event: GameActionEvent, payload: TPayload): void => {
  gameSocket.emit(event, payload);
};

export const startGame = (): void => {
  emitAction('action:START_GAME', EMPTY_PAYLOAD);
};

export const rollDice = (): void => {
  emitAction('action:ROLL_DICE', EMPTY_PAYLOAD);
};

export const rollForDouble = (): void => {
  emitAction('action:ROLL_FOR_DOUBLE', EMPTY_PAYLOAD);
};

export const endTurn = (): void => {
  emitAction('action:END_TURN', EMPTY_PAYLOAD);
};

export const declareBankruptcy = (): void => {
  emitAction('action:DECLARE_BANKRUPTCY', EMPTY_PAYLOAD);
};

export const buyProperty = (): void => {
  emitAction('action:BUY_PROPERTY', EMPTY_PAYLOAD);
};

export const chooseAuction = (): void => {
  emitAction('action:CHOOSE_AUCTION', EMPTY_PAYLOAD);
};

export const skipPurchase = (): void => {
  emitAction('action:SKIP_PURCHASE', EMPTY_PAYLOAD);
};

export const templePray = (): void => {
  emitAction('action:TEMPLE_PRAY', EMPTY_PAYLOAD);
};

export const placeCasinoBet = (amount: number): void => {
  emitAction<AmountPayload>('action:CASINO_BET', { amount });
};

export const payBail = (): void => {
  emitAction('action:PAY_BAIL', EMPTY_PAYLOAD);
};

export const payTax = (): void => {
  emitAction('action:PAY_TAX', EMPTY_PAYLOAD);
};

export const placeAuctionBid = (amount: number): void => {
  emitAction<AmountPayload>('action:AUCTION_BID', { amount });
};

export const passAuction = (): void => {
  emitAction('action:AUCTION_PASS', EMPTY_PAYLOAD);
};

export const buildHouse = (tileId: TileId): void => {
  emitAction<TileActionPayload>('action:BUILD_HOUSE', { tileId });
};

export const buildHotel = (tileId: TileId): void => {
  emitAction<TileActionPayload>('action:BUILD_HOTEL', { tileId });
};

export const sellBuilding = (tileId: TileId): void => {
  emitAction<TileActionPayload>('action:SELL_BUILDING', { tileId });
};

export const mortgageProperty = (tileId: TileId): void => {
  emitAction<TileActionPayload>('action:MORTGAGE', { tileId });
};

export const unmortgageProperty = (tileId: TileId): void => {
  emitAction<TileActionPayload>('action:UNMORTGAGE', { tileId });
};

export const proposeTrade = (payload: ProposeTrade): void => {
  emitAction('action:PROPOSE_TRADE', payload);
};

export const acceptTrade = (tradeId: string): void => {
  emitAction<TradeDecisionPayload>('action:ACCEPT_TRADE', { tradeId });
};

export const rejectTrade = (tradeId: string): void => {
  emitAction<TradeDecisionPayload>('action:REJECT_TRADE', { tradeId });
};

export const cancelTrade = (tradeId: string): void => {
  emitAction<TradeDecisionPayload>('action:CANCEL_TRADE', { tradeId });
};

export const usePropCard = (payload: UsePropCard): void => {
  emitAction('action:USE_PROP_CARD', payload);
};

export const reconnectAction = (payload: ReconnectActionPayload): void => {
  emitAction('action:RECONNECT', payload);
};
