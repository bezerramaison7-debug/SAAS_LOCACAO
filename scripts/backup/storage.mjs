#!/usr/bin/env node
/**
 * Backup/restauração dos arquivos do Storage (F9.4).
 *
 *   node --env-file=.env.local scripts/backup/storage.mjs baixar <dir>
 *   node --env-file=.env.local scripts/backup/storage.mjs enviar <dir>
 *   node --env-file=.env.local scripts/backup/storage.mjs verificar <dir>   (usa BACKUP_DATABASE_URL)
 *
 * Usa a service role (somente em máquina de operação — nunca no navegador).
 * `baixar` grava os arquivos e um manifest.json com tamanho e SHA-256;
 * `verificar` confere o backup contra os hashes gravados no banco
 * (evidências e relatórios) — prova de que o backup está completo e íntegro.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["evidencias", "contratos", "comprovantes", "relatorios"];
const [, , modo, destino] = process.argv;
if (!["baixar", "enviar", "verificar"].includes(modo ?? "") || !destino) {
  console.error("Uso: storage.mjs <baixar|enviar|verificar> <diretório>");
  process.exit(2);
}

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave)
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

const sha256 = (dados) => createHash("sha256").update(dados).digest("hex");

/** Lista recursiva (objetos têm id; pastas não). */
async function listar(storage, bucket, prefixo = "") {
  const saida = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefixo, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id) saida.push(caminho);
      else saida.push(...(await listar(storage, bucket, caminho)));
    }
    if (data.length < 1000) break;
  }
  return saida;
}

async function baixar() {
  const { storage } = cliente();
  const manifesto = [];
  for (const bucket of BUCKETS) {
    for (const caminho of await listar(storage, bucket)) {
      const { data, error } = await storage.from(bucket).download(caminho);
      if (error) throw new Error(`${bucket}/${caminho}: ${error.message}`);
      const dados = Buffer.from(await data.arrayBuffer());
      const arquivo = path.join(destino, bucket, caminho);
      await mkdir(path.dirname(arquivo), { recursive: true });
      await writeFile(arquivo, dados);
      manifesto.push({
        bucket,
        caminho,
        bytes: dados.length,
        sha256: sha256(dados),
        tipo: data.type,
      });
    }
  }
  await mkdir(destino, { recursive: true });
  await writeFile(path.join(destino, "manifest.json"), JSON.stringify(manifesto, null, 2));
  console.log(`Storage: ${manifesto.length} arquivo(s) salvos em ${destino}`);
}

async function enviar() {
  const { storage } = cliente();
  const manifesto = JSON.parse(await readFile(path.join(destino, "manifest.json"), "utf8"));
  let enviados = 0;
  for (const m of manifesto) {
    const dados = await readFile(path.join(destino, m.bucket, m.caminho));
    if (sha256(dados) !== m.sha256)
      throw new Error(`Arquivo alterado no backup: ${m.bucket}/${m.caminho}`);
    const { error } = await storage.from(m.bucket).upload(m.caminho, dados, {
      contentType: m.tipo || "application/octet-stream",
      upsert: false,
    });
    if (error && !/exists|Duplicate/i.test(error.message))
      throw new Error(`${m.caminho}: ${error.message}`);
    if (!error) enviados++;
  }
  console.log(
    `Storage: ${enviados} arquivo(s) restaurados (${manifesto.length - enviados} já existiam)`,
  );
}

async function verificar() {
  const pg = (await import("pg")).default;
  const url = process.env.BACKUP_DATABASE_URL;
  if (!url) throw new Error("Defina BACKUP_DATABASE_URL");
  const manifesto = JSON.parse(await readFile(path.join(destino, "manifest.json"), "utf8"));
  const porCaminho = new Map(manifesto.map((m) => [`${m.bucket}/${m.caminho}`, m]));
  // O manifesto sozinho não prova nada: cada arquivo em disco é recalculado.
  const problemas = [];
  for (const m of manifesto) {
    const dados = await readFile(path.join(destino, m.bucket, m.caminho)).catch(() => null);
    if (!dados) problemas.push(`arquivo faltando no backup: ${m.bucket}/${m.caminho}`);
    else if (sha256(dados) !== m.sha256)
      problemas.push(`arquivo alterado no backup: ${m.bucket}/${m.caminho}`);
  }
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const { rows } = await db.query(`
      select bucket, storage_path, hash_arquivo from public.evidencias
      union all
      select 'relatorios', storage_path, hash_arquivo from public.relatorios where status = 'CONCLUIDO'`);
    for (const r of rows) {
      const m = porCaminho.get(`${r.bucket}/${r.storage_path}`);
      if (!m) problemas.push(`ausente no backup: ${r.bucket}/${r.storage_path}`);
      else if (m.sha256 !== r.hash_arquivo)
        problemas.push(`hash diferente: ${r.bucket}/${r.storage_path}`);
    }
    if (problemas.length) {
      console.error(problemas.slice(0, 20).join("\n"));
      throw new Error(`${problemas.length} problema(s) no backup do Storage`);
    }
    console.log(
      `Storage verificado: ${manifesto.length} arquivo(s) íntegros; ${rows.length} registro(s) do banco conferem com o backup (SHA-256)`,
    );
  } finally {
    await db.end();
  }
}

await { baixar, enviar, verificar }[modo]();
