# Deploy na Hostinger

Há dois caminhos. Escolha conforme o plano contratado:

| | **Opção A: Node.js Web App** | **Opção B: VPS com Docker** |
|---|---|---|
| Plano | Business Web Hosting ou Cloud (Startup, Professional, Enterprise) | VPS (template "Ubuntu 24.04 with Docker") |
| Banco | Externo: **Neon** (PostgreSQL gerenciado, gratuito) | O próprio Postgres do `docker-compose.yml` |
| Esforço | Só cliques no hPanel; cada `git push` publica de novo | SSH e alguns comandos |
| Recomendado para | Publicar o trabalho rápido | Ter exatamente o mesmo ambiente do compose |

> Os planos Single e Premium de hospedagem compartilhada **não** rodam apps Node.js.

---

## Opção A: Node.js Web App + Neon (recomendada)

### 1. Banco no Neon (se ainda não tiver)

1. Em https://neon.com, crie um projeto (região mais próxima: `sa-east-1`, se houver; senão, `us-east`).
2. Clique em **Connect** e copie a connection string. Ela tem o formato:
   `postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require`
3. No final da string, troque `?sslmode=require&channel_binding=require` por **`?sslmode=verify-full`**.
4. **Não** cole essa string em nenhum arquivo do repositório. Ela vai só no painel da Hostinger (passo 3).

A API cria a tabela `pedidos` e o índice sozinha na primeira subida.

### 2. Criar o app no hPanel

1. Entre em https://hpanel.hostinger.com → **Websites** → **Add Website**.
2. Escolha **Node.js web app** (pode aparecer como **Node.js Apps**).
3. Em **Import Git repository**, clique em **Connect with GitHub** e autorize o app da Hostinger,
   dando acesso ao repositório `pedidos-api`.
4. Selecione o repositório `WandersonHonorato/pedidos-api` e avance.

### 3. Configurações de build

Revise os campos que a Hostinger preenche e ajuste para:

| Campo | Valor |
|---|---|
| **Framework preset** | `Express` (se não detectar, use `Other`) |
| **Branch** | `main` |
| **Node.js version** | `22` |
| **Package manager** | `npm` |
| **Build command** | deixe **vazio** (o projeto não tem etapa de build) |
| **Entry file** | `src/server.js` |
| **Output directory** | deixe vazio |

**Environment variables**: adicione exatamente estas três:

| Nome | Valor |
|---|---|
| `REPOSITORY` | `postgres` |
| `DATABASE_URL` | a connection string do Neon (passo 1) |
| `LOG_LEVEL` | `info` |

> **Não** crie a variável `PORT`. A Hostinger define a porta sozinha em tempo de execução, e a API já lê
> `process.env.PORT`. Fixar a porta faz o app cair logo depois do build.

Clique em **Deploy**.

### 4. Conferir

1. Acompanhe os **Build logs** até o fim.
2. Abra o endereço temporário que a Hostinger mostra (ou o seu domínio). O **Painel de Pedidos** deve aparecer.
3. Teste a API no navegador: `https://SEU-DOMINIO/health` deve responder `{"status":"ok"}`.
4. Em **Runtime Logs** deve aparecer a linha JSON
   `"repository":"postgres", "msg":"pedidos-api no ar"`.

### 5. Atualizações

Cada `git push` na branch `main` gera um novo deploy automaticamente. Se mudar alguma variável de ambiente,
use **Deployments → Settings → Redeploy**, ou clique no selo **Running** → **Restart**.

### Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| App cai logo após o build | variável `PORT` definida à mão | apague `PORT` das variáveis e faça redeploy |
| Runtime log: `DATABASE_URL é obrigatório quando REPOSITORY=postgres` | variável faltando ou com nome errado | confira os nomes das 3 variáveis |
| `password authentication failed` | senha errada ou cortada na string | copie de novo no Neon (**Connect** → **Show password**) |
| Primeira requisição demora alguns segundos | o plano gratuito do Neon "dorme" após inatividade | normal; as seguintes ficam rápidas |
| Painel abre sem estilo | navegador sem acesso ao CDN `cdn.jsdelivr.net` | teste em outra rede; a API funciona normalmente |

---

## Opção B: VPS com Docker (mesmo ambiente do compose)

### 1. Preparar a VPS

1. No hPanel, abra a VPS → **OS & Panel** → **Operating System** e instale o template
   **Ubuntu 24.04 with Docker**. Ele já vem com `docker` e `docker compose`.
2. Anote o **IP** e a senha de root (aba **Overview**).

### 2. Subir o projeto (via SSH)

No PowerShell do seu computador:

```powershell
ssh root@IP_DA_VPS
```

Já dentro da VPS:

```bash
git clone https://github.com/WandersonHonorato/pedidos-api.git
cd pedidos-api
cp .env.example .env

# troca a senha de exemplo por uma senha forte e aleatória, e expõe na porta 80
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^API_PORT=.*/API_PORT=80/" .env

docker compose up -d --build --wait
curl localhost/health
```

Acesse `http://IP_DA_VPS` no navegador: o painel deve aparecer.

> A senha gerada fica só no `.env` da VPS, que não vai para o Git. Nunca use `troque-esta-senha` em servidor.

### 3. Atualizar depois de um `git push`

```bash
cd ~/pedidos-api
git pull
docker compose up -d --build --wait
```

### 4. (Opcional) Domínio e HTTPS

Aponte o domínio para o IP da VPS (registro **A** no DNS) e coloque um proxy com HTTPS, como Caddy ou Nginx
com Let's Encrypt, na frente da API. Nesse caso, volte `API_PORT` para `3000` e deixe o proxy ocupar as portas 80 e 443.

---

## Referências

- Hostinger: Creating a Node.js App: https://docs.hostinger.com/node.js/creating-an-app
- Hostinger: Express no Node.js hosting (bind em `process.env.PORT`): https://docs.hostinger.com/node.js/overview-1/express
- Hostinger: Docker VPS template: https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template/
