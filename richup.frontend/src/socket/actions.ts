import type { ProposeTrade, TileId, UsePropCard } from '@/types';
import type {
  ClientActionPayloads,
  GameActionEvent,
  ReconnectActionPayload,
} from '@/types/socket';

import { gameSocket } from './client';

type EmptyPayload = Record<string, never>;

const EMPTY_PAYLOAD: EmptyPayload = {};

const emitAction = gameSocket.emit.bind(gameSocket) as <TEvent extends GameActionEvent>(
  event: TEvent,
  payload: ClientActionPayloads[TEvent],
) => void;

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
  emitAction('action:CASINO_BET', { amount });
};

export const payBail = (): void => {
  emitAction('action:PAY_BAIL', EMPTY_PAYLOAD);
};

export const payTax = (): void => {
  emitAction('action:PAY_TAX', EMPTY_PAYLOAD);
};

export const placeAuctionBid = (amount: number): void => {
  emitAction('action:AUCTION_BID', { amount });
};

export const passAuction = (): void => {
  emitAction('action:AUCTION_PASS', EMPTY_PAYLOAD);
};

export const buildHouse = (tileId: TileId): void => {
  emitAction('action:BUILD_HOUSE', { tileId });
};

export const buildHotel = (tileId: TileId): void => {
  emitAction('action:BUILD_HOTEL', { tileId });
};

export const sellBuilding = (tileId: TileId): void => {
  emitAction('action:SELL_BUILDING', { tileId });
};

export const mortgageProperty = (tileId: TileId): void => {
  emitAction('action:MORTGAGE', { tileId });
};

export const unmortgageProperty = (tileId: TileId): void => {
  emitAction('action:UNMORTGAGE', { tileId });
};

export const proposeTrade = (payload: ProposeTrade): void => {
  emitAction('action:PROPOSE_TRADE', payload);
};

export const acceptTrade = (tradeId: string): void => {
  emitAction('action:ACCEPT_TRADE', { tradeId });
};

export const rejectTrade = (tradeId: string): void => {
  emitAction('action:REJECT_TRADE', { tradeId });
};

export const cancelTrade = (tradeId: string): void => {
  emitAction('action:CANCEL_TRADE', { tradeId });
};

export const usePropCard = (payload: UsePropCard): void => {
  emitAction('action:USE_PROP_CARD', payload);
};

export const reconnectAction = (payload: ReconnectActionPayload): void => {
  emitAction('action:RECONNECT', payload);
};
