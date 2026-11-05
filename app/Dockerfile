ARG BUILDER_IMAGE=node:22-alpine
ARG RUNTIME_IMAGE=nginx:alpine
FROM ${BUILDER_IMAGE} AS build

WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app ./
# 同源部署时留空即可，nginx 会把 /api 转发到后端
# 天地图 key 与审图号只在构建阶段注入，不会进入最终 nginx 镜像
ARG VITE_API_BASE=""
ARG VITE_TIANDITU_TK=""
ARG VITE_TIANDITU_AUDIT_NO=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_TIANDITU_TK=$VITE_TIANDITU_TK
ENV VITE_TIANDITU_AUDIT_NO=$VITE_TIANDITU_AUDIT_NO
RUN npm run build

FROM ${RUNTIME_IMAGE}
COPY --from=build /app/dist /usr/share/nginx/html
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
