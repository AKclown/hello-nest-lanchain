# Docker 多阶段构建: 构建阶段使用完整的开发环境编译项目，运行阶段只保留运行程序所需要的内容。

# 构建阶段：需要 devDependencies（含 @nestjs/cli、typescript）才能 nest build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install
COPY . .
RUN npm run build

# 运行阶段：仅生产依赖 + 编译产物，镜像更小
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install --production
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]