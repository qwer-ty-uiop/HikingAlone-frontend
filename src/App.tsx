import { useState, useEffect, useCallback } from 'react'
import { MapPin, CaretDown, Barbell, UserCircle, SignOut } from '@phosphor-icons/react'
import TrainPage from './train/TrainPage'
import AuthPage from './user/AuthPage'
import { userApi } from './user/api'
import type { HomeBanner, HomeData, NavMenu } from './types'

/** 后端统一返回成功状态码 */
const SUCCESS_CODE = 200

/** 登录态本地存储键：仅存邮箱标识，密码等敏感信息不落 localStorage */
const AUTH_EMAIL_KEY = 'hikingalone.email'

function App() {
  const [path, setPath] = useState('/')
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(AUTH_EMAIL_KEY))

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

  const handleLogin = useCallback((userEmail: string) => {
    localStorage.setItem(AUTH_EMAIL_KEY, userEmail)
    setEmail(userEmail)
    // 登录成功后回到首页
    go('/')
  }, [go])

  const handleLogout = useCallback(() => {
    // 通知服务端使会话失效；失败也继续本地清理（会话可能已过期）
    userApi.logout().catch(() => {})
    localStorage.removeItem(AUTH_EMAIL_KEY)
    setEmail(null)
    go('/')
  }, [go])

  // 训练打卡页
  if (path === '/train') {
    return <TrainPage go={go} />
  }

  if (path === '/login') {
    return <AuthPage go={go} onLogin={handleLogin} />
  }

  if (path === '/') {
    return <HomePage go={go} email={email} onLogout={handleLogout} />
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
  email: string | null
  onLogout: () => void
}

function HomePage({ go, email, onLogout }: HomePageProps) {
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
          {/* 用户区：未登录显示「登录 / 注册」；已登录显示邮箱 + 退出 */}
          <div className="flex items-center gap-2">
            {email ? (
              <>
                <span className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-sm text-slate-600">
                  <UserCircle size={18} weight="regular" className="text-emerald-600" />
                  {email}
                </span>
                <button
                  onClick={onLogout}
                  title="退出登录"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors active:scale-[0.98]"
                >
                  <SignOut size={16} weight="regular" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => go('/login')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-full font-medium transition-all active:scale-[0.98]"
              >
                <UserCircle size={16} weight="regular" />
                登录 / 注册
              </button>
            )}
          </div>
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
                onClick={() => go('/train')}
                className="px-6 py-3 bg-white text-slate-900 rounded-full font-medium hover:bg-emerald-50 transition-all active:scale-[0.98]"
              >
                进入训练
              </button>
            </div>
          </div>
        )}

        {error && banners.length > 0 && (
          <p className="mt-3 text-sm text-amber-600 text-center">{error}</p>
        )}

        {/* 训练打卡入口 */}
        <section className="mt-10">
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
