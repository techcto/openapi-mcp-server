import https from 'node:https';

// Mirrors the pattern AWS itself uses for EKS cluster auth (aws-iam-authenticator):
// the caller presigns an sts:GetCallerIdentity request with their own SigV4
// credentials, we call that exact presigned URL against real AWS STS, and if STS
// accepts it we know which IAM principal signed it - no shared secret, no SigV4
// canonicalization to reimplement or get subtly wrong on our end.
const TOKEN_PREFIX = 'mcp-aws-v1.';
const MAX_TOKEN_TTL_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 30;
const STS_REQUEST_TIMEOUT_MS = 5000;

function parseStsUrlFromToken(token) {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  let decoded;
  try {
    decoded = Buffer.from(token.slice(TOKEN_PREFIX.length), 'base64url').toString('utf8');
  } catch {
    return null;
  }

  try {
    return new URL(decoded);
  } catch {
    return null;
  }
}

function isValidStsUrl(url) {
  if (url.protocol !== 'https:') {
    return false;
  }

  return url.hostname === 'sts.amazonaws.com' || /^sts\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname);
}

function isGetCallerIdentity(url) {
  return url.searchParams.get('Action') === 'GetCallerIdentity';
}

function isFresh(url) {
  const amzDate = url.searchParams.get('X-Amz-Date') || '';
  const expiresRaw = url.searchParams.get('X-Amz-Expires') || '';

  if (!/^\d{8}T\d{6}Z$/.test(amzDate)) {
    return false;
  }

  const expiresSeconds = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0 || expiresSeconds > MAX_TOKEN_TTL_SECONDS) {
    return false;
  }

  const iso = `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`;
  const signedAtMs = Date.parse(iso);
  if (!Number.isFinite(signedAtMs)) {
    return false;
  }

  const ageSeconds = (Date.now() - signedAtMs) / 1000;
  return ageSeconds >= -CLOCK_SKEW_SECONDS && ageSeconds <= expiresSeconds + CLOCK_SKEW_SECONDS;
}

function fetchCallerIdentity(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { Accept: 'application/json' } }, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`STS returned HTTP ${response.statusCode}`));
          return;
        }
        resolve(body);
      });
    });

    request.on('error', reject);
    request.setTimeout(STS_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('STS GetCallerIdentity request timed out'));
    });
  });
}

function extractArn(responseBody) {
  const jsonMatch = responseBody.match(/"Arn"\s*:\s*"([^"]+)"/);
  if (jsonMatch) {
    return jsonMatch[1];
  }

  const xmlMatch = responseBody.match(/<Arn>([^<]+)<\/Arn>/);
  return xmlMatch ? xmlMatch[1] : null;
}

function arnMatchesPattern(arn, pattern) {
  if (arn === pattern) {
    return true;
  }

  if (!pattern.includes('*')) {
    return false;
  }

  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}$`).test(arn);
}

/**
 * Verifies an "mcp-aws-v1.<base64url presigned GetCallerIdentity URL>" token.
 * Returns the caller's IAM ARN if the token is a genuine, fresh, allowlisted
 * AWS identity - otherwise null. Never throws.
 */
export async function verifySigv4Token(token, allowedArns) {
  if (!Array.isArray(allowedArns) || allowedArns.length === 0) {
    return null;
  }

  const url = parseStsUrlFromToken(token);
  if (!url || !isValidStsUrl(url) || !isGetCallerIdentity(url) || !isFresh(url)) {
    return null;
  }

  let body;
  try {
    body = await fetchCallerIdentity(url);
  } catch {
    return null;
  }

  const arn = extractArn(body);
  if (!arn) {
    return null;
  }

  return allowedArns.some((pattern) => arnMatchesPattern(arn, pattern)) ? arn : null;
}

export const SIGV4_TOKEN_PREFIX = TOKEN_PREFIX;
