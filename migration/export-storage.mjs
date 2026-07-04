// Télécharge tous les fichiers des buckets Storage vers ./backup-storage
// Usage : node migration/export-storage.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "node:process";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), "migration", ".env.export") });

const URL = process.env.SOURCE_SUPABASE_URL;
const KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || process.env.SOURCE_SUPABASE_PUBLISHABLE_KEY;
const DEST = process.env.EXPORT_DIR || "./backup-storage";
const BUCKETS = ["manuscrits", "logos", "conversions"];

if (!URL || !KEY) {
  console.error("❌ Manque SOURCE_SUPABASE_URL ou SOURCE_SUPABASE_SERVICE_ROLE_KEY dans migration/.env.export");
  process.exit(1);
}

const supabase = createClient(URL, KEY);

async function walkBucket(bucket, prefix = "") {
  const files = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    console.warn(`  ⚠️  ${bucket}/${prefix} : ${error.message}`);
    return files;
  }
  for (const item of data) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // dossier
      files.push(...(await walkBucket(bucket, full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

for (const bucket of BUCKETS) {
  console.log(`\n📦 Bucket : ${bucket}`);
  const files = await walkBucket(bucket);
  console.log(`  ${files.length} fichier(s) trouvé(s)`);
  for (const p of files) {
    const dest = path.join(DEST, bucket, p);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const { data, error } = await supabase.storage.from(bucket).download(p);
    if (error) {
      console.warn(`  ❌ ${p} : ${error.message}`);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(dest, buf);
    console.log(`  ✅ ${p} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
}

console.log("\n✅ Export terminé dans", DEST);
