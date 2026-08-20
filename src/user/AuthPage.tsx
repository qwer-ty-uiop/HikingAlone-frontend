import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  EnvelopeSimple,
  Lock,
  User,
  Eye,
  EyeSlash,
  CheckCircle,
} from '@phosphor-icons/react'
import { userApi } from './api'

/** 磁吸 CTA：按钮中心向鼠标微幅吸附（与 TrainPage 的 Magnetic 一致） */
function Magnetic({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 100, damping: 20 })
  const sy = useSpring(y, { stiffness: 100, damping: 20 })
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - rect.left - rect.width / 2) * 0.2)
        y.set((e.clientY - rect.top - rect.height / 2) * 0.35)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
      className="inline-block"
    >
      {children}
    </motion.div>
  )
}

/** 输入框：label 在上，帮助文本可选，错误信息在下；自绘密码可见性切换 */
function Field({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  helper,
  error,
  autoFocus,
}: {
  label: string
  icon: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  helper?: string
  error?: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          type={isPassword ? (visible ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full pl-10 ${isPassword ? 'pr-10' : 'pr-3.5'} py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-slate-400 ${
            error ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-emerald-500'
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors active:scale-95"
            aria-label={visible ? '隐藏密码' : '显示密码'}
            tabIndex={-1}
          >
            {visible ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
          </button>
        )}
      </div>
      {helper && !error && <span className="block text-xs text-slate-400 mt-1.5">{helper}</span>}
      {error && <span className="block text-xs text-red-500 mt-1.5">{error}</span>}
    </label>
  )
}

interface AuthPageProps {
  go: (link: string) => void
  onLogin: (email: string) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthPage({ go, onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showForget, setShowForget] = useState(false)

  // 登录
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginFieldError, setLoginFieldError] = useState<{ email?: string; password?: string }>({})

  // 注册
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regError, setRegError] = useState('')
  const [regFieldError, setRegFieldError] = useState<{ username?: string; email?: string; password?: string; confirm?: string }>({})

  // 改密
  const [fpEmail, setFpEmail] = useState('')
  const [fpOld, setFpOld] = useState('')
  const [fpNew, setFpNew] = useState('')
  const [fpConfirm, setFpConfirm] = useState('')
  const [fpError, setFpError] = useState('')
  const [fpFieldError, setFpFieldError] = useState<{ email?: string; oldPassword?: string; newPassword?: string; confirm?: string }>({})
  const [fpDone, setFpDone] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // 切换登录/注册时清掉上一次的错误提示
  useEffect(() => {
    setLoginError('')
    setLoginFieldError({})
    setRegError('')
    setRegFieldError({})
  }, [mode])

  /** 登录：email+password 必填，格式校验 + 提交 */
  const submitLogin = async () => {
    const fe: { email?: string; password?: string } = {}
    if (!loginEmail.trim()) fe.email = '请输入邮箱'
    else if (!EMAIL_RE.test(loginEmail.trim())) fe.email = '邮箱格式不正确'
    if (!loginPassword) fe.password = '请输入密码'
    setLoginFieldError(fe)
    if (Object.keys(fe).length) return
    setSubmitting(true)
    setLoginError('')
    try {
      const result = await userApi.login({ email: loginEmail.trim(), password: loginPassword })
      onLogin(result.email)
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  /** 注册：username/email/password/确认密码，全量校验 + 提交；成功后自动切回登录并预填邮箱 */
  const submitRegister = async () => {
    const fe: { username?: string; email?: string; password?: string; confirm?: string } = {}
    if (!regUsername.trim()) fe.username = '请输入用户名'
    else if (regUsername.trim().length < 2) fe.username = '用户名至少 2 个字符'
    if (!regEmail.trim()) fe.email = '请输入邮箱'
    else if (!EMAIL_RE.test(regEmail.trim())) fe.email = '邮箱格式不正确'
    if (!regPassword) fe.password = '请输入密码'
    else if (regPassword.length < 6) fe.password = '密码至少 6 位'
    if (!regConfirm) fe.confirm = '请再次输入密码'
    else if (regConfirm !== regPassword) fe.confirm = '两次输入的密码不一致'
    setRegFieldError(fe)
    if (Object.keys(fe).length) return
    setSubmitting(true)
    setRegError('')
    try {
      await userApi.register({ username: regUsername.trim(), email: regEmail.trim(), password: regPassword })
      // 注册成功：切回登录并预填邮箱
      setLoginEmail(regEmail.trim())
      setMode('login')
    } catch (e) {
      setRegError(e instanceof Error ? e.message : '注册失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  /** 改密：email/旧密码/新密码/确认，全量校验 + 提交；成功后关闭面板并清空 */
  const submitForget = async () => {
    const fe: { email?: string; oldPassword?: string; newPassword?: string; confirm?: string } = {}
    if (!fpEmail.trim()) fe.email = '请输入邮箱'
    else if (!EMAIL_RE.test(fpEmail.trim())) fe.email = '邮箱格式不正确'
    if (!fpOld) fe.oldPassword = '请输入旧密码'
    if (!fpNew) fe.newPassword = '请输入新密码'
    else if (fpNew.length < 6) fe.newPassword = '新密码至少 6 位'
    if (!fpConfirm) fe.confirm = '请再次输入新密码'
    else if (fpConfirm !== fpNew) fe.confirm = '两次输入的密码不一致'
    setFpFieldError(fe)
    if (Object.keys(fe).length) return
    setSubmitting(true)
    setFpError('')
    try {
      await userApi.changePassword({
        email: fpEmail.trim(),
        oldPassword: fpOld,
        newPassword: fpNew,
      })
      setFpDone(true)
    } catch (e) {
      setFpError(e instanceof Error ? e.message : '修改失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* 环境氛围光晕（与 TrainPage 一致） */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      {/* 顶栏：返回首页 + 品牌 */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => go('/')}
            className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors active:scale-95"
            aria-label="返回首页"
          >
            <ArrowLeft size={18} weight="regular" />
          </button>
          <button onClick={() => go('/')} className="flex items-center gap-2">
            <MapPin size={20} weight="fill" className="text-emerald-600" />
            <span className="text-lg font-bold tracking-tight">Hiking Alone</span>
          </button>
          <span className="w-9" />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {showForget ? (
              /* ===== 忘记密码面板 ===== */
              <motion.div
                key="forget"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                className="rounded-4xl border border-slate-200/50 bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
              >
                <h1 className="text-2xl font-bold tracking-tighter text-slate-900">修改密码</h1>
                <p className="text-sm text-slate-500 mt-1.5 mb-7">验证旧密码后设置新密码</p>

                {fpDone ? (
                  <div className="py-8 text-center">
                    <CheckCircle size={44} weight="light" className="mx-auto text-emerald-500 mb-3" />
                    <p className="text-slate-700 font-medium">密码修改成功</p>
                    <p className="text-sm text-slate-400 mt-1">请使用新密码登录</p>
                    <button
                      onClick={() => {
                        setShowForget(false)
                        setFpDone(false)
                        setFpEmail('')
                        setFpOld('')
                        setFpNew('')
                        setFpConfirm('')
                      }}
                      className="mt-6 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                    >
                      返回登录
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Field
                      label="邮箱"
                      icon={<EnvelopeSimple size={15} weight="bold" />}
                      type="email"
                      value={fpEmail}
                      onChange={setFpEmail}
                      placeholder="you@example.com"
                      error={fpFieldError.email}
                      autoFocus
                    />
                    <Field
                      label="旧密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={fpOld}
                      onChange={setFpOld}
                      placeholder="当前使用的密码"
                      error={fpFieldError.oldPassword}
                    />
                    <Field
                      label="新密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={fpNew}
                      onChange={setFpNew}
                      placeholder="至少 6 位"
                      helper="建议使用字母 + 数字组合"
                      error={fpFieldError.newPassword}
                    />
                    <Field
                      label="确认新密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={fpConfirm}
                      onChange={setFpConfirm}
                      placeholder="再次输入新密码"
                      error={fpFieldError.confirm}
                    />

                    {fpError && (
                      <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{fpError}</p>
                    )}

                    <Magnetic>
                      <button
                        onClick={submitForget}
                        disabled={submitting}
                        className="w-full py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitting ? '提交中…' : '确认修改'}
                      </button>
                    </Magnetic>
                    <button
                      onClick={() => setShowForget(false)}
                      className="w-full text-center text-sm text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      返回登录
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* ===== 登录 / 注册双面板 ===== */
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                className="rounded-4xl border border-slate-200/50 bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
              >
                <h1 className="text-2xl font-bold tracking-tighter text-slate-900">
                  {mode === 'login' ? '欢迎回来' : '创建账号'}
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 mb-7">
                  {mode === 'login' ? '登录后继续你的徒步计划' : '加入 Hiking Alone，开始记录每一次坚持'}
                </p>

                {mode === 'login' ? (
                  <div className="space-y-4">
                    <Field
                      label="邮箱"
                      icon={<EnvelopeSimple size={15} weight="bold" />}
                      type="email"
                      value={loginEmail}
                      onChange={setLoginEmail}
                      placeholder="you@example.com"
                      error={loginFieldError.email}
                    />
                    <Field
                      label="密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      placeholder="请输入密码"
                      error={loginFieldError.password}
                    />

                    {loginError && (
                      <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{loginError}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span />
                      <button
                        onClick={() => setShowForget(true)}
                        className="text-xs text-slate-400 hover:text-emerald-700 transition-colors"
                      >
                        忘记密码？
                      </button>
                    </div>

                    <Magnetic>
                      <button
                        onClick={submitLogin}
                        disabled={submitting}
                        className="w-full py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitting ? '登录中…' : '登录'}
                      </button>
                    </Magnetic>

                    <p className="text-sm text-slate-500 text-center pt-1">
                      还没有账号？{' '}
                      <button
                        onClick={() => setMode('register')}
                        className="text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                      >
                        立即注册
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Field
                      label="用户名"
                      icon={<User size={15} weight="bold" />}
                      value={regUsername}
                      onChange={setRegUsername}
                      placeholder="你的昵称"
                      error={regFieldError.username}
                    />
                    <Field
                      label="邮箱"
                      icon={<EnvelopeSimple size={15} weight="bold" />}
                      type="email"
                      value={regEmail}
                      onChange={setRegEmail}
                      placeholder="you@example.com"
                      error={regFieldError.email}
                    />
                    <Field
                      label="密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={regPassword}
                      onChange={setRegPassword}
                      placeholder="至少 6 位"
                      helper="建议使用字母 + 数字组合"
                      error={regFieldError.password}
                    />
                    <Field
                      label="确认密码"
                      icon={<Lock size={15} weight="bold" />}
                      type="password"
                      value={regConfirm}
                      onChange={setRegConfirm}
                      placeholder="再次输入密码"
                      error={regFieldError.confirm}
                    />

                    {regError && (
                      <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{regError}</p>
                    )}

                    <Magnetic>
                      <button
                        onClick={submitRegister}
                        disabled={submitting}
                        className="w-full py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitting ? '注册中…' : '注册'}
                      </button>
                    </Magnetic>

                    <p className="text-sm text-slate-500 text-center pt-1">
                      已有账号？{' '}
                      <button
                        onClick={() => setMode('login')}
                        className="text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                      >
                        直接登录
                      </button>
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
