const ORIGINAL_MUSIC_DEPLOYMENT = 'https://20e64bde.musicplay-83l.pages.dev';

export async function proxyOriginalMusicAdmin(request: Request): Promise<Response> {
  const source = new URL(request.url);
  const target = new URL(source.pathname + source.search, ORIGINAL_MUSIC_DEPLOYMENT);
  const upstream = new Request(target, request);
  return fetch(upstream);
}
