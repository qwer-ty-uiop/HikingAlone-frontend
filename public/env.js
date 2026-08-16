/**
 * 高德地图配置
 * 1. 登录 https://console.amap.com/ 创建「Web端(JS API)」类型的 Key
 * 2. 将 key 和 securityJsCode 填入下方
 * 3. 本文件会在 index.html 中、加载地图 loader 之前执行
 */
window.AMAP_CONFIG = {
  key: '850d79c94bdc2ad3a6a998811ae7a715',
  securityJsCode: '0b2193353edeb878fd2dd0c649209bfd',
};

// JSAPI v2.0 安全密钥配置（必须在 AMapLoader.load 之前设置）
window._AMapSecurityConfig = {
  securityJsCode: window.AMAP_CONFIG.securityJsCode,
};
