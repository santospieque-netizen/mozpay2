# MozBooks - Deploy Guide

## Descrição

Este guia explica como fazer o deploy do projeto **MozBooks** em diferentes plataformas de hospedagem (Netlify, Vercel, Firebase Hosting, GitHub Pages, etc.), incluindo suporte para deploy em **subpastas**.

---

## Pré-requisitos

1. Node.js (recomendado: v18 ou superior)
2. npm ou yarn
3. Uma conta na plataforma de hospedagem escolhida

---

## Instalação

```bash
# Instalar dependências
npm install

# Build de produção (gera a pasta dist/)
npm run build
```

---

## Deploy para Vercel

### Método 1: Git + CI/CD (Recomendado)

1. Faça push do projeto para um repositório Git (GitHub, GitLab, Bitbucket).
2. Acesse [vercel.com](https://vercel.com) e faça login.
3. Clique em **"Add New Project"** e importe o repositório.
4. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Clique em **Deploy**.
6. (Opcional) Para subpastas, adicione o `vercel.json` já existente na raiz do projeto.

### Método 2: CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy para produção
vercel --prod
```

---

## Deploy para Netlify

### Método 1: Git Continuous Deployment

1. Faça push do projeto para o GitHub.
2. Acesse [netlify.com](https://netlify.com) e faça login.
3. Clique em **"Add new site" > "Import an existing project"**.
4. Selecione seu repositório GitHub.
5. Configure:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
6. Clique em **Deploy site**.
7. (Opcional, recomendado) O arquivo `netlify.toml` já está configurado para SPA e subpastas.

### Método 2: Netlify CLI (deploy manual)

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Build do projeto
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

---

## Deploy para Firebase Hosting

1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Selecione ou crie um projeto.
3. No menu lateral, vá em **Build > Hosting**.
4. Clique em **"Get started"** e siga as instruções para instalar o Firebase CLI se necessário.
5. Execute na raiz do projeto:

```bash
# Login
firebase login

# Initialize (selecione "Hosting", depois "dist" como public directory)
firebase init hosting

# Deploy
firebase deploy --only hosting
```

---

## Deploy para GitHub Pages

```bash
# Instalar dependência de deploy
npm install --save-dev gh-pages

# Adicionar no package.json > scripts
# "predeploy": "npm run build"
# "deploy": "gh-pages -d dist"

# Executar deploy
npm run deploy
```

**Nota:** Para GitHub Pages, altere `base: './'` em `vite.config.ts` para `base: '/nome-do-repositorio/'`.

---

## Deploy em Subpastas (Subpath / Subdirectory)

Se você precisar hospedar o app em uma subpasta (ex.: `https://seudominio.com/novo/mozbooks/`), siga os passos abaixo:

### 1. Ajuste o `vite.config.ts`

Edite o arquivo `vite.config.ts` e altere a propriedade `base`:

```typescript
export default defineConfig({
  base: '/novo/mozbooks/',  // Substitua pelo seu subcaminho
  // ... restante da configuração
});
```

**Ou**, para auto-detectar via variável de ambiente (recomendado):

```typescript
const subpath = process.env.VITE_SUBPATH || '/';

export default defineConfig({
  base: subpath,
  // ...
});
```

E defina a variável de ambiente no build da hospedagem.

### 2. Arquivos de Configuração Já Criados

Os seguintes arquivos já foram adicionados ao projeto para suporte a SPA e subpastas:

- **`vercel.json`** → Suporte a SPA na Vercel (incluindo subpastas)
- **`netlify.toml`** → Suporte a SPA na Netlify (incluindo subpastas)
- **`public/_redirects`** → Fallback SPA (fallback genérico)

### 3. Configurações Específicas por Host

| Plataforma | Configuração Extra Necessária |
|---|---|
| **Vercel** | `vercel.json` já está pronto. Na dashboard, configure o domínio customizado com subpasta. |
| **Netlify** | `netlify.toml` já está pronto. No painel, configure o domínio e subpasta. |
| **cPanel** | Faça upload da pasta `dist` para a subpasta. Adicione `.htaccess` com regras de rewrite. |
| **Nginx** | Configure o `location` para servir o `index.html` em todas as rotas. |
| **Apache** | Use `.htaccess` com `mod_rewrite` para redirecionar tudo para `index.html`. |

---

## Estrutura do Projeto de Deploy

```
New folder (9)
├── dist/                       # ← Output do build (não versionar)
├── public/
│   ├── _redirects               # ← Regras genéricas SPA
│   └── ...
├── src/
├── index.html
├── vite.config.ts             # ← Configurado com base: './'
├── vercel.json                # ← Configuração Vercel SPA
├── netlify.toml               # ← Configuração Netlify SPA
├── package.json
└── README_DEPLOY.md           # ← Este arquivo
```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| **Tela em branco ao recarregar** | Verifique se `base` em `vite.config.ts` está correto. |
| **Assets (CSS, JS) não carregam** | Verifique se o `base` inclui a barra final `/`. |
| **Erro 404 no refresh** | Confirme que o arquivo de regras SPA está presente. |
| **CORS em PDFs** | Configure o `Access-Control-Allow-Origin` no servidor. |

---

## Dica Importante

Sempre execute `npm run build` localmente antes do primeiro deploy, para verificar se o projeto compila sem erros:

```bash
npm run build
```

Se o build falhar, corrija os erros antes de tentar fazer o deploy.

---

## Links Úteis

- [Vite - Deploy Static](https://vitejs.dev/guide/static-deploy.html)
- [Vercel - Vite Guide](https://vercel.com/docs/frameworks/vite)
- [Netlify - Vite Guide](https://www.netlify.com/blog/2024/06/20/deploy-vite-apps-netlify/)

