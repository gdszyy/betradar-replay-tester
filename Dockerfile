# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 复制 patches 目录
COPY patches ./patches

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建前端和后端
RUN pnpm build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 从构建阶段复制依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 复制必要的文件
COPY package.json pnpm-lock.yaml ./

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "dist/index.js"]
