FROM ubuntu:22.04

# 设置时区与非交互模式
ENV DEBIAN_FRONTEND=noninteractive

# 安装 Node.js 和必要依赖
RUN apt update && \
    apt install -y curl gnupg ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt install -y nodejs && \
    apt clean && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 拷贝代码
COPY . .

# 安装依赖
RUN npm install

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["npm", "run", "start"]
