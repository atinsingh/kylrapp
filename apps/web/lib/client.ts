import { createClient } from '@klyr/api-client';

/** Browser-side calls go through the same-origin proxy in app/api/[...path], which holds the session cookie. */
export const klyr = createClient({ baseUrl: '/api' });
export { errorText } from '@klyr/api-client';
