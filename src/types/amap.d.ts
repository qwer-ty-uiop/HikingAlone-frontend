// 高德地图 JSAPI v2.0 全局类型声明（AMap 通过 script 标签全局加载）
export {}

declare global {
  interface Window {
    /** 高德地图 JSAPI 加载器（来自 https://webapi.amap.com/loader.js） */
    AMapLoader: any
    /** 地图 AK 配置（来自 public/env.js） */
    AMAP_CONFIG: {
      key: string
      securityJsCode: string
    }
    /** JSAPI v2.0 安全密钥配置 */
    _AMapSecurityConfig?: {
      securityJsCode?: string
      serviceHost?: string
    }
  }
}
