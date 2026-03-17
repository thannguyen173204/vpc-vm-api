FROM node:22-alpine

RUN apk add --no-cache bash curl sed make gcc g++ python3
RUN curl -L -o - "https://github.com/vmware/govmomi/releases/latest/download/govc_Linux_x86_64.tar.gz" | tar -C /usr/local/bin -xvzf - govc \
    && chmod +x /usr/local/bin/govc

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
