import axios, { type AxiosInstance } from 'axios';
import { config } from './config';
import { logger } from './logger';

let lastRequest = 0;
const MIN_MS = 500;

async function rateLimit() {
  const wait = MIN_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

export const wcbaClient: AxiosInstance = axios.create({
  baseURL: config.wcba.baseUrl,
  timeout: 15_000,
  headers: {
    'Referer':        'https://www.cba.net.cn/',
    'User-Agent':     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept':         'application/json, text/plain, */*',
    'Accept-Language':'zh-CN,zh;q=0.9',
  },
});

wcbaClient.interceptors.request.use(async req => { await rateLimit(); return req; });
wcbaClient.interceptors.response.use(
  res => res,
  err => {
    logger.error('WCBA request failed', { url: err.config?.url, status: err.response?.status ?? 'network' });
    return Promise.reject(err);
  },
);

export const ucoreClient: AxiosInstance = axios.create({
  baseURL: config.ucore.apiUrl,
  timeout: 30_000,
  headers: {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${config.ucore.ingestKey}`,
  },
});

ucoreClient.interceptors.response.use(
  res => res,
  err => {
    logger.error('UCore request failed', { url: err.config?.url, status: err.response?.status ?? 'network' });
    return Promise.reject(err);
  },
);
