/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 天地图浏览器端 key，可选；填了之后默认使用天地图底图 */
  readonly VITE_TIANDITU_TK?: string
  /** 天地图审图号，正式发布前必须配置真实编号 */
  readonly VITE_TIANDITU_AUDIT_NO?: string
  /** 前后端分离部署时的后端地址；同源部署留空 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
