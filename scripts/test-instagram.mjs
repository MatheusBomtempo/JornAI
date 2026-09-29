// Manual test of the Instagram integration, without publishing anything (by default).
// Usage:
//   node --env-file=.env.local scripts/test-instagram.mjs                # only validates the token + IG_USER_ID
//   node --env-file=.env.local scripts/test-instagram.mjs --container    # also creates a test container (does not publish)
//   node --env-file=.env.local scripts/test-instagram.mjs --publish      # creates AND really publishes (shows up on the profile!)

const userId = process.env.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN;
const version = process.env.IG_GRAPH_VERSION || "v21.0";

if (!userId || !token) {
  console.error("Defina IG_USER_ID e IG_ACCESS_TOKEN (ex.: node --env-file=.env.local scripts/test-instagram.mjs)");
  process.exit(1);
}

// An account created via "API setup with Instagram login" uses the graph.instagram.com host,
// not graph.facebook.com (which is the host of the old integration via a Facebook Page).
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
      caption: "JornAI test (not published)",
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
  console.error("\nInvalid token/ID for graph.instagram.com. If you set it up via a Facebook Page (old flow), try switching the host to graph.facebook.com in the script.");
  process.exit(1);
}

if (process.argv.includes("--container") || process.argv.includes("--publish")) {
  const creationId = await createContainer();
  if (creationId && process.argv.includes("--publish")) {
    console.log("\nPublishing for real in 3s... (Ctrl+C to cancel)");
    await new Promise((r) => setTimeout(r, 3000));
    await publishContainer(creationId);
  } else if (creationId) {
    console.log("\nContainer created and NOT published — it expires by itself in ~24h, nothing shows up on the profile.");
  }
}
