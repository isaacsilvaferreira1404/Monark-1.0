# Monark Cafeteria

Projeto demonstrativo de cafeteria com catálogo carregado do PostgreSQL, carrinho no navegador, criação de pedidos no backend e checkout hospedado pelo Mercado Pago.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL
- Conta de desenvolvedor Mercado Pago
- VS Code (opcional)

## 1. Banco de dados

Crie o banco:

```sql
CREATE DATABASE monark_cafeteria;
```

Conecte-se ao banco `monark_cafeteria` e execute `backend/database.sql`.

O script insere os seis produtos de exemplo somente quando a tabela ainda está vazia.

## 2. Configurar o backend

Abra um terminal na pasta `backend`:

```bash
npm install
```

Copie `.env.example` para `.env` e preencha as credenciais. Não compartilhe o `.env` e não o envie ao GitHub.

Para desenvolvimento local, `FRONTEND_URL` deve ser a origem exata do Live Server. Exemplo: `http://127.0.0.1:5500`.

Inicie:

```bash
npm run dev
```

Teste a API abrindo `http://localhost:3000/api/health` e `http://localhost:3000/api/products`.

## 3. Abrir o frontend

Abra a pasta raiz do projeto no VS Code e inicie o `index.html` com Live Server. O endereço deve corresponder ao `FRONTEND_URL` do `.env`.

## 4. Mercado Pago e webhook

1. Crie uma aplicação no Mercado Pago Developers.
2. Use credenciais de teste para testar o fluxo.
3. Coloque o Access Token no backend (`MP_ACCESS_TOKEN`).
4. Configure uma URL pública HTTPS para notificações de pagamento e informe-a em `WEBHOOK_URL`.
5. Configure a assinatura secreta do webhook em `MP_WEBHOOK_SECRET`.
6. Cadastre o endpoint `/api/webhook` no painel do Mercado Pago e habilite notificações de pagamentos.

O webhook verifica a assinatura, consulta o pagamento diretamente na API do Mercado Pago e compara moeda e valor com o pedido salvo antes de atualizar seu status. Teste notificações e pagamentos no ambiente de teste antes de publicar.

## 5. Imagens

Coloque suas imagens em `Assets/`. Os caminhos dos produtos estão cadastrados em `backend/database.sql`. Se alterar nomes ou caminhos, atualize a tabela `products` no PostgreSQL.

## Observações importantes

- O preço exibido no frontend é apenas informativo. O backend busca o preço oficial no banco ao criar o pedido.
- O site não recebe nem armazena número de cartão, CVV ou senha. O cliente paga na página hospedada do Mercado Pago.
- O carrinho fica em memória no navegador e é limpo ao recarregar a página.
- Esta é uma base de desenvolvimento, não um sistema pronto para produção. Antes de receber pedidos reais, configure HTTPS, domínio, backup, política de privacidade, termos, controles de acesso administrativos, monitoramento e testes completos.
- Não há painel administrativo nesta versão.
