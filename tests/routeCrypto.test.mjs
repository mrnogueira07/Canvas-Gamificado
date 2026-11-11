import fs from "node:fs";
import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";

const js = ts.transpile(fs.readFileSync("src/lib/routeCrypto.ts", "utf8"), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const api = {};
new Function("exports", js)(api);
const { encryptRoute, decryptRoute, buildEncryptedUrl, resolveRouteParams } = api;

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

test("encrypts and resolves view and download flags for Master read-only inspection", () => {
  const url = buildEncryptedUrl("/canvas-generator/matheus-nogueira", {
    id: "proj_other_user_99",
    from: "ranking",
    view: "1",
    download: "1",
  });
  assert.ok(url.startsWith("/canvas-generator/matheus-nogueira?p="));
  const query = url.split("?")[1];
  const resolved = resolveRouteParams(new URLSearchParams(query));
  assert.equal(resolved.id, "proj_other_user_99");
  assert.equal(resolved.from, "ranking");
  assert.equal(resolved.view, "1");
  assert.equal(resolved.download, "1");
});

test("returns null for tampered or invalid tokens", () => {
  assert.equal(decryptRoute(""), null);
  assert.equal(decryptRoute("invalid-token-123"), null);
  assert.equal(decryptRoute(null), null);
});

