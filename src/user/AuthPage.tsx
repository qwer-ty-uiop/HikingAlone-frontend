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
  CircleNotch,
} from '@phosphor-icons/react'
import { userApi } from './api'

/**
 * 磁吸 CTA：按钮中心向鼠标微幅吸附（与 TrainPage 的 Magnetic 一致）。
 * className 由调用方传入（默认 inline-block），包裹全宽按钮时必须传 block/w-full，
 * 否则 inline-block 父容器宽度由内容决定，子元素 w-full 解析失败导致按钮塌缩为内容宽度、文字溢出。
 */
function Magnetic({ children, className = 'inline-block' }: { children: React.ReactNode; className?: string }) {
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
      className={className}
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

/**
 * 邮箱验证码字段：验证码输入框 + 磁吸发送按钮，覆盖发送中/成功/冷却/失败四种状态：
 * - 发送中：按钮转圈图标 + 「发送中」，禁点
 * - 成功：消息行绿色对勾入场，按钮进入 60s 倒计时（下方进度条随剩余秒数线性缩短）
 * - 冷却（后端 sent=false）：红字提示「发送过于频繁」+ 60s 倒计时防连点（与后端冷却时长对齐）
 * - 失败：按钮抖动 + 红字提示；重试/重新发送时清除
 * 邮箱格式问题不在本组件内处理，通过 onEmailInvalid 回调到父级邮箱字段下展示。
 */
function VerificationCodeField({
  email,
  value,
  onChange,
  error,
  onEmailInvalid,
}: {
  email: string
  value: string
  onChange: (v: string) => void
  error?: string
  onEmailInvalid: (msg: string) => void
}) {
  const [sending, setSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0) // 本次倒计时总长（成功/冷却均为 60s），用于进度条比例
  const [msg, setMsg] = useState('')
  const [shakeKey, setShakeKey] = useState(0) // 自增触发按钮失败抖动

  // 倒计时逐秒递减
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // 倒计时归零：清掉提示与成功态，避免残留误导
  useEffect(() => {
    if (countdown === 0 && msg) {
      setMsg('')
      setSentSuccess(false)
    }
  }, [countdown, msg])

  const send = async () => {
    if (countdown > 0 || sending) return
    const em = email.trim()
    if (!em) {
      onEmailInvalid('请先输入邮箱')
      return
    }
    if (!EMAIL_RE.test(em)) {
      onEmailInvalid('邮箱格式不正确')
      return
    }
    onEmailInvalid('')
    setSending(true)
    setMsg('')
    try {
      const result = await userApi.sendCode({ email: em })
      if (result.sent) {
        setSentSuccess(true)
        setMsg('验证码已发送，请查收邮件')
        setCountdown(60)
        setTotalSeconds(60)
      } else {
        // 后端处于冷却期：未发送，提示并禁点（与后端 register.code.cool=60s 对齐，避免提前点击又被拒）
        setMsg('发送过于频繁，请稍后再试')
        setCountdown(60)
        setTotalSeconds(60)
        setShakeKey((k) => k + 1)
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '验证码发送失败，请稍后重试')
      setShakeKey((k) => k + 1)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-1.5">邮箱验证码</span>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Lock size={15} weight="bold" />
          </span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4 位数字"
            inputMode="numeric"
            className={`w-full rounded-2xl border bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition-all placeholder:text-slate-300 ${
              error
                ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100'
                : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
            }`}
          />
          {/* 倒计时进度条：剩余秒数/总长比例，宽度线性缩短，直观表达等待剩余 */}
          {countdown > 0 && (
            <div className="absolute bottom-[5px] left-10 right-3.5 h-[2px] rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                animate={{ width: `${(countdown / totalSeconds) * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          )}
        </div>
        {/* shakeKey 变化 → 重挂载触发失败抖动（keyframes 只在挂载时执行一次） */}
        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <Magnetic>
            <button
              onClick={send}
              disabled={sending || countdown > 0}
              className={`flex items-center justify-center gap-1.5 shrink-0 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                countdown > 0
                  ? 'bg-slate-100 text-slate-500'
                  : sending
                    ? 'bg-emerald-600/80 text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {sending ? (
                <>
                  <CircleNotch size={14} weight="bold" className="animate-spin" />
                  发送中
                </>
              ) : countdown > 0 ? (
                /* key 每秒变化 → 数字切换时轻弹入场，让倒计时有跳动感 */
                <motion.span
                  key={countdown}
                  initial={{ y: -4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  {countdown}s
                </motion.span>
              ) : (
                '获取验证码'
              )}
            </button>
          </Magnetic>
        </motion.div>
      </div>
      <AnimatePresence>
        {msg && (
          <motion.p
            key={msg}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-1 text-xs flex items-center gap-1 ${sentSuccess ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {sentSuccess && <CheckCircle size={13} weight="bold" />}
            {msg}
          </motion.p>
        )}
      </AnimatePresence>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
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
  const [regFieldError, setRegFieldError] = useState<{ username?: string; email?: string; password?: string; confirm?: string; code?: string }>({})

  // 改密
  const [fpEmail, setFpEmail] = useState('')
  const [fpOld, setFpOld] = useState('')
  const [fpNew, setFpNew] = useState('')
  const [fpConfirm, setFpConfirm] = useState('')
  const [fpCode, setFpCode] = useState('')
  const [fpError, setFpError] = useState('')
  const [fpFieldError, setFpFieldError] = useState<{ email?: string; oldPassword?: string; newPassword?: string; confirm?: string; code?: string }>({})
  const [fpDone, setFpDone] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // 注册验证码：输入值（发送/倒计时状态由 VerificationCodeField 自持）
  const [regCode, setRegCode] = useState('')

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

  /** 注册：username/email/password/确认密码/验证码，全量校验 + 提交；成功后自动切回登录并预填邮箱 */
  const submitRegister = async () => {
    const fe: { username?: string; email?: string; password?: string; confirm?: string; code?: string } = {}
    if (!regUsername.trim()) fe.username = '请输入用户名'
    else if (regUsername.trim().length < 2) fe.username = '用户名至少 2 个字符'
    if (!regEmail.trim()) fe.email = '请输入邮箱'
    else if (!EMAIL_RE.test(regEmail.trim())) fe.email = '邮箱格式不正确'
    if (!regPassword) fe.password = '请输入密码'
    else if (regPassword.length < 6) fe.password = '密码至少 6 位'
    if (!regConfirm) fe.confirm = '请再次输入密码'
    else if (regConfirm !== regPassword) fe.confirm = '两次输入的密码不一致'
    if (!regCode.trim()) fe.code = '请输入验证码'
    else if (regCode.trim().length !== 4) fe.code = '验证码为 4 位数字'
    setRegFieldError(fe)
    if (Object.keys(fe).length) return
    setSubmitting(true)
    setRegError('')
    try {
      await userApi.register({ username: regUsername.trim(), email: regEmail.trim(), password: regPassword, code: regCode.trim() })
      // 注册成功：切回登录并预填邮箱
      setLoginEmail(regEmail.trim())
      setMode('login')
    } catch (e) {
      setRegError(e instanceof Error ? e.message : '注册失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  /** 改密：email/验证码/旧密码/新密码/确认，全量校验 + 提交；成功后关闭面板并清空 */
  const submitForget = async () => {
    const fe: { email?: string; oldPassword?: string; newPassword?: string; confirm?: string; code?: string } = {}
    if (!fpEmail.trim()) fe.email = '请输入邮箱'
    else if (!EMAIL_RE.test(fpEmail.trim())) fe.email = '邮箱格式不正确'
    if (!fpCode.trim()) fe.code = '请输入验证码'
    else if (fpCode.trim().length !== 4) fe.code = '验证码为 4 位数字'
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
        code: fpCode.trim(),
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

      {/* overflow-y-auto：卡片超高（注册/改密 4 字段 + 错误提示）时页面可滚动，不被 items-center 裁切 */}
      <main className="relative z-10 flex-1 flex items-center justify-center overflow-y-auto px-4 py-10">
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
                <p className="text-sm text-slate-500 mt-1.5 mb-7">验证邮箱归属后设置新密码</p>

                {fpDone ? (
                  <div className="py-8 text-center">
                    <CheckCircle size={44} weight="light" className="mx-auto text-emerald-500 mb-3" />
                    <p className="text-slate-700 font-medium">密码修改成功</p>
                    <p className="text-sm text-slate-400 mt-1">请使用新密码登录</p>
                    <Magnetic className="block w-full">
                      <button
                        onClick={() => {
                          setShowForget(false)
                          setFpDone(false)
                          setFpEmail('')
                          setFpOld('')
                          setFpNew('')
                          setFpConfirm('')
                          setFpCode('')
                        }}
                        className="mt-6 w-full py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                      >
                        返回登录
                      </button>
                    </Magnetic>
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
                    {/* 验证码：改密同样需要邮箱验证码证明归属（复用注册同款发送交互） */}
                    <VerificationCodeField
                      email={fpEmail}
                      value={fpCode}
                      onChange={setFpCode}
                      error={fpFieldError.code}
                      onEmailInvalid={(msg) => setFpFieldError((p) => ({ ...p, email: msg }))}
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

                    <Magnetic className="block w-full">
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

                    <Magnetic className="block w-full">
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
                    {/* 验证码：输入框 + 磁吸发送按钮（发送中/成功/冷却/失败反馈），60s 倒计时防重复发送 */}
                    <VerificationCodeField
                      email={regEmail}
                      value={regCode}
                      onChange={setRegCode}
                      error={regFieldError.code}
                      onEmailInvalid={(msg) => setRegFieldError((p) => ({ ...p, email: msg }))}
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

                    <Magnetic className="block w-full">
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
