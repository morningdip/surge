/**
 * 1min.ai 每日自動簽到
 *
 * 支援 Surge / Loon / Stash / Quantumult X（cron 定時任務腳本，無需 MITM）
 *
 * 參數（argument）：
 *   email    - 1min.ai 登入信箱
 *   password - 登入密碼
 *   totp     - MFA 金鑰（未啟用 MFA 填 null 或留空）
 *
 * 流程：
 *   1. 讀取快取 JWT（先本地檢查過期時間，再以 credits API 驗證）
 *   2. 無效則以帳密登入（必要時以內建 TOTP 完成 MFA 驗證）
 *   3. 呼叫 notifications API 觸發每日簽到獎勵
 *   4. 查詢最終點數並發送通知
 */

const API_BASE = 'https://api.1min.ai';
const NOTIFY_TITLE = '1min.ai 簽到';
const REQUEST_TIMEOUT_MS = 10000;
const BONUS_WAIT_MS = 3000;
// JWT 剩餘有效期低於此值視為過期，避免流程中途失效
const JWT_EXPIRY_MARGIN_MS = 60000;

// ===== 環境抽象層（Surge / Loon / Stash 用 $httpClient，Quantumult X 用 $task）=====
const $ = (() => {
    const isQX = typeof $task !== 'undefined';

    const request = (method, { url, headers, body }) =>
        new Promise((resolve, reject) => {
            let settled = false;
            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                fn(value);
            };
            const timer = setTimeout(
                () => finish(reject, new Error(`請求逾時: ${url}`)),
                REQUEST_TIMEOUT_MS
            );

            if (isQX) {
                $task.fetch({ url, method: method.toUpperCase(), headers, body }).then(
                    (resp) => finish(resolve, { status: resp.statusCode, body: resp.body }),
                    (err) => finish(reject, new Error((err && err.error) || '網路錯誤'))
                );
            } else {
                $httpClient[method]({ url, headers, body }, (error, response, data) => {
                    if (error) {
                        finish(reject, new Error(String(error)));
                    } else {
                        finish(resolve, {
                            status: response.status || response.statusCode,
                            body: data,
                        });
                    }
                });
            }
        });

    return {
        argument: typeof $argument === 'string' ? $argument : '',
        get: (options) => request('get', options),
        post: (options) => request('post', options),
        storeRead: (key) => (isQX ? $prefs.valueForKey(key) : $persistentStore.read(key)),
        storeWrite: (value, key) =>
            isQX ? $prefs.setValueForKey(value, key) : $persistentStore.write(value, key),
        storeRemove: (key) =>
            isQX ? $prefs.removeValueForKey(key) : $persistentStore.write(null, key),
        notify: (subtitle, message) =>
            isQX
                ? $notify(NOTIFY_TITLE, subtitle, message)
                : $notification.post(NOTIFY_TITLE, subtitle, message),
        done: () => $done(),
    };
})();

// ===== 內建 TOTP（RFC 6238，base32 + HMAC-SHA1，零外部依賴）=====
const TOTP = (() => {
    const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    function base32Decode(input) {
        const clean = input.toUpperCase().replace(/[\s=-]/g, '');
        const bytes = [];
        let buffer = 0;
        let bits = 0;
        for (const char of clean) {
            const index = BASE32_ALPHABET.indexOf(char);
            if (index === -1) throw new Error(`TOTP 金鑰含無效字元: ${char}`);
            buffer = (buffer << 5) | index;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                bytes.push((buffer >>> bits) & 0xff);
            }
        }
        return bytes;
    }

    const rotl = (n, b) => ((n << b) | (n >>> (32 - b))) >>> 0;

    function sha1(bytes) {
        let h0 = 0x67452301;
        let h1 = 0xefcdab89;
        let h2 = 0x98badcfe;
        let h3 = 0x10325476;
        let h4 = 0xc3d2e1f0;

        const bitLength = bytes.length * 8;
        const msg = bytes.slice();
        msg.push(0x80);
        while (msg.length % 64 !== 56) msg.push(0);
        for (let i = 7; i >= 0; i--) msg.push(Math.floor(bitLength / 2 ** (8 * i)) & 0xff);

        for (let offset = 0; offset < msg.length; offset += 64) {
            const w = new Array(80);
            for (let i = 0; i < 16; i++) {
                w[i] =
                    (msg[offset + 4 * i] << 24) |
                    (msg[offset + 4 * i + 1] << 16) |
                    (msg[offset + 4 * i + 2] << 8) |
                    msg[offset + 4 * i + 3];
            }
            for (let i = 16; i < 80; i++) {
                w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            }

            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let e = h4;
            for (let i = 0; i < 80; i++) {
                let f;
                let k;
                if (i < 20) {
                    f = (b & c) | (~b & d);
                    k = 0x5a827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ed9eba1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8f1bbcdc;
                } else {
                    f = b ^ c ^ d;
                    k = 0xca62c1d6;
                }
                const temp = (rotl(a, 5) + (f >>> 0) + e + k + (w[i] >>> 0)) >>> 0;
                e = d;
                d = c;
                c = rotl(b, 30);
                b = a;
                a = temp;
            }
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
        }

        const out = [];
        for (const h of [h0, h1, h2, h3, h4]) {
            out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
        }
        return out;
    }

    function hmacSha1(key, message) {
        const normalizedKey = key.length > 64 ? sha1(key) : key;
        const ipad = new Array(64);
        const opad = new Array(64);
        for (let i = 0; i < 64; i++) {
            const k = normalizedKey[i] || 0;
            ipad[i] = k ^ 0x36;
            opad[i] = k ^ 0x5c;
        }
        return sha1(opad.concat(sha1(ipad.concat(message))));
    }

    function generate(secret, options) {
        const { period = 30, digits = 6, timestamp = Date.now() } = options || {};
        const key = base32Decode(secret);
        let counter = Math.floor(timestamp / 1000 / period);
        const message = new Array(8);
        for (let i = 7; i >= 0; i--) {
            message[i] = counter & 0xff;
            counter = Math.floor(counter / 256);
        }
        const digest = hmacSha1(key, message);
        const offset = digest[19] & 0x0f;
        const code =
            (digest[offset] & 0x7f) * 16777216 +
            digest[offset + 1] * 65536 +
            digest[offset + 2] * 256 +
            digest[offset + 3];
        return String(code % 10 ** digits).padStart(digits, '0');
    }

    return { generate };
})();

// ===== 工具函式 =====
function parseArguments(raw) {
    const args = {};
    for (const pair of raw.split('&')) {
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        const key = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        try {
            args[key] = decodeURIComponent(value);
        } catch (e) {
            args[key] = value;
        }
    }
    return args;
}

// 過濾模組預設值（TOTP:null 會以字串 "null" 傳入）
function normalizeTotpSecret(value) {
    const trimmed = (value || '').trim();
    return trimmed && trimmed !== 'null' && trimmed !== 'undefined' ? trimmed : '';
}

function parseJson(text) {
    try {
        return JSON.parse(text || '{}');
    } catch (e) {
        return {};
    }
}

function base64UrlDecode(input) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    let out = '';
    let buffer = 0;
    let bits = 0;
    for (const char of normalized) {
        const index = alphabet.indexOf(char);
        if (index === -1) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buffer >>> bits) & 0xff);
        }
    }
    return out;
}

// 解析 JWT 過期時間（毫秒），解析失敗回傳 0 視為已過期
function decodeJwtExpiry(token) {
    try {
        const payload = parseJson(base64UrlDecode(token.split('.')[1]));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch (e) {
        return 0;
    }
}

function generateDeviceId() {
    const randomHex = (length) =>
        Array.from({ length }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    return `$device:${randomHex(16)}-${randomHex(15)}-${randomHex(8)}-${randomHex(6)}-${randomHex(16)}`;
}

function formatNumber(num) {
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ===== HTTP 標頭 =====
const BROWSER_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://app.1min.ai',
    Referer: 'https://app.1min.ai/',
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

const authHeaders = (token) => ({ ...BROWSER_HEADERS, 'X-Auth-Token': `Bearer ${token}` });
const loginHeaders = (deviceId) => ({
    ...BROWSER_HEADERS,
    'X-Auth-Token': 'Bearer',
    'Mp-Identity': deviceId,
});

// ===== JWT 快取 =====
function createSessionStore(email) {
    const tokenKey = `1min_jwt_${email}`;
    const userKey = `1min_user_${email}`;
    return {
        load() {
            try {
                const token = $.storeRead(tokenKey);
                const userJson = $.storeRead(userKey);
                if (!token || !userJson) return null;
                return { token, user: JSON.parse(userJson) };
            } catch (e) {
                return null;
            }
        },
        save(token, user) {
            $.storeWrite(token, tokenKey);
            $.storeWrite(JSON.stringify(user), userKey);
        },
        clear() {
            $.storeRemove(tokenKey);
            $.storeRemove(userKey);
        },
    };
}

// ===== 1min.ai API =====
async function apiLogin(email, password, deviceId) {
    const res = await $.post({
        url: `${API_BASE}/auth/login`,
        headers: loginHeaders(deviceId),
        body: JSON.stringify({ email, password }),
    });
    const data = parseJson(res.body);
    if (res.status !== 200 || !data.user) {
        if (res.status === 401) throw new Error(data.message || '帳號或密碼錯誤');
        if (res.status === 429) throw new Error('請求過於頻繁，請稍後再試');
        throw new Error(data.message || `登入失敗 (HTTP ${res.status})`);
    }
    return data;
}

async function apiVerifyMfa(tempToken, code, deviceId) {
    const res = await $.post({
        url: `${API_BASE}/auth/mfa/verify`,
        headers: loginHeaders(deviceId),
        body: JSON.stringify({ code, token: tempToken }),
    });
    const data = parseJson(res.body);
    if (res.status !== 200 || !data.user) {
        throw new Error(data.message || `MFA 驗證失敗 (HTTP ${res.status})`);
    }
    return data;
}

// 401 時擲出帶 unauthorized 標記的錯誤，供呼叫端區分「token 失效」與其他錯誤
async function apiGetCredits(teamId, token) {
    const res = await $.get({
        url: `${API_BASE}/teams/${teamId}/credits`,
        headers: authHeaders(token),
    });
    if (res.status === 401) {
        const error = new Error('token 已失效');
        error.unauthorized = true;
        throw error;
    }
    if (res.status !== 200) throw new Error(`查詢點數失敗 (HTTP ${res.status})`);
    const data = parseJson(res.body);
    if (typeof data.credit !== 'number') throw new Error('點數回應格式異常');
    return data.credit;
}

// 呼叫未讀通知 API 觸發每日簽到獎勵（伺服器端行為），失敗不影響主流程
async function apiTouchNotifications(token) {
    try {
        await $.get({
            url: `${API_BASE}/notifications/unread`,
            headers: authHeaders(token),
        });
    } catch (error) {
        console.log(`⚠️ 觸發簽到請求失敗: ${error.message}`);
    }
}

// ===== 業務邏輯 =====
// 優先選擇訂閱擁有者為自己的 team，否則退回第一個
function findTeam(user) {
    const teams = (user && user.teams) || [];
    const owned = teams.find(
        (t) => t.team && t.team.subscription && t.team.subscription.userId === user.uuid
    );
    const entry = owned || teams[0];
    if (!entry) return null;
    const teamId = entry.teamId || (entry.team && entry.team.uuid);
    if (!teamId) return null;
    return {
        teamId,
        userName: entry.userName || (user.email ? user.email.split('@')[0] : '用戶'),
        usedCredit: entry.usedCredit || 0,
    };
}

// 取得有效登入狀態：快取 token 優先，失效則帳密登入
async function getSession(config, store) {
    const cached = store.load();
    if (cached) {
        if (decodeJwtExpiry(cached.token) > Date.now() + JWT_EXPIRY_MARGIN_MS) {
            const team = findTeam(cached.user);
            if (team) {
                try {
                    await apiGetCredits(team.teamId, cached.token);
                    console.log('✅ 使用快取 token');
                    return cached;
                } catch (error) {
                    if (error.unauthorized) {
                        console.log('⚠️ 快取 token 已被伺服器拒絕，改用帳密登入');
                        store.clear();
                    } else {
                        console.log(`⚠️ 驗證快取 token 失敗（${error.message}），改用帳密登入`);
                    }
                }
            }
        } else {
            console.log('⚠️ 快取 token 已過期，改用帳密登入');
            store.clear();
        }
    }

    console.log('🔑 執行帳密登入');
    const deviceId = generateDeviceId();
    let data = await apiLogin(config.email, config.password, deviceId);

    if (data.user.mfaRequired) {
        if (!config.totpSecret) {
            throw new Error('帳號已啟用 MFA，請在模組參數填入 TOTP 金鑰');
        }
        console.log('🔐 需要 MFA，以 TOTP 驗證');
        data = await apiVerifyMfa(data.user.token, TOTP.generate(config.totpSecret), deviceId);
    }

    const token = data.token || (data.user && data.user.token);
    if (!token) throw new Error('登入回應中找不到 token');
    store.save(token, data.user);
    return { token, user: data.user };
}

// 觸發簽到、計算獎勵並發送通知
async function checkIn(session) {
    const team = findTeam(session.user);
    if (!team) {
        console.log('⚠️ 無法取得團隊資訊');
        $.notify('登入成功', '無法取得團隊資訊，略過簽到');
        return;
    }

    const before = await apiGetCredits(team.teamId, session.token);
    await apiTouchNotifications(session.token);
    await sleep(BONUS_WAIT_MS);

    let after = before;
    try {
        after = await apiGetCredits(team.teamId, session.token);
    } catch (error) {
        console.log(`⚠️ 查詢最終點數失敗（${error.message}），以簽到前點數顯示`);
    }

    const bonus = after - before;
    const total = after + team.usedCredit;
    const percent = total > 0 ? ((after / total) * 100).toFixed(1) : '0.0';

    let message = `${team.userName}｜點數 ${formatNumber(after)} (${percent}%)`;
    if (bonus > 0) message += ` +${formatNumber(bonus)}`;

    console.log(`✅ ${message}`);
    $.notify('簽到完成', message);
}

// ===== 主流程 =====
(async () => {
    console.log('🎬 1min.ai 自動簽到');

    const args = parseArguments($.argument);
    const email = (args.email || '').trim();
    const password = args.password || '';
    if (!email || !password) {
        throw new Error('缺少 email 或 password 參數，請檢查模組設定');
    }

    const store = createSessionStore(email);
    const session = await getSession(
        { email, password, totpSecret: normalizeTotpSecret(args.totp) },
        store
    );
    await checkIn(session);
})()
    .catch((error) => {
        console.log(`❌ ${error.message}`);
        $.notify('執行失敗', error.message);
    })
    .finally(() => $.done());
