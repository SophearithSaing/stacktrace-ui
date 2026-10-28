import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorCode } from './models';
import { JsonBodyTooLargeError } from './serialization';

export type FailureKind =
  | 'network'
  | 'unauthenticated'
  | 'credentials'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'deleted'
  | 'too-large'
  | 'media'
  | 'validation'
  | 'rate-limited'
  | 'unavailable'
  | 'server'
  | 'bad-request'
  | 'unexpected'
  | 'cooldown';

interface FailureDetails {
  kind: FailureKind;
  status: number | null;
  code: ApiErrorCode | null;
  fields: Readonly<Record<string, string>>;
  requestIds: { readonly body?: string; readonly header?: string };
  retryAfterMs: number | null;
}

const CODES: Readonly<Record<ApiErrorCode, true>> = {
  invalid_json: true,
  unsupported_media_type: true,
  body_too_large: true,
  validation_failed: true,
  invalid_id: true,
  invalid_idempotency_key: true,
  invalid_cursor: true,
  invalid_query: true,
  unauthenticated: true,
  invalid_credentials: true,
  rate_limited: true,
  unavailable: true,
  forbidden: true,
  not_found: true,
  conflict: true,
  deleted: true,
  request_timeout: true,
  request_cancelled: true,
  internal_error: true,
  method_not_allowed: true,
};

const MESSAGES: Readonly<Record<FailureKind, string>> = {
  network: 'Could not connect. Check your connection and retry.',
  unauthenticated: 'Your session is unavailable. Sign in before trying again.',
  credentials: 'The supplied credentials were not accepted.',
  forbidden: 'This action is not permitted. Refresh your session before trying again.',
  'not-found': 'This resource could not be found.',
  conflict: 'This request conflicts with saved state. Review it before retrying.',
  deleted: 'This content has been deleted.',
  'too-large': 'This request is too large. Reduce its size before trying again.',
  media: 'This request format is not supported.',
  validation: 'Review the highlighted fields before trying again.',
  'rate-limited': 'Too many requests. Wait before retrying.',
  unavailable: 'The service is temporarily unavailable.',
  server: 'The service could not complete this request.',
  'bad-request': 'This request was not accepted. Review its inputs.',
  unexpected: 'The request could not be completed.',
  cooldown: 'Please wait before retrying.',
};

/** Safe normalized failure: no raw bodies, URLs, credentials, or server message. */
export class ApiFailure extends Error implements FailureDetails {
  readonly kind: FailureKind;
  readonly status: number | null;
  readonly code: ApiErrorCode | null;
  readonly fields: Readonly<Record<string, string>>;
  readonly requestIds: FailureDetails['requestIds'];
  readonly retryAfterMs: number | null;

  /**
   * Creates a safe, fixed-message failure.
   * @param details Validated transport-independent details.
   */
  constructor(details: FailureDetails) {
    super(MESSAGES[details.kind]);
    this.name = 'ApiFailure';
    this.kind = details.kind;
    this.status = details.status;
    this.code = details.code;
    this.fields = details.fields;
    this.requestIds = details.requestIds;
    this.retryAfterMs = details.retryAfterMs;
  }
}

/**
 * Normalizes untrusted HTTP/non-HTTP failures without retaining private payloads.
 * @param error Original failure.
 * @param now Current epoch milliseconds for deterministic Retry-After parsing.
 * @returns Safe typed failure for action/field feedback.
 */
export function normalizeFailure(error: unknown, now = Date.now()): ApiFailure {
  if (error instanceof ApiFailure) {
    return error;
  }
  const http = error instanceof HttpErrorResponse ? error : null;
  const body: unknown = http?.error;
  const envelope = record(body);
  const detail = record(envelope?.['error']);
  const code = knownCode(detail?.['code']);
  const status = http?.status ?? null;
  return new ApiFailure({
    kind: error instanceof JsonBodyTooLargeError ? 'too-large' : failureKind(status, code),
    status,
    code,
    fields: status === 422 ? fieldMessages(detail?.['fields']) : {},
    requestIds: {
      body: requestId(envelope?.['request_id']),
      header: requestId(http?.headers.get('X-Request-ID')),
    },
    retryAfterMs:
      status === 429 || status === 503
        ? retryDelay(http?.headers.get('Retry-After') ?? null, now)
        : null,
  });
}

/**
 * Builds a local cooldown failure without inventing a server response.
 * @returns Safe local retry feedback.
 */
export function cooldownFailure(): ApiFailure {
  return new ApiFailure({
    kind: 'cooldown',
    status: null,
    code: null,
    fields: {},
    requestIds: {},
    retryAfterMs: null,
  });
}

/**
 * Projects an allowlisted diagnostic; never spread the original error into logs.
 * @param failure Normalized failure.
 * @returns Status/code/request identifiers only, without field or body text.
 */
export function failureDiagnostic(failure: ApiFailure): Omit<FailureDetails, 'fields'> {
  return {
    kind: failure.kind,
    status: failure.status,
    code: failure.code,
    requestIds: { ...failure.requestIds },
    retryAfterMs: failure.retryAfterMs,
  };
}

/**
 * Parses supplied seconds or an HTTP date without shortening valid long delays.
 * @param value Retry-After header.
 * @param now Current epoch milliseconds.
 * @returns Nonnegative delay, or null for a missing/invalid value.
 */
export function retryDelay(value: string | null, now: number): number | null {
  if (!value) {
    return null;
  }
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const delay = Number(text) * 1000;
    return Number.isSafeInteger(delay) && Number.isSafeInteger(now + delay) ? delay : null;
  }
  if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) {
    return null;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

/**
 * Narrows a plain JSON object without trusting arrays or primitive bodies.
 * @param value Untrusted decoded JSON.
 * @returns String-keyed object when present.
 */
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Accepts only documented error codes.
 * @param value Untrusted code.
 * @returns Known code, or null.
 */
function knownCode(value: unknown): ApiErrorCode | null {
  return typeof value === 'string' && Object.hasOwn(CODES, value) ? (value as ApiErrorCode) : null;
}

/**
 * Restricts identifiers to bounded diagnostic-safe characters.
 * @param value Untrusted request identifier.
 * @returns Valid identifier, or undefined.
 */
function requestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
}

/**
 * Preserves documented safe field messages, never arbitrary extra payload fields.
 * @param value Untrusted field-error object.
 * @returns Bounded plain-text messages for known request fields.
 */
function fieldMessages(value: unknown): Readonly<Record<string, string>> {
  const source = record(value);
  const result: Record<string, string> = {};
  for (const key of [
    'username',
    'password',
    'display_name',
    'body',
    'quoted_post_id',
    'kind',
    'code',
    'code.language',
    'code.filename',
    'code.source',
  ]) {
    const message = source?.[key];
    if (
      typeof message === 'string' &&
      message.length > 0 &&
      [...message].length <= 240 &&
      !/[\u0000-\u001f\u007f<>]/.test(message)
    ) {
      result[key] = message;
    }
  }
  return result;
}

/**
 * Gives HTTP semantics priority over a possibly malformed server error code.
 * @param status HTTP status, or null for local failures.
 * @param code Recognized API code, if present.
 * @returns Explicit failure category.
 */
function failureKind(status: number | null, code: ApiErrorCode | null): FailureKind {
  switch (status) {
    case 0:
      return 'network';
    case 400:
      return 'bad-request';
    case 401:
      return code === 'invalid_credentials' ? 'credentials' : 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
      return 'conflict';
    case 410:
      return 'deleted';
    case 413:
      return 'too-large';
    case 415:
      return 'media';
    case 422:
      return 'validation';
    case 429:
      return 'rate-limited';
    case 500:
      return 'server';
    case 503:
      return 'unavailable';
    default:
      return 'unexpected';
  }
}
