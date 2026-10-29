import test from "node:test";
import assert from "node:assert/strict";

// Implementação isolada idêntica para validação no runner de testes
const ROUTE_SECRET = "MindCanvas_Secure_Route_2025_#v1";

function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createKeyStream(key, salt, length) {
  const stream = new Uint8Array(length);
  let state = (fnv1a(key) ^ salt) >>> 0;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const keyByte = key.charCodeAt(i % key.length);
    stream[i] = ((state ^ (keyByte * (i + 1))) & 0xff);
  }
  return stream;
}

function encryptRoute(data) {
  const compact = {};
  if (data.id) compact.i = data.id;
  if (data.stage) compact.s = data.stage;
  if (data.from) compact.f = data.from;
  if (data.linha) compact.l = data.linha;
  if (data.retry) compact.r = data.retry;

  const json = JSON.stringify(compact);
  const textBytes = new TextEncoder().encode(json);
  const salt = (Math.floor(Math.random() * 65535) + 1);
  const checksum = (fnv1a(json) & 0xffff);
  const stream = createKeyStream(ROUTE_SECRET, salt, textBytes.length);

  const packet = new Uint8Array(4 + textBytes.length);
  packet[0] = (salt >> 8) & 0xff;
  packet[1] = salt & 0xff;
  packet[2] = (checksum >> 8) & 0xff;
  packet[3] = checksum & 0xff;

  for (let i = 0; i < textBytes.length; i++) {
    packet[4 + i] = textBytes[i] ^ stream[i];
  }

  return Buffer.from(packet).toString("base64url");
}

function decryptRoute(token) {
  if (!token || typeof token !== "string") return null;
  const packet = Buffer.from(token, "base64url");
  if (!packet || packet.length < 5) return null;

  const salt = (packet[0] << 8) | packet[1];
  const checksum = (packet[2] << 8) | packet[3];
  const cipherBytes = packet.subarray(4);

  const stream = createKeyStream(ROUTE_SECRET, salt, cipherBytes.length);
  const textBytes = new Uint8Array(cipherBytes.length);

  for (let i = 0; i < cipherBytes.length; i++) {
    textBytes[i] = cipherBytes[i] ^ stream[i];
  }

  try {
    const json = new TextDecoder().decode(textBytes);
    if ((fnv1a(json) & 0xffff) !== checksum) {
      return null;
    }
    const parsed = JSON.parse(json);
    return {
      id: parsed.i,
      stage: parsed.s,
      from: parsed.f,
      linha: parsed.l,
      retry: parsed.r,
    };
  } catch {
    return null;
  }
}

test("encrypts and decrypts route data with full fidelity", () => {
  const original = {
    id: "664b3694-2cbb-4d21-a3ad-4bcc3415c907",
    stage: "edit",
    from: "projetos",
    linha: "Konectar.me",
  };

  const token = encryptRoute(original);
  assert.ok(typeof token === "string");
  assert.ok(!token.includes("664b3694"), "Token must not expose raw UUID");
  assert.ok(!token.includes("="), "Token must be base64url without padding");
  assert.ok(!token.includes("+"), "Token must not contain +");
  assert.ok(!token.includes("/"), "Token must not contain /");

  const restored = decryptRoute(token);
  assert.equal(restored.id, original.id);
  assert.equal(restored.stage, original.stage);
  assert.equal(restored.from, original.from);
  assert.equal(restored.linha, original.linha);
});

test("returns null for tampered or invalid tokens", () => {
  assert.equal(decryptRoute(""), null);
  assert.equal(decryptRoute("invalid-token-123"), null);
  assert.equal(decryptRoute(null), null);
});

