/** 后端统一返回包装（对应 com.ty.hikingalone.common.result.Result） */
export interface Result<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

/** GET /home 返回体（对应 HomeBodyVO） */
export interface HomeData {
  navMenus: NavMenu[]
  banners: HomeBanner[]
}

/** 导航菜单（对应 NavMenuVO） */
export interface NavMenu {
  id: number
  name: string
  linkUrl: string
  /** 父菜单 id，0 表示顶级菜单 */
  parentId: number
}

/** 首页横幅（对应 HomeBannerVO） */
export interface HomeBanner {
  id: number
  title: string
  imageUrl: string
  linkUrl: string
}
