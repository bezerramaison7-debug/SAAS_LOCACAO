#!/usr/bin/env python3
"""
Extrai o sistema de arquivos de uma imagem OCI/Docker pública SEM daemon Docker
(protocolo de registro v2). Uso exclusivo de desenvolvimento/teste em ambientes
sem Docker (D-36), para rodar os mesmos serviços que o Supabase CLI usa.

    python3 -I scripts/stack/extrair-imagem.py supabase/gotrue:v2.197.0 /var/tmp/saas-stack/gotrue
    python3 -I scripts/stack/extrair-imagem.py public.ecr.aws/supabase/storage-api:v1.79.36 destino

Registros: Docker Hub (padrão) e ECR Public (`public.ecr.aws/...`, espelho
oficial do Supabase — útil quando o Docker Hub limita pulls anônimos).
"""
import io
import json
import os
import sys
import tarfile
import time
import urllib.error
import urllib.request

REGISTRO = "https://registry-1.docker.io"


def obter(url, token=None, aceitar=None, tentativas=4):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if aceitar:
        req.add_header("Accept", aceitar)
    for tentativa in range(tentativas):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return resp.read()
        except urllib.error.HTTPError as erro:
            # 429: limite de pulls anônimos; espera e tenta de novo.
            if erro.code != 429 or tentativa == tentativas - 1:
                print(f"  falha {erro.code} em {url.split('?')[0]}", file=sys.stderr)
                raise
            espera = int(erro.headers.get("Retry-After") or 30 * (tentativa + 1))
            print(f"  429 em {url.split('?')[0]}; aguardando {espera}s", file=sys.stderr)
            time.sleep(espera)


def main():
    if len(sys.argv) != 3:
        sys.exit("uso: extrair-imagem.py repositorio:tag destino")
    imagem, destino = sys.argv[1], sys.argv[2]
    repo, tag = imagem.rsplit(":", 1)
    global REGISTRO
    if repo.startswith("public.ecr.aws/"):
        REGISTRO = "https://public.ecr.aws"
        repo = repo.removeprefix("public.ecr.aws/")
        token = json.loads(obter(f"https://public.ecr.aws/token/?scope=repository:{repo}:pull"))["token"]
    else:
        if "/" not in repo:
            repo = f"library/{repo}"
        token = json.loads(obter(
            f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"
        ))["token"]
    tipos = ",".join([
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ])
    manifesto = json.loads(obter(f"{REGISTRO}/v2/{repo}/manifests/{tag}", token, tipos))
    if "manifests" in manifesto:
        alvo = next(m for m in manifesto["manifests"]
                    if m.get("platform", {}).get("architecture") == "amd64"
                    and m.get("platform", {}).get("os") == "linux")
        manifesto = json.loads(obter(f"{REGISTRO}/v2/{repo}/manifests/{alvo['digest']}", token, tipos))
    os.makedirs(destino, exist_ok=True)
    raiz = os.path.realpath(destino)
    for camada in manifesto["layers"]:
        dados = obter(f"{REGISTRO}/v2/{repo}/blobs/{camada['digest']}", token)
        with tarfile.open(fileobj=io.BytesIO(dados), mode="r:*") as tar:
            membros = []
            for m in tar.getmembers():
                nome = os.path.basename(m.name)
                if nome.startswith(".wh."):
                    continue  # whiteouts: irrelevantes para extrair binários
                caminho = os.path.realpath(os.path.join(raiz, m.name))
                if not caminho.startswith(raiz + os.sep) and caminho != raiz:
                    continue  # proteção contra path traversal
                if m.isdev():
                    continue
                membros.append(m)
            tar.extractall(raiz, members=membros, filter="tar")
        print(f"  camada {camada['digest'][:19]} ({camada.get('size', 0) // 1024} KiB)")
    config = json.loads(obter(f"{REGISTRO}/v2/{repo}/blobs/{manifesto['config']['digest']}", token))
    with open(os.path.join(raiz, ".imagem-config.json"), "w") as f:
        json.dump(config.get("config", {}), f, indent=2)
    print(f"Imagem {imagem} extraída em {raiz}")


if __name__ == "__main__":
    main()
