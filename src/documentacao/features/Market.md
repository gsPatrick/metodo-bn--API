# Feature: Market (Geolocalização de Mercados)

Cadastro de estabelecimentos e busca por proximidade (Haversine) com deep-links
de navegação para Google Maps e Waze — sem custo de API de mapa.

## Busca por proximidade (Haversine em SQL)

`GET /markets/nearby?lat=&lng=&radiusKm=&limit=` calcula a distância linear via
**fórmula de Haversine diretamente no PostgreSQL** (com `LEAST/GREATEST` para
evitar erro de domínio em `acos`), ordena do mais próximo ao mais distante e
filtra por raio opcional. Cada resultado traz `distanceKm` e `navigation`.

## Deep-links de navegação

Gerados a partir das coordenadas do mercado (`market.helper.js`):
```json
"navigation": {
  "googleMaps": "https://www.google.com/maps/dir/?api=1&destination=-23.56,-46.65",
  "googleMapsPlace": "https://www.google.com/maps/search/?api=1&query=-23.56,-46.65",
  "waze": "https://waze.com/ul?ll=-23.56,-46.65&navigate=yes",
  "geoUri": "geo:-23.56,-46.65?q=-23.56,-46.65(Mercado)"
}
```

## Rotas

| Método | Caminho                       | Acesso        | Descrição |
|--------|-------------------------------|---------------|-----------|
| GET    | `/api/v1/markets/nearby`      | autenticado   | Mais próximos por GPS (`?lat=&lng=&radiusKm=&limit=`). |
| GET    | `/api/v1/markets`             | autenticado   | Lista mercados ativos. |
| GET    | `/api/v1/markets/:id`         | autenticado   | Detalhe + deep-links. |
| POST   | `/api/v1/markets`             | autenticado   | Cadastra mercado (`{ name, latitude, longitude, address?, city?, state? }`). |
| PATCH  | `/api/v1/markets/:id`         | `admin`       | Edita/ativa-desativa (moderação). |
| DELETE | `/api/v1/markets/:id`         | `admin`       | Remove. |

## Erros comuns

| Código              | HTTP | Quando |
|---------------------|------|--------|
| `INVALID_COORDS`    | 400  | `lat`/`lng` ausentes ou não numéricos. |
| `MISSING_FIELDS`    | 400  | Cadastro sem `name`/coordenadas. |
| `MARKET_NOT_FOUND`  | 404  | `:id` inexistente. |
| `NOT_ADMIN`         | 403  | Editar/remover sem ser admin. |
