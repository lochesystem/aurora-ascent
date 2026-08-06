import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renderiza a identidade final do jogo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Aurora Ascent — Aventura 3D<\/title>/i);
  assert.match(html, /jogo de plataforma 3D/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  assert.match(html, /og\.png/);
});

test("mantém os sistemas essenciais da fase no bundle-fonte", async () => {
  const [shell, engine, settings, packageJson] = await Promise.all([
    readFile(new URL("../app/game/GameShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(engine, /computeColliderMovement/);
  assert.match(engine, /jumpsRemaining = 2/);
  assert.match(engine, /isDoubleJump/);
  assert.match(engine, /generateLevel/);
  assert.match(engine, /fireProjectile/);
  assert.match(engine, /vibrationActuator/);
  assert.match(shell, /Você caiu/);
  assert.match(shell, /Pulo duplo/);
  assert.match(shell, /DualSense/);
  assert.match(shell, /Mapa de fases/);
  assert.match(shell, /aurora-ascent-progress/);
  assert.match(engine, /DualSense conectado/);
  assert.match(settings, /localStorage/);
  assert.match(packageJson, /@dimforge\/rapier3d-compat/);
  assert.match(packageJson, /"three"/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
