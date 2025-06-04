import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import cryptoNode from 'crypto';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import wasm from './loadWasm.js';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = 'https://online.mbbank.com.vn';
const auth = "Basic RU1CUkVUQUlMV0VCOlNEMjM0ZGZnMzQlI0BGR0AzNHNmc2RmNDU4NDNm";
const wasmPath = './main.wasm';
let wasmDownloaded = false;

async function ensureWasmDownloaded(client) {
  if (wasmDownloaded || fs.existsSync(wasmPath)) {
    wasmDownloaded = true;
    return;
  }

  const response = await client.get(`${BASE_URL}/assets/wasm/main.wasm`, { responseType: "stream" });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(wasmPath);
    response.data.pipe(writer);
    writer.on('finish', () => {
      wasmDownloaded = true;
      resolve();
    });
    writer.on('error', reject);
  });
}

function translateTransaction(tx) {
  return {
    posting_date: tx.postingDate || '',
    transaction_date: tx.transactionDate || '',
    account_number: tx.accountNo || '',
    credit_amount: tx.creditAmount || '',
    debit_amount: tx.debitAmount || '',
    currency: tx.currency || '',
    description: tx.description || '',
    additional_description: tx.addDescription || '',
    available_balance: tx.availableBalance || '',
    beneficiary_account: tx.beneficiaryAccount || '',
    reference_number: tx.refNo || '',
    beneficiary_name: tx.benAccountName || '',
    bank_name: tx.bankName || '',
    beneficiary_account_number: tx.benAccountNo || '',
    due_date: tx.dueDate || '',
    document_id: tx.docId || '',
    transaction_type: tx.transactionType || '',
    location: tx.pos || '',
    tracing_type: tx.tracingType || ''
  };
}

async function getAllTransactions(payload, accountNo, fromDate, toDate) {
  const url = `${BASE_URL}/api/retail-transactionms/transactionms/get-account-transaction-history`;

  const headers = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json; charset=UTF-8',
    authorization: auth,
    origin: BASE_URL,
    referer: `${BASE_URL}/information-account/source-account`,
    app: 'MB_WEB',
    deviceid: payload.deviceIdCommon,
    refno: payload.refNo,
    'x-request-id': payload.refNo,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
  };

  const data = {
    accountNo,
    deviceIdCommon: payload.deviceIdCommon,
    fromDate,
    refNo: payload.refNo,
    sessionId: payload.sessionId,
    toDate
  };

  const response = await axios.post(url, data, { headers });
  return response.data;
}

async function solveCaptcha(base64Image) {
  const url = "http://103.72.96.214:8277/api/captcha/mbbank";
  const headers = { "Content-Type": "application/json" };
  const payload = JSON.stringify({ base64: base64Image });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
  });

  if (!response.ok) throw new Error("Captcha API error");
  const result = await response.json();

  if (result.status !== "success") throw new Error("Captcha solve failed");
  return result.captcha;
}

async function loginMBBank(username, password) {
  const deviceIdCommon = "4ncebo1c-mbib-0000-0000-2025052623303333";
  const refNo = `${username}-${Date.now()}`;

  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  // Tải wasm an toàn
  await ensureWasmDownloaded(client);

  // Lấy cookie login
  await client.get(`${BASE_URL}/pl/login`);

  // Lấy captcha
  const captchaRes = await client.post(
    `${BASE_URL}/api/retail-web-internetbankingms/getCaptchaImage`,
    { refNo, deviceIdCommon, sessionId: "" },
    {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Authorization: auth,
        App: "MB_WEB",
        Accept: "application/json, text/plain, */*",
        Referer: `${BASE_URL}/pl/login`,
        Origin: BASE_URL
      }
    }
  );

  const base64Image = captchaRes.data.imageString;
  const captcha = await solveCaptcha(base64Image);

  const loginPayload = {
    userId: username,
    password: cryptoNode.createHash("md5").update(password).digest("hex"),
    captcha,
    ibAuthen2faString: "c722fa8dd6f5179150f472497e022ba0",
    sessionId: null,
    refNo,
    deviceIdCommon
  };

  const dataEnc = await wasm(fs.readFileSync(wasmPath), loginPayload, "0");

  const loginRes = await client.post(
    `${BASE_URL}/api/retail_web/internetbanking/v2.0/doLogin`,
    { dataEnc },
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json; charset=UTF-8",
        app: "MB_WEB",
        authorization: auth,
        refno: refNo,
        origin: BASE_URL,
        referer: `${BASE_URL}/pl/login`,
        "User-Agent": "Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36",
        Cookie: await jar.getCookieString(BASE_URL),
        "x-request-id": refNo
      }
    }
  );

  const sessionId = loginRes.data.sessionId;
  if (!sessionId) throw new Error("Login failed: no sessionId returned");

  return { refNo, sessionId, deviceIdCommon };
}

app.post('/api/mb', async (req, res) => {
  const { account_no, from_date, to_date, username, password } = req.body;

  if (!account_no || !username || !password) {
    return res.status(400).json({ status: 'error', message: 'Missing account_no, username or password' });
  }

  const today = new Date();
  const toDate = to_date || `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const fromDate = from_date || `01/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  try {
    const payload = await loginMBBank(username, password);
    console.log(`✅ [${payload.refNo}] Đăng nhập thành công`);

    const rawData = await getAllTransactions(payload, account_no, fromDate, toDate);
    const txList = rawData.transactionHistoryList || rawData.data?.transactionHistoryList || [];
    const translated = txList.map(translateTransaction);

    res.json({ status: 'success', data: translated });
  } catch (err) {
    console.error(`❌ [${username}] Lỗi:`, err.message);
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
});

app.listen(8277, () => {
  console.log('🚀 Server đang chạy tại http://localhost:8277/api/mb');
});
