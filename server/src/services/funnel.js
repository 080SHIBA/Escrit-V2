import { FunnelEvent } from '../models/FunnelEvent.js';

export function recordFunnelEvent(event, { userId = null, linkId = '', transactionId = '' } = {}) {
  return FunnelEvent.create({ event, userId, linkId, transactionId });
}
