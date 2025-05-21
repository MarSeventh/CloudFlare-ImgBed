FROM node:22

WORKDIR /app

COPY . .
RUN npm install
EXPOSE 8080

# 启动应用
CMD ["npm", "run", "start"]
