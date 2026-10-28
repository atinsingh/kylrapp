/** Queue names shared by the API (producer) and the worker (consumer). */
export const QUEUES = {
  /** Pulls PropTx VOW changes every few minutes and upserts listings. */
  listingFeed: 'listing-feed',
  /** Condition, irrevocable and deposit deadlines → push, email, and SMS inside 24 h. */
  deadlines: 'deadlines',
  /** Saved-search alerts. */
  alerts: 'alerts',
} as const;
