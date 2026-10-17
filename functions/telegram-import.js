/**
 * Standalone admin page: import files posted manually into the Telegram
 * channel so they appear in the AnimeLK Storage manager.
 *
 * Open https://YOUR-SITE/telegram-import in the SAME browser where you are
 * logged into the dashboard (it reuses the dashboard session).
 */

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telegram Import · AnimeLK Storage</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #f4f6fb; color: #1c2333; padding: 24px; }
  @media (prefers-color-scheme: dark) { body { background: #10131c; color: #e7eaf3; } }
  .card { width: 100%; max-width: 640px; background: #fff; border-radius: 16px; padding: 28px;
          box-shadow: 0 8px 30px rgba(20, 30, 60, .08); }
  @media (prefers-color-scheme: dark) { .card { background: #191e2b; box-shadow: 0 8px 30px rgba(0,0,0,.4); } }
  h1 { margin: 0 0 6px; font-size: 20px; }
  p.sub { margin: 0 0 20px; font-size: 13px; opacity: .7; line-height: 1.5; }
  label { display: block; font-size: 12px; font-weight: 600; margin: 14px 0 6px; opacity: .8; }
  input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(120,130,160,.35);
          background: transparent; color: inherit; font-size: 14px; }
  button { margin-top: 20px; width: 100%; padding: 12px; border: 0; border-radius: 10px; cursor: pointer;
           background: #4f6ef7; color: #fff; font-size: 15px; font-weight: 600; }
  button:disabled { opacity: .6; cursor: wait; }
  #status { margin-top: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
  .ok { color: #1a9a5c; } .err { color: #d64545; }
  ul { margin: 10px 0 0; padding-left: 18px; font-size: 13px; }
  li { margin: 4px 0; }
  a { color: #4f6ef7; word-break: break-all; }
</style>
</head>
<body>
  <div class="card">
    <h1>📥 Import from Telegram</h1>
    <p class="sub">Register files that were posted <b>manually</b> into your Telegram channel (from the Telegram app) so they appear in the AnimeLK Storage manager. Log into the dashboard in this browser first. Big files need the self-hosted Bot API server as the channel proxy.</p>
    <label>Channel name (empty = all channels)</label>
    <input id="channel" placeholder="e.g. my channel name">
    <label>Upload folder (optional)</label>
    <input id="folder" placeholder="e.g. manual-uploads">
    <button id="go">Scan channel &amp; import</button>
    <div id="status"></div>
  </div>
<script>
  const btn = document.getElementById('go');
  const statusEl = document.getElementById('status');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = 'Scanning the Telegram channel…';
    try {
      const res = await fetch('/api/manage/telegramImport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: document.getElementById('channel').value.trim(),
          uploadFolder: document.getElementById('folder').value.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        statusEl.className = 'err';
        statusEl.textContent = 'Not authorized. Open the AnimeLK Storage dashboard and log in as admin in this browser tab first, then try again.';
        return;
      }
      if (!res.ok || !data.success) {
        statusEl.className = 'err';
        statusEl.textContent = 'Import failed: ' + (data.error || ('HTTP ' + res.status));
        return;
      }
      let html = '<span class="ok">Imported ' + data.imported + ' file(s).</span>';
      if (data.errors && data.errors.length) html += '\\n' + data.errors.join('\\n');
      if (data.files && data.files.length) {
        html += '<ul>' + data.files.map(f =>
          '<li>' + f.name + ' (' + f.size + ') — <a href="/file/' + encodeURIComponent(f.id) + '" target="_blank">' + location.origin + '/file/' + f.id + '</a></li>'
        ).join('') + '</ul>';
      } else if (data.imported === 0) {
        html += '\\nNo new channel posts found. Post a file into the channel from the Telegram app, then run this again.';
      }
      statusEl.innerHTML = html.replace(/\\n/g, '<br>');
    } catch (e) {
      statusEl.className = 'err';
      statusEl.textContent = 'Request failed: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  });
</script>
</body>
</html>`;

export async function onRequest(context) {
    const { request } = context;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Use GET', { status: 405 });
    }
    return new Response(request.method === 'HEAD' ? null : PAGE, {
        status: 200,
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'private, no-store, max-age=0',
        },
    });
}
