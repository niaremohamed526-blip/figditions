// Recrée les buckets et réuploade tous les fichiers depuis ./backup-storage
// Usage : node migration/import-storage.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), "migration", ".env.export") });

const URL = process.env.DEST_SUPABASE_URL;
const KEY = process.env.DEST_SUPABASE_SERVICE_ROLE_KEY;
const SRC = process.env.IMPORT_DIR || "./backup-storage";
const BUCKETS = [
  { name: "manuscrits", public: false },
  { name: "logos", public: true },
  { name: "conversions", public: false },
];

if (!URL || !KEY) {
  console.error("❌ Manque DEST_SUPABASE_URL ou DEST_SUPABASE_SERVICE_ROLE_KEY dans migration/.env.export");
  process.exit(1);
}

const supabase = createClient(URL, KEY);

async function ensureBucket(b) {
  const { data: list } = await supabase.storage.listBuckets();
  if (!list?.find((x) => x.name === b.name)) {
    const { error } = await supabase.storage.createBucket(b.name, { public: b.public });
    if (error) throw error;
    console.log(`📦 Bucket créé : ${b.name} (${b.public ? "public" : "privé"})`);
  } else {
    console.log(`📦 Bucket existant : ${b.name}`);
  }
}

async function walk(dir, base = dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

for (const b of BUCKETS) {
  await ensureBucket(b);
  const bucketDir = path.join(SRC, b.name);
  try {
    await fs.access(bucketDir);
  } catch {
    console.log(`  (aucun fichier local pour ${b.name})`);
    continue;
  }
  const files = await walk(bucketDir);
  console.log(`  ${files.length} fichier(s) à uploader`);
  for (const rel of files) {
    const buf = await fs.readFile(path.join(bucketDir, rel));
    const { error } = await supabase.storage.from(b.name).upload(rel, buf, { upsert: true });
    if (error) console.warn(`  ❌ ${rel} : ${error.message}`);
    else console.log(`  ✅ ${rel}`);
  }
}

console.log("\n✅ Import terminé.");
