interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export async function sendEvolutionText(
  config: EvolutionConfig,
  phone: string,
  text: string,
): Promise<boolean> {
  const apiUrl = config.apiUrl.replace(/\/+$/, '');
  const instance = encodeURIComponent(config.instance);
  const number = phone.replace(/\D/g, '').replace(/^0+/, '');

  if (!apiUrl || !config.apiKey || !config.instance || !number) return false;

  const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      number: number.startsWith('55') ? number : `55${number}`,
      text,
    }),
  });

  if (!response.ok) {
    console.error('[evolution] sendText failed:', response.status);
  }
  return response.ok;
}
