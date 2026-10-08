-- =============================================================================
-- 010 — Storage privado (RN-90..RN-95, D-07).
--   * Buckets privados (public = false), limites de tamanho e MIME.
--   * Leitura: somente objetos vinculados a uma linha de `evidencias`/`relatorios`
--     que o usuário consegue ler (a RLS dessas tabelas se aplica dentro da policy).
--   * Escrita/alteração/remoção: NENHUMA policy para authenticated/anon — só o
--     servidor (service_role) grava, após validar o arquivo.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidencias', 'evidencias', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('contratos', 'contratos', false, 20971520,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('comprovantes', 'comprovantes', false, 20971520,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('relatorios', 'relatorios', false, 104857600, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "arquivos_evidencia_leitura_autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('evidencias', 'contratos', 'comprovantes')
    and exists (
      select 1 from public.evidencias e
      where e.bucket = storage.objects.bucket_id
        and e.storage_path = storage.objects.name
        and e.empresa_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

create policy "arquivos_relatorio_leitura_autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'relatorios'
    and exists (
      select 1 from public.relatorios r
      where r.storage_path = storage.objects.name
        and r.status = 'CONCLUIDO'
        and r.empresa_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
