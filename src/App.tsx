import { useState, useEffect, useCallback } from 'react'
import { MapPin, CaretDown, NavigationArrow, Barbell } from '@phosphor-icons/react'
import PoiMapApp from './map/PoiMapApp'
import TrainPage from './train/TrainPage'
import type { HomeBanner, HomeData, NavMenu } from './types'

/** 后端统一返回成功状态码 */
const SUCCESS_CODE = 200

function App() {
  const [path, setPath] = useState('/')

  // 监听浏览器历史变化
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 应用内路由跳转（站内链接走 pushState，避免整页刷新）
  const go = useCallback((link: string) => {
    if (link && link.startsWith('/')) {
      window.history.pushState(null, '', link)
      setPath(link)
    }
  }, [])

  // 高德地图 POI 探索页
  if (path === '/map') {
    return <PoiMapApp />
  }

  // 训练打卡页
  if (path === '/train') {
    return <TrainPage go={go} />
  }

  if (path === '/') {
    return <HomePage go={go} />
  }

  // 404页面
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          404 - 页面未找到
        </h1>
        <p className="text-gray-600 mb-4">路径: {path}</p>
        <a href="/" className="text-blue-600 hover:underline">
          返回首页
        </a>
      </div>
    </div>
  )
}

// ============ 首页 ============

interface HomePageProps {
  go: (link: string) => void
}

function HomePage({ go }: HomePageProps) {
  const [home, setHome] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bannerIndex, setBannerIndex] = useState(0)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  // 拉取首页数据 GET /home
  useEffect(() => {
    fetch('/home')
      .then((res) => res.json())
      .then((result) => {
        if (result.code === SUCCESS_CODE) {
          setHome(result.data)
        } else {
          setError(result.message || '首页数据加载失败')
        }
      })
      .catch(() => setError('无法连接后端服务'))
      .finally(() => setLoading(false))
  }, [])

  const banners = home?.banners ?? []
  const navMenus = home?.navMenus ?? []

  // banner 自动轮播
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [banners.length])

  // 导航菜单：顶级菜单 + 子菜单（按 parentId 归属）
  const topMenus = navMenus.filter((m) => m.parentId === 0)
  const childrenOf = (id: number) => navMenus.filter((m) => m.parentId === id)

  const renderNavMenu = (menu: NavMenu) => {
    const children = childrenOf(menu.id)
    const content = (
      <>
        <span>{menu.name}</span>
        {children.length > 0 && <CaretDown size={14} weight="bold" className="mt-0.5" />}
      </>
    )
    if (children.length === 0) {
      return (
        <button
          key={menu.id}
          onClick={() => go(menu.linkUrl)}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {content}
        </button>
      )
    }
    return (
      <div key={menu.id} className="relative group">
        <button className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          {content}
        </button>
        <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
          <div className="min-w-[140px] bg-white rounded-xl shadow-xl border border-gray-100 py-1.5">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => go(child.linkUrl)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {child.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderBanner = (banner: HomeBanner) => {
    if (failedImages.has(banner.id)) {
      return (
        <div className="w-full h-full flex items-end p-8 bg-gradient-to-br from-slate-800 to-slate-900">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{banner.title}</h2>
        </div>
      )
    }
    return (
      <div className="relative w-full h-full">
        <img
          src={banner.imageUrl}
          alt={banner.title}
          className="w-full h-full object-cover"
          onError={() => setFailedImages((prev) => new Set(prev).add(banner.id))}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <button
          onClick={() => go(banner.linkUrl)}
          className="absolute bottom-0 left-0 right-0 p-8 text-left group"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white group-hover:underline">
            {banner.title}
          </h2>
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-gray-200/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => go('/')} className="flex items-center gap-2">
              <MapPin size={22} weight="fill" className="text-emerald-600" />
              <span className="text-lg font-bold tracking-tight">Hiking Alone</span>
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {topMenus.map(renderNavMenu)}
            </nav>
          </div>
          <button
            onClick={() => go('/map')}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 transition-all active:scale-[0.98]"
          >
            <NavigationArrow size={14} weight="bold" />
            地图探索
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16">
        {/* 横幅 / 加载 / 兜底 hero */}
        {loading ? (
          <div className="mt-6 rounded-3xl bg-white border border-gray-100 h-[380px] flex items-center justify-center text-gray-400">
            首页数据加载中...
          </div>
        ) : banners.length > 0 ? (
          <div className="mt-6 relative overflow-hidden rounded-3xl h-[380px] bg-slate-100 shadow-sm">
            {banners.map((banner, i) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === bannerIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {renderBanner(banner)}
              </div>
            ))}
            {/* 指示点 */}
            {banners.length > 1 && (
              <div className="absolute bottom-4 right-4 z-10 flex gap-1.5">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setBannerIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === bannerIndex ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80'
                    }`}
                    aria-label={`第 ${i + 1} 张横幅`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 h-[380px] flex items-center justify-center">
            <div className="text-center px-4">
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter mb-3">
                Hiking Alone
              </h1>
              <p className="text-emerald-100/80 mb-6">
                {error || '探索未知，挑战自我'}
              </p>
              <button
                onClick={() => go('/map')}
                className="px-6 py-3 bg-white text-slate-900 rounded-full font-medium hover:bg-emerald-50 transition-all active:scale-[0.98]"
              >
                地图探索
              </button>
            </div>
          </div>
        )}

        {error && banners.length > 0 && (
          <p className="mt-3 text-sm text-amber-600 text-center">{error}</p>
        )}

        {/* 地图探索入口 */}
        <section className="mt-10 grid md:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2">地图探索</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              基于高德地图的 POI 搜索与路径规划：搜索起点、按分类查找周边美食娱乐，
              一键规划驾车 / 步行 / 公交 / 骑行路线。
            </p>
            <button
              onClick={() => go('/map')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-full font-medium hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
            <NavigationArrow size={14} weight="bold" />
            进入地图
            </button>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/60 p-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
              <Barbell size={22} weight="fill" className="text-emerald-600" />
              训练打卡
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              制定周期性训练计划，每天提交完成情况，用日历热力图记录每一次坚持。
            </p>
            <button
              onClick={() => go('/train')}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm rounded-full font-medium hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <Barbell size={14} weight="fill" />
              进入训练
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
