/** Creator page URL, e.g. "marcus" -> "/creator/%40marcus" (shown as /creator/@marcus). */
export const creatorPath = (handle: string) => `/creator/${encodeURIComponent(`@${handle}`)}`;
