# Feature: Auth (Autenticação e Sessão)

Registro, login, **refresh token com rotação**, recuperação/reset de senha e
injeção do usuário logado na requisição (JWT). E-mails transacionais via **Resend**.

## Modelo de tokens

- **Access token (JWT)** — curto (`JWT_ACCESS_EXPIRES_IN`, padrão 15m), assinado com
  `JWT_SECRET`, payload `{ sub: userId, role }`. Enviado em `Authorization: Bearer <token>`.
- **Refresh token (opaco)** — aleatório, **só o hash SHA-256 é guardado** em
  `refresh_tokens`. Validade `REFRESH_TOKEN_EXPIRES_DAYS` (padrão 30d).
  - **Rotação:** a cada `/refresh`, o token usado é revogado e um novo é emitido.
  - **Detecção de reuso:** se um token já revogado for reapresentado, **todas** as
    sessões do usuário são revogadas (`REFRESH_TOKEN_REUSED`).
- **Reset token (opaco)** — em `password_reset_tokens`, hash + expiração
  (`PASSWORD_RESET_EXPIRES_MIN`, padrão 30m), uso único.

## Rotas

| Método | Caminho                        | Auth   | Descrição |
|--------|--------------------------------|--------|-----------|
| POST   | `/api/v1/auth/register`        | pública| Cria conta (papéis em `ALLOWED_SELF_REGISTER_ROLES`; nunca admin) + e-mail de boas-vindas. |
| POST   | `/api/v1/auth/login`           | pública| Login → access + refresh token. |
| POST   | `/api/v1/auth/refresh`         | pública| Troca refresh por novo par (rotação). |
| POST   | `/api/v1/auth/logout`          | pública| Revoga um refresh token específico. |
| POST   | `/api/v1/auth/forgot-password` | pública| Envia e-mail de reset (resposta neutra, sem enumeração). |
| POST   | `/api/v1/auth/reset-password`  | pública| Redefine a senha via token + revoga sessões. |
| GET    | `/api/v1/auth/me`              | Bearer | Usuário autenticado. |
| POST   | `/api/v1/auth/logout-all`      | Bearer | Revoga todas as sessões do usuário. |

## Payloads

### POST /auth/register
```json
{ "name": "Dra. Bia", "email": "bia@local", "password": "senhaSegura1", "role": "nutritionist" }
```
Resposta `201`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Dra. Bia", "role": "nutritionist" },
    "accessToken": "eyJ...",
    "refreshToken": "f3a9...",
    "tokenType": "Bearer",
    "accessTokenExpiresIn": "15m"
  }
}
```

### POST /auth/login
```json
{ "email": "bia@local", "password": "senhaSegura1" }
```

### POST /auth/refresh
```json
{ "refreshToken": "f3a9..." }
```

### POST /auth/forgot-password
```json
{ "email": "bia@local" }
```
Resposta `200` (sempre neutra):
```json
{ "success": true, "data": { "message": "Se o e-mail existir, enviaremos as instruções de recuperação." } }
```

### POST /auth/reset-password
```json
{ "token": "<token-do-email>", "password": "novaSenha123" }
```

## E-mails enviados (Resend)

| Gatilho               | Template          |
|-----------------------|-------------------|
| Registro              | `welcome`         |
| Esqueci a senha       | `passwordReset`   |
| Senha redefinida      | `passwordChanged` |

> Envio é **best effort**: falha de e-mail não derruba o fluxo (apenas loga).
> Sem `RESEND_API_KEY`, o envio vira no-op logado (dev).

## Erros comuns

| Código                  | HTTP | Quando |
|-------------------------|------|--------|
| `MISSING_FIELDS`        | 400  | Campos obrigatórios ausentes. |
| `WEAK_PASSWORD`         | 400  | Senha com menos de 8 caracteres. |
| `ROLE_NOT_ALLOWED`      | 403  | Papel fora da allowlist de registro. |
| `EMAIL_TAKEN`           | 409  | E-mail já cadastrado. |
| `INVALID_CREDENTIALS`   | 401  | Login inválido / usuário inativo. |
| `REFRESH_TOKEN_INVALID` | 401  | Refresh inexistente. |
| `REFRESH_TOKEN_EXPIRED` | 401  | Refresh expirado. |
| `REFRESH_TOKEN_REUSED`  | 401  | Reuso detectado — sessões revogadas. |
| `RESET_TOKEN_INVALID`   | 400  | Token de reset inválido/expirado/usado. |
| `TOKEN_MISSING`/`TOKEN_INVALID` | 401 | Bearer ausente/ inválido em rota protegida. |
