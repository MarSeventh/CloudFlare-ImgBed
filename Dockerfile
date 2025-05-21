FROM node:22
RUN apt update 
RUN apt install -y ca-certificates

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 8080
# 启动应用
CMD ["npm", "run", "start"]
