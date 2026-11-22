import { base32Encode } from './totp';

export interface MigratedOtpAccount {
  name: string;
  issuer: string;
  secret: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
}

function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < bytes.length) {
    const b = bytes[pos++]!;
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      return [result >>> 0, pos];
    }
    shift += 7;
    if (shift > 35) {
      throw new Error('Protobuf varint overflow.');
    }
  }
  throw new Error('Unexpected end of protobuf stream.');
}

function decodeBase64UrlOrStd(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function parseOtpParameters(buf: Uint8Array): MigratedOtpAccount | null {
  let pos = 0;
  let secretBytes: Uint8Array | null = null;
  let name = '';
  let issuer = '';
  let algoCode = 1;
  let digitsCode = 1;
  let typeCode = 2;

  const decoder = new TextDecoder();

  while (pos < buf.length) {
    const [tag, nextPos] = readVarint(buf, pos);
    pos = nextPos;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      const [val, afterVal] = readVarint(buf, pos);
      pos = afterVal;
      if (fieldNum === 4) algoCode = val;
      else if (fieldNum === 5) digitsCode = val;
      else if (fieldNum === 6) typeCode = val;
    } else if (wireType === 2) {
      const [len, afterLen] = readVarint(buf, pos);
      pos = afterLen;
      const slice = buf.subarray(pos, pos + len);
      pos += len;
      if (fieldNum === 1) secretBytes = slice;
      else if (fieldNum === 2) name = decoder.decode(slice);
      else if (fieldNum === 3) issuer = decoder.decode(slice);
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }

  // Only import TOTP (type 2 or unspecified 0) with non-empty secret
  if (!secretBytes || secretBytes.length === 0 || typeCode === 1) {
    return null;
  }

  const algorithm: 'SHA1' | 'SHA256' | 'SHA512' =
    algoCode === 2 ? 'SHA256' : algoCode === 3 ? 'SHA512' : 'SHA1';
  const digits = digitsCode === 2 ? 8 : 6;

  // Clean up "Issuer:Account" format if name contains prefix
  let cleanName = name.trim();
  let cleanIssuer = issuer.trim();
  if (cleanName.includes(':')) {
    const parts = cleanName.split(':');
    if (!cleanIssuer) cleanIssuer = parts[0]!.trim();
    cleanName = parts.slice(1).join(':').trim();
  }

  return {
    name: cleanName || cleanIssuer || 'Imported Account',
    issuer: cleanIssuer,
    secret: base32Encode(secretBytes),
    algorithm,
    digits,
    period: 30,
  };
}

/**
 * Decode a Google Authenticator `otpauth-migration://offline?data=...` URI.
 */
export function parseGoogleAuthMigrationUri(uri: string): MigratedOtpAccount[] {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith('otpauth-migration://')) {
    throw new Error('Invalid Google Authenticator migration URI.');
  }

  const url = new URL(trimmed);
  const dataParam = url.searchParams.get('data');
  if (!dataParam) {
    throw new Error('Missing data parameter in migration URI.');
  }

  const payload = decodeBase64UrlOrStd(dataParam);
  const accounts: MigratedOtpAccount[] = [];
  let pos = 0;

  while (pos < payload.length) {
    const [tag, nextPos] = readVarint(payload, pos);
    pos = nextPos;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;

    if (wireType === 2) {
      const [len, afterLen] = readVarint(payload, pos);
      pos = afterLen;
      const slice = payload.subarray(pos, pos + len);
      pos += len;
      if (fieldNum === 1) {
        const parsed = parseOtpParameters(slice);
        if (parsed) accounts.push(parsed);
      }
    } else if (wireType === 0) {
      const [, afterVal] = readVarint(payload, pos);
      pos = afterVal;
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }

  return accounts;
}
