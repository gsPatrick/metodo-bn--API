# Feature: User (Usuários e Perfis Clínicos)

Gestão de acessos (RBAC), provisionamento de pacientes pela nutricionista e
manutenção de `PatientProfile` e `PatientRestriction`.

## Regras de acesso (ownership)

Aplicadas no service (`assertCanAccessProfile`):
- **admin** — acesso global.
- **nutritionist** — apenas pacientes onde `profile.nutritionistId == seu id`.
- **patient** — apenas o próprio `profile` (`profile.userId == seu id`); não edita
  `clinicalNotes` (campo da nutricionista).

## Rotas

| Método | Caminho                                          | Papel/Acesso                    | Descrição |
|--------|--------------------------------------------------|---------------------------------|-----------|
| GET    | `/api/v1/users/me/profile`                       | autenticado (paciente)          | Perfil clínico do próprio usuário. |
| POST   | `/api/v1/users/patients`                         | `nutritionist`, `admin`         | Provisiona paciente (User+Profile+restrições) e envia convite por e-mail. |
| GET    | `/api/v1/users/profiles/:profileId`              | ownership                       | Detalhe do perfil + restrições + user. |
| PATCH  | `/api/v1/users/profiles/:profileId`              | ownership                       | Atualiza dados antropométricos/clínicos. |
| GET    | `/api/v1/users/profiles/:profileId/restrictions` | ownership                       | Lista restrições do perfil. |
| POST   | `/api/v1/users/profiles/:profileId/restrictions` | ownership                       | Adiciona restrição. |
| PATCH  | `/api/v1/users/restrictions/:restrictionId`      | ownership                       | Atualiza restrição. |
| DELETE | `/api/v1/users/restrictions/:restrictionId`      | ownership                       | Remove restrição. |
| GET    | `/api/v1/users`                                  | `admin`                         | Lista global (`?role=`, `?isActive=`). |
| POST   | `/api/v1/users`                                  | `admin`                         | Cria usuário arbitrário. |
| PATCH  | `/api/v1/users/:id/active`                       | `admin`                         | Ativa/desativa conta. |
| PATCH  | `/api/v1/users/:id/role`                         | `admin`                         | Altera papel. |
| GET    | `/api/v1/users/:id`                              | ownership                       | Detalhe do usuário (+profile). |
| PATCH  | `/api/v1/users/:id`                              | ownership                       | Atualiza `name`/`phone`. |

## Payloads

### POST /users/patients
```json
{
  "name": "Maria",
  "email": "maria@local",
  "phone": "+5511999999999",
  "profile": {
    "sex": "female",
    "heightCm": 165,
    "weightKg": 62,
    "activityLevel": "moderate",
    "goal": "lose_weight",
    "clinicalNotes": "Hipertensa leve.",
    "restrictions": [
      { "type": "allergy", "label": "amendoim" },
      { "type": "preference", "label": "vegetariana" }
    ]
  }
}
```
- `password` é opcional. Se omitido, gera senha temporária, envia por e-mail
  (`patientInvite`) e devolve `tempPasswordIssued` na resposta.

### PATCH /users/profiles/:profileId
```json
{ "weightKg": 61.2, "goal": "maintain" }
```

### POST /users/profiles/:profileId/restrictions
```json
{ "type": "intolerance", "label": "lactose", "notes": "leve" }
```

## Erros comuns

| Código                 | HTTP | Quando |
|------------------------|------|--------|
| `MISSING_FIELDS`       | 400  | Campos obrigatórios ausentes. |
| `EMAIL_TAKEN`          | 409  | E-mail já cadastrado. |
| `INVALID_ROLE`         | 400  | Papel inválido em `PATCH /:id/role`. |
| `USER_NOT_FOUND`       | 404  | `:id` inexistente. |
| `PROFILE_NOT_FOUND`    | 404  | `:profileId` inexistente. |
| `RESTRICTION_NOT_FOUND`| 404  | `:restrictionId` inexistente. |
| `PROFILE_FORBIDDEN`/`USER_FORBIDDEN` | 403 | Ownership violado. |
| `NOT_NUTRITIONIST`     | 403  | Provisionar paciente sem ser nutri/admin. |
