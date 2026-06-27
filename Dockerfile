# Método: BN — API (Node.js + Express + Sequelize)
FROM node:20-alpine

# Diretório da aplicação
WORKDIR /app

# Instala apenas as dependências de produção (cache de layer)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copia o código
COPY . .

# Configuração de runtime (pode ser sobrescrita por variáveis de ambiente)
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck no endpoint público de saúde (usa a porta efetiva $PORT).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/v1/health" || exit 1

# O schema é criado automaticamente no boot (DB_SYNC) e a nutri padrão é semeada.
CMD ["node", "app.js"]
