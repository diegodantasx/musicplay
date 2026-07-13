import { proxyOriginalMusicAdmin } from './_shared/music-admin-proxy';

export const onRequest: PagesFunction = async ({ request }) => proxyOriginalMusicAdmin(request);
