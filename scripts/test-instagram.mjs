// Teste manual da integração com Instagram, sem publicar nada (por padrão).
// Uso:
//   node --env-file=.env.local scripts/test-instagram.mjs                # só valida token + IG_USER_ID
//   node --env-file=.env.local scripts/test-instagram.mjs --container    # também cria um container de teste (não publica)
//   node --env-file=.env.local scripts/test-instagram.mjs --publish      # cria E publica de verdade (aparece no perfil!)

const userId = process.env.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN;
const version = process.env.IG_GRAPH_VERSION || "v21.0";

if (!userId || !token) {
  console.error("Defina IG_USER_ID e IG_ACCESS_TOKEN (ex.: node --env-file=.env.local scripts/test-instagram.mjs)");
  process.exit(1);
}

// Conta criada via "API setup with Instagram login" usa o host graph.instagram.com,
// não graph.facebook.com (que é o host da integração antiga via Página do Facebook).
const base = `https://graph.instagram.com/${version}`;
const testImageUrl = "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg";

async function checkAccount() {
  const res = await fetch(`${base}/${userId}?fields=user_id,username,account_type&access_token=${token}`);
  const data = await res.json();
  console.log(`\n[1/1] GET /${userId} ->`, res.status);
  console.log(JSON.stringify(data, null, 2));
  return res.ok;
}

async function createContainer() {
  const res = await fetch(`${base}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: testImageUrl,
      caption: "teste JornAI (não publicado)",
      access_token: token,
    }),
  });
  const data = await res.json();
  console.log("\n[container] POST /media ->", res.status);
  console.log(JSON.stringify(data, null, 2));
  return data.id;
}

async function publishContainer(creationId) {
  const res = await fetch(`${base}/${userId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  const data = await res.json();
  console.log("\n[publish] POST /media_publish ->", res.status);
  console.log(JSON.stringify(data, null, 2));
}

const ok = await checkAccount();
if (!ok) {
  console.error("\nToken/ID inválidos para graph.instagram.com. Se você configurou via Página do Facebook (fluxo antigo), tente trocar o host pra graph.facebook.com no script.");
  process.exit(1);
}

if (process.argv.includes("--container") || process.argv.includes("--publish")) {
  const creationId = await createContainer();
  if (creationId && process.argv.includes("--publish")) {
    console.log("\nPublicando de verdade em 3s... (Ctrl+C pra cancelar)");
    await new Promise((r) => setTimeout(r, 3000));
    await publishContainer(creationId);
  } else if (creationId) {
    console.log("\nContainer criado e NÃO publicado — expira sozinho em ~24h, nada aparece no perfil.");
  }
}
