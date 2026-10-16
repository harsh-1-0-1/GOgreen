FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_RAZORPAY_KEY_ID=
ARG VITE_CDN_BASE_URL=
ARG VITE_CORPORATE_INQUIRY_ENDPOINT=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_RAZORPAY_KEY_ID=${VITE_RAZORPAY_KEY_ID} \
    VITE_CDN_BASE_URL=${VITE_CDN_BASE_URL} \
    VITE_CORPORATE_INQUIRY_ENDPOINT=${VITE_CORPORATE_INQUIRY_ENDPOINT}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
