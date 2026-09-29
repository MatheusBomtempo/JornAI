import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getContentLanguage } from "../src/lib/language/config";

const prisma = new PrismaClient();

// The names are the identity of the templates (the seed is idempotent by
// name), so each language keeps its own — the Portuguese ones are the original.
const TEMPLATE_NAMES =
  getContentLanguage() === "pt"
    ? { square: "Padrão 1:1 (feed)", portrait: "Padrão 4:5 (retrato)" }
    : { square: "Default 1:1 (feed)", portrait: "Default 4:5 (portrait)" };

/**
 * Style examples seeded for the demo company, in the language the deployment
 * works in (APP_LANGUAGE). They are reference material for the AI: the model
 * imitates the tone and format, so they must not carry boilerplate phrases.
 */
const STYLE_EXAMPLES = {
  pt: [
    {
      title: "Tragédia em BH: acidente entre motos deixa dois mortos",
      subtitle:
        "Colisão entre as duas motocicletas ocorreu na Avenida José Cândido da Silveira, no bairro União.",
      caption: `Duas pessoas morreram em um acidente envolvendo duas motocicletas na noite deste sábado (13), na Avenida José Cândido da Silveira, no bairro União, em Belo Horizonte.

As duas vítimas não resistiram aos ferimentos e morreram no local. Equipes de emergência e a perícia estiveram na cena para atendimento e levantamento do acidente.

📸 @arrobadofotografo

#BH #Acidente`,
    },
    {
      title:
        "Especialistas alertam para avanço da miopia entre crianças e adolescentes",
      subtitle:
        "Cartilha orienta famílias sobre o uso de telas e recomenda pelo menos duas horas de atividades ao ar livre por dia.",
      caption: `A Sociedade Brasileira de Oftalmologia Pediátrica e o Conselho Brasileiro de Oftalmologia lançaram uma cartilha com orientações para ajudar a prevenir e controlar o avanço da miopia entre crianças e adolescentes.

O material chama atenção para o excesso de tempo em ambientes fechados, o uso prolongado de telas e a pouca exposição à luz natural. A recomendação central é que crianças e adolescentes passem pelo menos duas horas por dia ao ar livre, com atividades como brincadeiras, caminhadas, esportes e contato com a natureza.

Segundo o Conselho Brasileiro de Oftalmologia, a exposição à luz natural pode atuar como fator de proteção contra a progressão da miopia. A cartilha também orienta que o tempo de tela seja limitado conforme a idade:

👶 Menores de 2 anos: nenhum tempo de tela
🧒 De 2 a 5 anos: até 1 hora por dia
👧 De 5 a 10 anos: até 2 horas por dia
👦 De 10 a 18 anos: até 3 horas por dia

Os especialistas também recomendam pausas durante atividades que exigem visão de perto, distância adequada dos dispositivos e proteção solar.

A cartilha foi lançada durante o 70º Congresso Brasileiro de Oftalmologia, em Salvador, e será distribuída para secretarias de Saúde e Educação de todo o país.

#MiopiaInfantil #SaúdeOcular #Crianças #Saúde #Barbacena #MG`,
    },
  ],
  en: [
    {
      title: "Two dead in motorcycle crash on Riverside Avenue",
      subtitle:
        "The two motorcycles collided on Riverside Avenue, in the Old Mill neighborhood, on Saturday night.",
      caption: `Two people died in a crash involving two motorcycles on Saturday night (13) on Riverside Avenue, in the Old Mill neighborhood, in Riverton.

Both victims died at the scene. Emergency crews were called to the site.

📸 @photographerhandle

#Riverton #Crash`,
    },
    {
      title: "Experts warn of rising nearsightedness among children and teens",
      subtitle:
        "A new guide advises families on screen use and recommends at least two hours of outdoor activity a day.",
      caption: `A national association of pediatric eye doctors released a guide to help prevent and control the rise of nearsightedness among children and teenagers.

The material points to too much time indoors, long hours on screens and little exposure to natural light. The central recommendation is that children and teenagers spend at least two hours a day outdoors.

Natural light exposure may protect against the progression of nearsightedness. The guide also suggests limiting screen time by age:

👶 Under 2 years: no screen time
🧒 2 to 5 years: up to 1 hour a day
👧 5 to 10 years: up to 2 hours a day
👦 10 to 18 years: up to 3 hours a day

The experts also recommend breaks during close-up activities, a proper distance from devices and sun protection.

#ChildEyeHealth #Health #Kids #Riverton`,
    },
  ],
};

/**
 * Standalone version of src/lib/storage.ts#putObject: this script runs through
 * plain `tsx` (outside Next's bundler), and storage.ts has `import "server-only"`
 * at the top — which throws outside a Next bundler. Duplicated here instead of
 * weakening that guard (it exists to never let server-only code leak into the
 * client bundle).
 */
async function putSeedAsset(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if ((process.env.STORAGE_PROVIDER ?? "local").toLowerCase() === "s3") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const bucket = process.env.S3_BUCKET;
    const publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
    if (!bucket) throw new Error("S3_BUCKET is not configured.");
    if (!publicUrl) throw new Error("S3_PUBLIC_URL is not configured.");
    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `${publicUrl}/${key}`;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  const dest = path.join(dir, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/uploads/${key}`;
}

/** The seed has only 1 company (no natural key for an upsert) — creates it if there is none. */
async function ensureCompany(name: string) {
  const existing = await prisma.company.findFirst();
  if (existing) return existing;
  const company = await prisma.company.create({ data: { name } });
  console.log(`  empresa criada: ${name}`);
  return company;
}

async function ensureUser(
  name: string,
  email: string,
  password: string,
  role: "admin" | "manager" | "staff",
  companyId: string | null,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, companyId },
    create: { name, email, role, passwordHash, companyId },
  });
  console.log(`  user ${role}: ${email} / ${password}`);
  return user;
}

/**
 * Default overlay: a dark panel at the bottom (with a gradient) so the title
 * and subtitle stay legible over any photo. Replace it with your own PNG in
 * Admin → Templates.
 */
async function ensureOverlay(w: number, h: number, file: string): Promise<string> {
  const panelTop = Math.round(h * 0.58);
  const fadeTop = Math.round(h * 0.44);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05070b" stop-opacity="0"/>
        <stop offset="100%" stop-color="#05070b" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${fadeTop}" width="${w}" height="${panelTop - fadeTop}" fill="url(#fade)"/>
    <rect x="0" y="${panelTop}" width="${w}" height="${h - panelTop}" fill="#05070b" opacity="0.92"/>
    <rect x="64" y="${panelTop - 34}" width="96" height="7" rx="3.5" fill="#4d7cff"/>
    <text x="64" y="${h - 44}" font-family="sans-serif" font-size="26"
          font-weight="700" fill="#7f9cff" letter-spacing="3">${getContentLanguage() === "pt" ? "SEU JORNAL" : "YOUR NEWSPAPER"}</text>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return putSeedAsset(`templates/${file}`, buffer, "image/png");
}

/** Slots proportional to the format, with the sizes measured in Canva. */
function slotsFor(w: number, h: number) {
  const titleY = Math.round(h * 0.648);
  return {
    photoSlot: { x: 0, y: 0, width: w, height: h },
    titleSlot: {
      x: 64, y: titleY, width: w - 128, height: Math.round(h * 0.105),
      fontSize: 38.2, weight: 600, color: "#ffffff",
      align: "left", lineHeight: 1.25, transform: "none",
    },
    subtitleSlot: {
      x: 64, y: titleY + Math.round(h * 0.115), width: w - 128,
      height: Math.round(h * 0.1),
      fontSize: 24, weight: 400, color: "#d8dEE9",
      align: "left", lineHeight: 1.3, transform: "none",
    },
  };
}

async function main() {
  console.log("Seed do JornAI…");

  // In production, the admin has NO company on purpose: whoever deploys
  // registers their own company (name, logo, handle) on the first login, instead
  // of inheriting a generic "My Company" that cannot be edited afterwards (see
  // /onboarding). In dev/demo, it creates a sample company so the whole flow can
  // be tested with no extra step.
  const isProd = process.env.NODE_ENV === "production";
  const company = isProd ? null : await ensureCompany("Jornal Exemplo");

  const admin = await ensureUser(
    "Admin",
    process.env.SEED_ADMIN_EMAIL ?? "admin@jornai.local",
    process.env.SEED_ADMIN_PASSWORD ?? "admin12345",
    "admin",
    company?.id ?? null,
  );
  if (isProd) {
    console.log("  no company yet — register it at /onboarding on the first login");
  }
  // Sample accounts with a password fixed in the source code (which is public)
  // — they only make sense in local dev. Skipping them in production avoids
  // leaving a valid login documented in the open repo for anyone.
  if (!isProd && company) {
    await ensureUser("Editor Exemplo", "editor@jornai.local", "editor12345", "manager", company.id);
    await ensureUser("Jornalista Exemplo", "reporter@jornai.local", "reporter123", "staff", company.id);
  } else if (isProd) {
    console.log("  sample accounts (editor/reporter): skipped in production");
  }

  if (!company) {
    console.log("Seed done ✔ (templates/style examples are left to onboarding)");
    return;
  }

  // ── Style examples (real posts from the newspaper) ─────────
  if ((await prisma.styleExample.count({ where: { companyId: company.id } })) === 0) {
    await prisma.styleExample.createMany({
      data: STYLE_EXAMPLES[getContentLanguage()].map((example, orderIndex) => ({
        ...example,
        companyId: company.id,
        orderIndex,
        createdBy: admin.id,
      })),
    });
    console.log("  style examples: 2 created");
  } else {
    console.log("  style examples: already exist, skipping");
  }

  // ── Templates (1:1 and 4:5) — idempotent by name ───────────
  for (const f of [
    { name: TEMPLATE_NAMES.square, w: 1080, h: 1080, file: "overlay-1x1.png" },
    { name: TEMPLATE_NAMES.portrait, w: 1080, h: 1350, file: "overlay-4x5.png" },
  ]) {
    const overlayUrl = await ensureOverlay(f.w, f.h, f.file);
    const data = {
      companyId: company.id,
      name: f.name,
      canvasWidth: f.w,
      canvasHeight: f.h,
      overlayAssetUrl: overlayUrl,
      isActive: true,
      ...slotsFor(f.w, f.h),
    };

    const existing = await prisma.artTemplate.findFirst({
      where: { name: f.name, companyId: company.id },
    });
    if (existing) {
      await prisma.artTemplate.update({ where: { id: existing.id }, data });
      console.log(`  template updated: ${f.name}`);
    } else {
      await prisma.artTemplate.create({ data });
      console.log(`  template created: ${f.name}`);
    }
  }

  console.log("Seed done ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
