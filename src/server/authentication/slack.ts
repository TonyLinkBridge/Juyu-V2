/** Fixed, server-side Slack endpoint. The injectable transport is used only by local protocol tests. */
export async function slackUserInfo(token: string, transport: typeof fetch = fetch): Promise<unknown> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (!token || /\s/.test(token) || token.length > 8192) throw new Error();
    const response = await transport('https://slack.com/api/openid.connect.userInfo', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(); }
    reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 65536) throw new Error();
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { if (reader) await reader.cancel().catch(() => {}); throw new Error('SLACK_UNAVAILABLE'); }
  finally { reader?.releaseLock(); }
}
