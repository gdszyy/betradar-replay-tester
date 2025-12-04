# UOF Replay 测试系统 - 部署指南

## 系统要求

### 运行环境

- **Node.js**: 22.x 或更高版本
- **Python**: 3.11 或更高版本
- **数据库**: MySQL 5.7+ 或 TiDB
- **操作系统**: Linux, macOS, Windows

### 依赖服务

- **Betradar Replay API**: 访问令牌和 API 端点
- **Betradar AMQP**: 消息队列访问权限
- **UOF Static API**: 静态数据 API 访问权限

## 本地开发环境部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd uof_replay_tester
```

### 2. 安装 Node.js 依赖

```bash
pnpm install
```

### 3. 安装 Python 依赖

```bash
pip3 install fastapi uvicorn requests pydantic pika
```

### 4. 配置环境变量

创建 `.env` 文件（或在 Manus 平台配置）：

```bash
# 数据库配置（Manus 平台自动提供）
DATABASE_URL=mysql://user:password@host:port/database

# Betradar 配置
BETRADAR_ACCESS_TOKEN=your_access_token
REPLAY_MQ_HOST=global.replaymq.betradar.com
UOF_API_BASE_URL=https://api.betradar.com/v1

# 服务端口
PORT=3000
REPLAY_SERVICE_PORT=8001

# AMQP 配置
ROUTING_KEYS=#

# WebSocket 配置
WEBSOCKET_SERVER_URL=http://localhost:3000
DATABASE_API_URL=http://localhost:3000/api/trpc
```

### 5. 初始化数据库

```bash
pnpm db:push
```

### 6. 启动服务

#### 终端 1: 主 Web 服务

```bash
pnpm dev
```

#### 终端 2: Python Replay 服务

```bash
cd server
./start_replay_service.sh
```

或手动启动：

```bash
cd server
python3 replay_service.py
```

#### 终端 3: AMQP 监听器

```bash
cd server
python3 amqp_listener.py
```

### 7. 访问系统

打开浏览器访问：`http://localhost:3000`

## Manus 平台部署

### 自动部署

系统已在 Manus 平台上配置，大部分服务会自动启动。

### 手动启动 Python 服务

由于 Manus 平台主要管理 Node.js 服务，Python 服务需要手动启动：

#### 方式 1: 使用 Shell 工具

在 Manus 平台的 Shell 工具中执行：

```bash
cd /home/ubuntu/uof_replay_tester/server
./start_replay_service.sh &
python3 amqp_listener.py &
```

#### 方式 2: 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动 Replay 服务
pm2 start server/replay_service.py --name replay-service --interpreter python3

# 启动 AMQP 监听器
pm2 start server/amqp_listener.py --name amqp-listener --interpreter python3

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

### 配置环境变量

在 Manus 平台的"设置 → Secrets"中配置：

- `BETRADAR_ACCESS_TOKEN`
- `REPLAY_MQ_HOST`
- `UOF_API_BASE_URL`
- `ROUTING_KEYS`（可选）

## 生产环境部署

### 1. 构建生产版本

```bash
# 构建前端和后端
pnpm build
```

### 2. 启动生产服务

```bash
# 主服务
pnpm start

# Python 服务（使用 systemd 或 supervisor）
```

### 3. 使用 Systemd（Linux）

#### 主服务配置

创建 `/etc/systemd/system/uof-replay-web.service`：

```ini
[Unit]
Description=UOF Replay Web Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/uof_replay_tester
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Python Replay 服务配置

创建 `/etc/systemd/system/uof-replay-service.service`：

```ini
[Unit]
Description=UOF Replay Python Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/uof_replay_tester/server
Environment="REPLAY_SERVICE_PORT=8001"
Environment="BETRADAR_ACCESS_TOKEN=your_token"
ExecStart=/usr/bin/python3 replay_service.py
Restart=always

[Install]
WantedBy=multi-user.target
```

#### AMQP 监听器配置

创建 `/etc/systemd/system/uof-amqp-listener.service`：

```ini
[Unit]
Description=UOF AMQP Listener
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/uof_replay_tester/server
Environment="REPLAY_MQ_HOST=global.replaymq.betradar.com"
Environment="BETRADAR_ACCESS_TOKEN=your_token"
Environment="ROUTING_KEYS=#"
ExecStart=/usr/bin/python3 amqp_listener.py
Restart=always

[Install]
WantedBy=multi-user.target
```

#### 启动服务

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start uof-replay-web
sudo systemctl start uof-replay-service
sudo systemctl start uof-amqp-listener

# 设置开机自启
sudo systemctl enable uof-replay-web
sudo systemctl enable uof-replay-service
sudo systemctl enable uof-amqp-listener

# 查看状态
sudo systemctl status uof-replay-web
sudo systemctl status uof-replay-service
sudo systemctl status uof-amqp-listener
```

### 4. 使用 Docker（可选）

#### Dockerfile

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM python:3.11-slim

# 安装 Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm

# 复制应用
WORKDIR /app
COPY --from=builder /app .

# 安装 Python 依赖
RUN pip3 install fastapi uvicorn requests pydantic pika

# 暴露端口
EXPOSE 3000 8001

# 启动脚本
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
```

#### docker-entrypoint.sh

```bash
#!/bin/bash

# 启动主服务
node dist/index.js &

# 启动 Python Replay 服务
cd server && python3 replay_service.py &

# 启动 AMQP 监听器
cd server && python3 amqp_listener.py &

# 等待所有进程
wait
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  uof-replay-tester:
    build: .
    ports:
      - "3000:3000"
      - "8001:8001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - BETRADAR_ACCESS_TOKEN=${BETRADAR_ACCESS_TOKEN}
      - REPLAY_MQ_HOST=global.replaymq.betradar.com
      - UOF_API_BASE_URL=https://api.betradar.com/v1
      - ROUTING_KEYS=#
    restart: always
```

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 主应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Python Replay 服务
    location /replay-api/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 监控和日志

### 日志位置

- **主服务**: 标准输出（stdout）
- **Python Replay 服务**: 标准输出（stdout）
- **AMQP 监听器**: 标准输出（stdout）

### 使用 PM2 监控

```bash
# 查看所有进程
pm2 list

# 查看实时日志
pm2 logs

# 查看特定服务日志
pm2 logs replay-service
pm2 logs amqp-listener

# 监控资源使用
pm2 monit
```

### 日志收集（生产环境）

建议使用日志收集工具：

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki**
- **Fluentd**

## 性能优化

### 数据库优化

```sql
-- 为常用查询添加索引
CREATE INDEX idx_messages_match_id ON messages(matchId);
CREATE INDEX idx_messages_received_at ON messages(receivedAt);
CREATE INDEX idx_messages_session_id ON messages(sessionId);
```

### 消息限制

修改 `server/db.ts` 中的默认限制：

```typescript
// 增加消息查询限制
export async function getAllMessages(limit: number = 500): Promise<Message[]> {
  // ...
}
```

### WebSocket 连接池

在高并发场景下，考虑使用 Redis 作为 WebSocket 适配器：

```bash
pnpm add socket.io-redis
```

## 备份和恢复

### 数据库备份

```bash
# 导出数据库
mysqldump -u user -p database_name > backup.sql

# 恢复数据库
mysql -u user -p database_name < backup.sql
```

### 定期备份脚本

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
mysqldump -u user -p database_name > "$BACKUP_DIR/backup_$DATE.sql"
# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

## 故障恢复

### 服务重启

```bash
# 重启所有服务
sudo systemctl restart uof-replay-web
sudo systemctl restart uof-replay-service
sudo systemctl restart uof-amqp-listener

# 或使用 PM2
pm2 restart all
```

### 数据库恢复

```bash
# 停止服务
sudo systemctl stop uof-replay-web

# 恢复数据库
mysql -u user -p database_name < backup.sql

# 重新运行迁移
cd /path/to/uof_replay_tester
pnpm db:push

# 启动服务
sudo systemctl start uof-replay-web
```

## 安全建议

1. **使用 HTTPS**: 在生产环境中始终使用 HTTPS
2. **限制访问**: 使用防火墙限制对服务端口的访问
3. **环境变量**: 不要在代码中硬编码敏感信息
4. **定期更新**: 保持依赖包和系统更新
5. **访问控制**: 实施适当的身份验证和授权机制

## 常见问题

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :8001

# 终止进程
kill -9 <PID>
```

### Python 服务无法启动

```bash
# 检查 Python 版本
python3 --version

# 重新安装依赖
pip3 install --upgrade fastapi uvicorn requests pydantic pika
```

### AMQP 连接失败

```bash
# 测试网络连接
telnet global.replaymq.betradar.com 5671

# 检查访问令牌
echo $BETRADAR_ACCESS_TOKEN
```

## 技术支持

如需帮助，请联系：

- **项目仓库**: <repository-url>
- **问题追踪**: <issues-url>
- **文档**: `/USAGE_GUIDE.md`
