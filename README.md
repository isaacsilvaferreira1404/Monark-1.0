# Monark Cafeteria

Site de cafeteria com cardápio no Firestore, carrinho no navegador e checkout hospedado pelo Mercado Pago.

> O GitHub Pages publica somente o frontend estático. O servidor Node.js e o webhook de pagamentos são hospedados no Render; este repositório configura a publicação automática do frontend no GitHub Pages.

## Publicar o backend no Render

1. Envie este repositório ao GitHub e, no Render, crie um **Blueprint** a partir dele. O arquivo `render.yaml` configura o serviço Node.js.
2. No serviço `monark-api`, configure estas variáveis no painel do Render:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: conteúdo completo do JSON de uma conta de serviço do Firebase, com acesso ao Firestore.
   - `FRONTEND_URL`: URL do site GitHub Pages, incluindo o caminho do repositório, por exemplo `https://usuario.github.io/monark/`.
   - `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: credenciais do Mercado Pago. Use credenciais de teste inicialmente.
3. Inicialize os produtos no Firestore uma vez: localmente, copie `backend/.env.example` para `backend/.env`, informe `FIREBASE_PROJECT_ID` e o caminho do JSON baixado em `GOOGLE_APPLICATION_CREDENTIALS` (ou cole o JSON em `FIREBASE_SERVICE_ACCOUNT_JSON`). Na pasta `backend`, execute `npm ci` e `npm run db:init`.
4. Após o deploy, confirme que `https://SUA-API.onrender.com/api/health` retorna o status `ok`.

O Render fornece `RENDER_EXTERNAL_URL`, usado automaticamente para montar o endereço do webhook `/api/webhook`. Cadastre esse endereço nas notificações de pagamento da aplicação no Mercado Pago. Não publique credenciais no repositório.

## Publicar o frontend no GitHub Pages

1. Depois de obter a URL pública do backend no Render, abra **Settings → Secrets and variables → Actions → Variables** no repositório e crie a variável `MONARK_API_URL` com a URL base HTTPS da API (por exemplo, `https://monark-api.onrender.com`, sem barra no final).
2. Em **Settings → Pages**, selecione **GitHub Actions** como origem de publicação.
3. Envie um commit para o GitHub ou execute manualmente o workflow **Deploy frontend to GitHub Pages** na aba **Actions**.

O workflow publica somente `index.html`, `script.js`, `style.css`, `config.js` gerado e as imagens, sem expor os arquivos e configurações do backend. A API autoriza requisições da origem do site definida em `FRONTEND_URL`.

## Desenvolvimento local

- Node.js 20 ou superior.
- Firestore configurado e credenciais locais disponíveis. Copie `backend/.env.example` para `backend/.env`, configure `FIREBASE_PROJECT_ID` e use `GOOGLE_APPLICATION_CREDENTIALS` com o caminho do JSON da conta de serviço ou `FIREBASE_SERVICE_ACCOUNT_JSON` com o conteúdo dele. Não envie `.env` nem o JSON da conta de serviço ao GitHub.
- Na pasta `backend`, execute `npm ci`, `npm run db:init` (uma vez) e `npm start`.
- Abra `index.html` com Live Server. O `config.js` local aponta para `http://localhost:3000`.

O backend valida os preços usando o Firestore e cria os pagamentos no Mercado Pago; o navegador não recebe nem armazena dados de cartão.
