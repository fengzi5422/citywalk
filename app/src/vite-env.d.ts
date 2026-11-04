/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 天地图浏览器端 key，可选；填了之后默认使用天地图底图 */
  readonly VITE_TIANDITU_TK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
