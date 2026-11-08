# Monark Cafeteria

Site de cafeteria com cardápio no Firestore, carrinho no navegador e checkout hospedado pelo Mercado Pago. O frontend e a API são publicados pela Vercel; os arquivos em `public/` formam o site estático e `api/[...path].js` encaminha os endpoints para uma função serverless.

## Publicar na Vercel

1. Importe este repositório no painel da Vercel. O repositório Git continua sendo a origem do código; cada push na branch de produção inicia um deploy automático na Vercel.
2. Use a raiz do repositório como diretório do projeto, sem configurar um diretório raiz alternativo ou um comando de build. A Vercel publica automaticamente `public/` como conteúdo estático e `api/` como função serverless.
3. Configure estas variáveis em **Settings → Environment Variables**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: conteúdo completo do JSON de uma conta de serviço com acesso ao Firestore.
   - `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: credenciais do Mercado Pago.
   - `FIREBASE_PROJECT_ID`: ID do projeto Firebase (opcional; o projeto Monark é usado por padrão).
   - `FRONTEND_URL`: domínio público do site (opcional; a Vercel detecta o domínio automaticamente).
   - `WEBHOOK_URL`: URL pública estável `https://SEU-DOMINIO/api/webhook` (opcional; a Vercel monta a URL automaticamente).
4. Faça o deploy e confirme que `https://SEU-DOMINIO/api/health` retorna `{"status":"ok","database":"connected"}`.
5. Cadastre `https://SEU-DOMINIO/api/webhook` como URL de notificações de pagamento no Mercado Pago. A inicialização dos produtos no Firestore continua sendo feita uma vez, localmente, com `npm run db:init`.

Não publique credenciais no repositório. Configure as variáveis em todos os ambientes da Vercel que precisar usar.

## Desenvolvimento local

- Node.js 20 ou superior.
- Na raiz do projeto, execute `npm ci`. Configure `backend/.env` com as credenciais do Firebase e do Mercado Pago, usando `backend/.env.example` como referência.
- Inicialize os produtos no Firestore uma vez com `npm run db:init`.
- Inicie a API com `npm start` e abra `public/index.html` usando Live Server (padrão `http://127.0.0.1:5500`). O frontend local aponta para `http://localhost:3000`.

O backend valida os preços usando o Firestore e cria os pagamentos no Mercado Pago; o navegador não recebe nem armazena dados de cartão.
