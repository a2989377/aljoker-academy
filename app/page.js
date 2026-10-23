'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, PINS, ROLES, BRANCHES, MONTHS, EXP_CATS, EXP_COLORS, monthEnd, fmt, uploadReceipt, subStatus, daysBetween } from '../lib/supabase'

const TODAY = new Date().toISOString().slice(0, 10)
const avColors = ['list-av-red','list-av-green','list-av-blue','list-av-yellow']

// ============ DONUT CHART ============
function DonutChart({ labels, vals, colors }) {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !vals.length) return
    const ctx = canvas.getContext('2d')
    const total = vals.reduce((a,v) => a+v, 0)
    const cx = 60, cy = 60, r = 52, inner = 36
    ctx.clearRect(0, 0, 120, 120)
    let start = -Math.PI/2
    vals.forEach((v, i) => {
      const slice = (v/total) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, start+slice)
      ctx.closePath(); ctx.fillStyle = colors[i]; ctx.fill()
      start += slice
    })
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI*2)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface')||'#fff'
    ctx.fill()
  }, [vals, colors])
  return <canvas ref={canvasRef} width={120} height={120} />
}

// ============ BAR CHART ============
function BarChart({ labels, vals, color='#CC1F1F', height=120 }) {
  const canvasRef = useRef()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !vals.length) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const pad = { top:10, bottom:28, left:8, right:8 }
    const max = Math.max(...vals, 1)
    const barW = Math.floor((W - pad.left - pad.right) / vals.length) - 4
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f4f4f5'
    ctx.fillRect(0, 0, W, H)
    vals.forEach((v, i) => {
      const x = pad.left + i * ((W - pad.left - pad.right) / vals.length) + 2
      const barH = Math.round((v / max) * (H - pad.top - pad.bottom))
      const y = H - pad.bottom - barH
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 3) : ctx.rect(x, y, barW, barH)
      ctx.fill()
      ctx.fillStyle = '#a1a1aa'
      ctx.font = '9px IBM Plex Sans Arabic, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(labels[i], x + barW/2, H - 8)
      if (v > 0) {
        ctx.fillStyle = '#52525b'
        ctx.font = 'bold 8px IBM Plex Sans Arabic, sans-serif'
        ctx.fillText(v, x + barW/2, y - 3)
      }
    })
  }, [vals, labels, color])
  return <canvas ref={canvasRef} width={320} height={height} style={{ width:'100%', height:height }} />
}

// ============ SMALL COMPONENTS ============
function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`toast toast-show toast-${type}`}>{msg}</div>
}

function SyncDot({ syncing }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background: syncing?'var(--yellow)':'var(--green)', boxShadow: syncing?'0 0 5px var(--yellow)':'0 0 5px var(--green)', transition:'all .3s' }} />
      <span style={{ fontSize:9, color:'rgba(255,255,255,.45)' }}>{syncing?'جاري المزامنة':'متزامن'}</span>
    </div>
  )
}

function Banner({ role, onLogout, onRefresh, syncing, branch, setBranch }) {
  const r = ROLES[role]
  const isOwner = role === 'owner'
  return (
    <div className="banner">
      <div className="brand">
        <div className="logo">J</div>
        <div>
          <div className="brand-title">أكاديمية الجوكر</div>
          <div className="brand-sub" style={{ display:'flex', alignItems:'center', gap:6 }}>
            {isOwner ? (
              <select value={branch} onChange={e => setBranch(e.target.value)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.5)', fontSize:10, fontFamily:'inherit', cursor:'pointer', padding:0, outline:'none' }}>
                {BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background:'#0a0a0a' }}>{b.label}</option>)}
              </select>
            ) : (
              <span style={{ fontSize:10, color:'rgba(255,255,255,.45)' }}>{r?.branch==='jazan'?'جازان':'الرياض'}</span>
            )}
            <SyncDot syncing={syncing} />
          </div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <button onClick={onRefresh} style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, color:'rgba(255,255,255,.7)' }}>↻</button>
        <button className="logout-btn" onClick={onLogout}>
          <div className="user-av">{r?.avatar}</div>
          <span className="username">خروج</span>
        </button>
      </div>
    </div>
  )
}

function BottomNav({ role, active, setActive, pendingCount }) {
  const tabs = {
    owner:         [{ id:'dashboard', icon:'📊', label:'داشبورد' }, { id:'academy', icon:'🎓', label:'الأكاديمية' }, { id:'fields', icon:'🏟️', label:'الملاعب' }, { id:'expenses', icon:'💸', label:'المصاريف' }],
    admin_riyadh:  [{ id:'subs', icon:'👥', label:'المشتركون' }, { id:'bus', icon:'🚌', label:'الباص' }, { id:'inventory', icon:'🛍️', label:'المستلزمات' }, { id:'my-expenses', icon:'💸', label:'المصاريف' }],
    fields_riyadh: [{ id:'cal', icon:'🏟️', label:'الملاعب' }, { id:'my-expenses', icon:'💸', label:'المصاريف' }],
    admin_jazan:   [{ id:'subs', icon:'👥', label:'المشتركون' }, { id:'bus', icon:'🚌', label:'الباص' }, { id:'inventory', icon:'🛍️', label:'المستلزمات' }, { id:'my-expenses', icon:'💸', label:'المصاريف' }],
    fields_jazan:  [{ id:'cal', icon:'🏟️', label:'الملاعب' }, { id:'my-expenses', icon:'💸', label:'المصاريف' }],
  }
  return (
    <nav className="bottom-nav">
      {(tabs[role]||[]).map(t => (
        <button key={t.id} className={`nav-item ${active===t.id?'nav-active':''}`} onClick={() => setActive(t.id)}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
          {t.id==='dashboard' && pendingCount>0 && <span className="nav-notif">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div className="modal-title" style={{ margin:0 }}>{title}</div>
          <button onClick={onClose} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:16, color:'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PaymentBtns({ value, onChange }) {
  return (
    <div className="payment-btns">
      {['نقدي','شبكة','تحويل'].map(m => (
        <button key={m} className={`pay-btn ${value===m?'pay-selected':''}`} onClick={() => onChange(m)}>
          {m==='نقدي'?'💵 نقدي':m==='شبكة'?'💳 شبكة':'📱 تحويل'}
        </button>
      ))}
    </div>
  )
}

function ReceiptUpload({ label, folder, onUploaded }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()
  async function handleChange(e) {
    const f = e.target.files[0]; if (!f) return
    setFile(f); setUploading(true)
    try { const url = await uploadReceipt(f, folder); onUploaded(url) } catch(err) { console.error(err) }
    setUploading(false)
  }
  return (
    <div className="form-group">
      <label className="form-label">{label} <span style={{ color:'var(--red)' }}>*</span></label>
      <div className={`receipt-wrap ${file?'receipt-has-file':''}`} onClick={() => inputRef.current?.click()}>
        <div className="receipt-icon">📎</div>
        <div className={`receipt-text ${file?'receipt-text-green':''}`}>{uploading?'جاري الرفع...':file?'✅ '+file.name:'اضغط لرفع الإيصال'}</div>
        <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleChange}/>
      </div>
      <div className="receipt-note">⚠️ الإيصال مطلوب للدفع غير النقدي</div>
    </div>
  )
}

// ============ LOGIN ============
function LoginPage({ onLogin }) {
  const [role, setRole] = useState('owner')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  function press(d) {
    if (pin.length >= 4) return
    const p = pin+d; setPin(p)
    if (p.length === 4) setTimeout(() => {
      if (p === PINS[role]) { onLogin(role) }
      else { setError(true); setPin('') }
    }, 150)
  }
  return (
    <div className="login-wrap">
      <div className="login-logo">J</div>
      <div className="login-title">أكاديمية الجوكر</div>
      <div className="login-sub">أدخل رمز الدخول</div>
      <div className="login-card">
        <label className="login-label">نوع المستخدم</label>
        <select className="login-select" value={role} onChange={e => { setRole(e.target.value); setPin(''); setError(false) }}>
          <option value="owner">المالك</option>
          <option value="admin_riyadh">الإدارة - الرياض</option>
          <option value="fields_riyadh">الملاعب - الرياض</option>
          <option value="admin_jazan">الإدارة - جازان</option>
          <option value="fields_jazan">الملاعب - جازان</option>
        </select>
        <div className="pin-wrap">
          {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${i<pin.length?'pin-filled':''}`}/>)}
        </div>
        <div className="numpad">
          {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} className="num-btn" onClick={() => press(String(n))}>{n}</button>)}
          <button className="num-btn" onClick={() => { setPin(''); setError(false) }}>مسح</button>
          <button className="num-btn" onClick={() => press('0')}>0</button>
          <button className="num-btn" onClick={() => setPin(p => p.slice(0,-1))}>⌫</button>
        </div>
        {error && <div className="login-error">رمز الدخول غير صحيح</div>}
      </div>
    </div>
  )
}

// ============ OWNER DASHBOARD ============
function OwnerDashboard({ toast, refresh, branch }) {
  const [month, setMonth] = useState('2026-10')
  const [stats, setStats] = useState({ pitchRev:0, subRev:0, kitRev:0, otherRev:0, exp:0, bookingCount:0, subsCount:0 })
  const [lastStats, setLastStats] = useState({ pitchRev:0, subRev:0, kitRev:0, exp:0 })
  const [pending, setPending] = useState([])
  const [archive, setArchive] = useState([])
  const [topSubs, setTopSubs] = useState([])
  const [dowData, setDowData] = useState([0,0,0,0,0,0,0])
  const [expiringSoon, setExpiringSoon] = useState([])
  const [pitchUtil, setPitchUtil] = useState({ rate:0, bookedHours:0, availableHours:0 })
  const [loading, setLoading] = useState(true)

  async function load(m) {
    setLoading(true)
    const start = m+'-01', end = monthEnd(m)

    // Calculate previous month
    const [py, pm] = m.split('-').map(Number)
    const prevM = pm === 1 ? `${py-1}-12` : `${py}-${String(pm-1).padStart(2,'0')}`
    const prevStart = prevM+'-01', prevEnd = monthEnd(prevM)

    const [bkRes, expRes, subRes, salesRes, prevBkRes, prevExpRes, prevSubRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).eq('status','approved').gte('date', start).lte('date', end),
      supabase.from('expenses').select('amount,category').eq('branch', branch).eq('status','approved').gte('date', start).lte('date', end),
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','approved'),
      supabase.from('sales').select('total,created_at').eq('branch', branch).eq('status','approved').gte('created_at', start+'T00:00:00').lte('created_at', end+'T23:59:59'),
      supabase.from('bookings').select('amount').eq('branch', branch).eq('status','approved').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('expenses').select('amount').eq('branch', branch).eq('status','approved').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('subscribers').select('sub_amount,kit_amount,start_date').eq('branch', branch).eq('status','approved'),
    ])

    const bks = bkRes.data||[]
    const subs = subRes.data||[]
    const exps = expRes.data||[]
    const sales = salesRes.data||[]

    // Revenue calc - subscriptions only counted in their start month
    const monthSubs = subs.filter(s => s.start_date && s.start_date.startsWith(m))
    const subRev = monthSubs.reduce((a,s) => a+Number(s.sub_amount||0), 0)
    const kitRev = monthSubs.reduce((a,s) => a+Number(s.kit_amount||0), 0) + sales.reduce((a,s) => a+Number(s.total), 0)
    const pitchRev = bks.reduce((a,b) => a+Number(b.amount), 0)
    const otherRev = monthSubs.reduce((a,s) => a+Number(s.other_amount||0), 0)
    const exp = exps.reduce((a,e) => a+Number(e.amount), 0)
    setStats({ pitchRev, subRev, kitRev, otherRev, exp, bookingCount:bks.length, subsCount:monthSubs.length })

    // Previous month stats for comparison
    const prevBks = prevBkRes.data||[]
    const prevExps = prevExpRes.data||[]
    const prevSubs = prevSubRes.data||[]
    const prevMonthSubs = prevSubs.filter(s => s.start_date && s.start_date.startsWith(prevM))
    const prevPitchRev = prevBks.reduce((a,b) => a+Number(b.amount), 0)
    const prevSubRev = prevMonthSubs.reduce((a,s) => a+Number(s.sub_amount||0), 0)
    const prevKitRev = prevMonthSubs.reduce((a,s) => a+Number(s.kit_amount||0), 0)
    const prevExp = prevExps.reduce((a,e) => a+Number(e.amount), 0)
    setLastStats({ pitchRev:prevPitchRev, subRev:prevSubRev, kitRev:prevKitRev, exp:prevExp, month:prevM })

    // Top subscribers
    const sorted = [...subs].sort((a,b) => Number(b.total_amount||0)-Number(a.total_amount||0)).slice(0,5)
    setTopSubs(sorted)

    // Day of week breakdown (0=Sun..6=Sat, display Sat-Sun Arabic style)
    const dowCount = [0,0,0,0,0,0,0] // Sun Mon Tue Wed Thu Fri Sat
    bks.forEach(b => { if(b.date) { const d = new Date(b.date).getDay(); dowCount[d]++ } })
    setDowData(dowCount)

    // Pitch utilization - available hours per month = days * 8 hours / 2hr slots = days * 4 slots * 2 pitches
    const daysInMonth = new Date(py, pm, 0).getDate()
    const availableSlots = daysInMonth * 4 * 2 // 4 two-hour slots per night, 2 pitches
    const bookedSlots = bks.length
    setPitchUtil({ rate: Math.round((bookedSlots/availableSlots)*100), bookedHours: bookedSlots*2, availableHours: availableSlots*2 })

    // Expiring soon - next 14 days
    const soon = subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d !== null && d >= 0 && d <= 14 }).sort((a,b) => daysBetween(TODAY,a.end_date)-daysBetween(TODAY,b.end_date))
    setExpiringSoon(soon)

    // Pending approvals - all types
    const [pBk, pEx, pSl, pSub] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('sales').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
    ])

    const allPending = [
      ...(pSub.data||[]).map(r => ({...r, _type:'subscriber', _label:'اشتراك جديد', _amount:r.total_amount, _desc:r.name, _by:r.created_by, _meta:`${r.payment_method}${r.guardian_phone?' · '+r.guardian_phone:''}`})),
      ...(pBk.data||[]).map(r => ({...r, _type:'booking', _label:'حجز ملعب', _amount:r.amount, _desc:r.booker_name, _by:r.created_by, _meta:`${r.pitch==='small'?'ملعب صغير':'ملعب كبير'} · ${r.date} · ${r.time} · ${r.payment_method}`})),
      ...(pSl.data||[]).map(r => ({...r, _type:'sale', _label:'بيع مستلزمات', _amount:r.total, _desc:r.item, _by:r.created_by, _meta:`${r.qty} قطعة · ${r.payment_method}`})),
      ...(pEx.data||[]).map(r => ({...r, _type:'expense', _label:'مصروف', _amount:r.amount, _desc:r.description, _by:r.submitted_by, _meta:`${r.category} · ${r.date} · ${r.payment_method}`})),
    ].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
    setPending(allPending)

    // Archive
    const [aBk, aEx, aSl, aSub] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).neq('status','pending').order('created_at',{ascending:false}).limit(10),
      supabase.from('expenses').select('*').eq('branch', branch).neq('status','pending').order('approved_at',{ascending:false}).limit(10),
      supabase.from('sales').select('*').eq('branch', branch).neq('status','pending').order('created_at',{ascending:false}).limit(10),
      supabase.from('subscribers').select('*').eq('branch', branch).neq('status','pending').order('created_at',{ascending:false}).limit(10),
    ])
    const allArchive = [
      ...(aSub.data||[]).map(r => ({...r, _type:'subscriber', _label:'اشتراك', _amount:r.total_amount, _desc:r.name, _meta:r.payment_method})),
      ...(aBk.data||[]).map(r => ({...r, _type:'booking', _label:'حجز ملعب', _amount:r.amount, _desc:r.booker_name, _meta:`${r.date} · ${r.payment_method}`})),
      ...(aSl.data||[]).map(r => ({...r, _type:'sale', _label:'بيع', _amount:r.total, _desc:r.item, _meta:r.payment_method})),
      ...(aEx.data||[]).map(r => ({...r, _type:'expense', _label:'مصروف', _amount:r.amount, _desc:r.description, _meta:`${r.category} · ${r.payment_method}`})),
    ].sort((a,b) => new Date(b.created_at||b.approved_at)-new Date(a.created_at||a.approved_at)).slice(0,20)
    setArchive(allArchive)
    setLoading(false)
  }

  useEffect(() => { load(month) }, [month, refresh, branch])

  async function approveItem(item) {
    const table = item._type==='subscriber'?'subscribers':item._type==='booking'?'bookings':item._type==='sale'?'sales':'expenses'
    const updateData = item._type==='expense'
      ? { status:'approved', approved_by:'المالك', approved_at:new Date().toISOString() }
      : { status:'approved' }
    await supabase.from(table).update(updateData).eq('id', item.id)
    toast('✅ تمت الموافقة','success'); load(month)
  }
  async function rejectItem(item) {
    const table = item._type==='subscriber'?'subscribers':item._type==='booking'?'bookings':item._type==='sale'?'sales':'expenses'
    const updateData = item._type==='expense'
      ? { status:'rejected', approved_by:'المالك', approved_at:new Date().toISOString() }
      : { status:'rejected' }
    await supabase.from(table).update(updateData).eq('id', item.id)
    toast('تم الرفض','error'); load(month)
  }

  const totalRev = stats.pitchRev + stats.subRev + stats.kitRev + stats.otherRev
  const profit = totalRev - stats.exp
  const revenueBreakdown = [
    { label:'اشتراكات', val:stats.subRev, color:'#CC1F1F', pct: totalRev>0?Math.round(stats.subRev/totalRev*100):0 },
    { label:'ملاعب', val:stats.pitchRev, color:'#2563eb', pct: totalRev>0?Math.round(stats.pitchRev/totalRev*100):0 },
    { label:'مستلزمات', val:stats.kitRev, color:'#16a34a', pct: totalRev>0?Math.round(stats.kitRev/totalRev*100):0 },
    { label:'أخرى', val:stats.otherRev, color:'#f59e0b', pct: totalRev>0?Math.round(stats.otherRev/totalRev*100):0 },
  ].filter(r => r.val > 0)

  const typeIcon = { subscriber:'👤', booking:'🏟️', sale:'🛍️', expense:'💸' }
  const typeColor = { subscriber:'badge-b', booking:'badge-r', sale:'badge-g', expense:'badge-o' }

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* MAIN KPIs */}
      <div className="kpi-grid">
        <div className="kpi kpi-accent kpi-full">
          <div className="kpi-label">صافي الربح</div>
          <div className={`kpi-val ${profit>=0?'kpi-val-g':'kpi-val-r'}`}>{(profit>=0?'+':'')+fmt(profit)} ر</div>
          <div className="kpi-sub">إيرادات {fmt(totalRev)} · مصاريف {fmt(stats.exp)}</div>
        </div>
        <div className="kpi"><div className="kpi-label">الاشتراكات</div><div className="kpi-val kpi-val-g">{fmt(stats.subRev)} ر</div><div className="kpi-sub">{stats.subsCount} مشترك جديد</div></div>
        <div className="kpi"><div className="kpi-label">الملاعب</div><div className="kpi-val kpi-val-g">{fmt(stats.pitchRev)} ر</div><div className="kpi-sub">{stats.bookingCount} حجز</div></div>
        <div className="kpi"><div className="kpi-label">المستلزمات</div><div className="kpi-val kpi-val-g">{fmt(stats.kitRev)} ر</div></div>
        <div className="kpi"><div className="kpi-label">المصاريف</div><div className="kpi-val kpi-val-r">{fmt(stats.exp)} ر</div></div>
      </div>

      {/* REVENUE BREAKDOWN DONUT */}
      {revenueBreakdown.length > 0 && (
        <div className="card">
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--t2)' }}>توزيع الإيرادات</div>
          <div className="donut-wrap">
            <div style={{ width:120, height:120, flexShrink:0 }}>
              <DonutChart labels={revenueBreakdown.map(r=>r.label)} vals={revenueBreakdown.map(r=>r.val)} colors={revenueBreakdown.map(r=>r.color)} />
            </div>
            <div className="donut-legend">
              {revenueBreakdown.map(r => (
                <div key={r.label} className="donut-row">
                  <div className="donut-left"><span className="donut-dot" style={{ background:r.color }}/>{r.label}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, color:'var(--t3)' }}>{r.pct}%</span>
                    <span className="donut-val">{fmt(r.val)} ر</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PENDING APPROVALS */}
      {pending.length > 0 && (
        <div style={{ background:'var(--orange-l)', border:'1px solid #fbbf24', borderRadius:'var(--r)', marginBottom:'.75rem', overflow:'hidden' }}>
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid #fde68a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--orange)' }}>⏳ بانتظار الموافقة ({pending.length})</span>
          </div>
          {pending.map(item => (
            <div key={item.id} style={{ padding:'.75rem 1rem', borderBottom:'1px solid #fde68a' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16 }}>{typeIcon[item._type]}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{item._desc}</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{item._meta}</div>
                    {item._by && <div style={{ fontSize:10, color:'var(--t3)' }}>بواسطة: {item._by}</div>}
                  </div>
                </div>
                <div style={{ textAlign:'left', flexShrink:0 }}>
                  <span className={`badge ${typeColor[item._type]}`} style={{ fontSize:10, marginBottom:4, display:'block' }}>{item._label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{fmt(item._amount)} ر</span>
                </div>
              </div>
              {item.receipt_url && <a href={item.receipt_url} target="_blank" rel="noreferrer" className="receipt-link" style={{ marginBottom:'.5rem', display:'inline-block' }}>📎 إيصال</a>}
              <div style={{ display:'flex', gap:.5+'rem' }}>
                <button className="btn-approve" style={{ flex:1, padding:'.5rem', fontSize:12 }} onClick={() => approveItem(item)}>✓ موافقة</button>
                <button className="btn-reject" style={{ flex:1, padding:'.5rem', fontSize:12 }} onClick={() => rejectItem(item)}>✕ رفض</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REVENUE COMPARISON */}
      {lastStats.month && (
        <div className="card">
          <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>
            مقارنة بالشهر السابق ({MONTHS.find(m=>m.value===lastStats.month)?.label||lastStats.month})
          </div>
          {[
            { label:'الملاعب', cur:stats.pitchRev, prev:lastStats.pitchRev, color:'var(--blue)' },
            { label:'الاشتراكات', cur:stats.subRev, prev:lastStats.subRev, color:'var(--red)' },
            { label:'المستلزمات', cur:stats.kitRev, prev:lastStats.kitRev, color:'var(--green)' },
            { label:'المصاريف', cur:stats.exp, prev:lastStats.exp, color:'var(--orange)' },
          ].map(r => {
            const diff = r.cur - r.prev
            const pct = r.prev > 0 ? Math.round((diff/r.prev)*100) : null
            return (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.6rem 1rem', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:3, height:24, background:r.color, borderRadius:2 }}/>
                  <span style={{ fontSize:12, color:'var(--t2)', fontWeight:500 }}>{r.label}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>{fmt(r.prev)} ر</span>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>←</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{fmt(r.cur)} ر</span>
                  {pct !== null && <span style={{ fontSize:10, fontWeight:700, color: diff>=0?'var(--green)':'var(--red)', background: diff>=0?'var(--green-l)':'var(--red-l)', padding:'2px 6px', borderRadius:10 }}>{diff>=0?'+':''}{pct}%</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PITCH UTILIZATION */}
      <div className="card">
        <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>
          إشغال الملاعب
        </div>
        <div style={{ padding:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem' }}>
            <span style={{ fontSize:13, color:'var(--t2)' }}>{pitchUtil.bookedHours} ساعة محجوزة من أصل {pitchUtil.availableHours}</span>
            <span style={{ fontSize:18, fontWeight:700, color: pitchUtil.rate>=60?'var(--green)':pitchUtil.rate>=30?'var(--yellow)':'var(--red)' }}>{pitchUtil.rate}%</span>
          </div>
          <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:pitchUtil.rate+'%', background: pitchUtil.rate>=60?'var(--green)':pitchUtil.rate>=30?'var(--yellow)':'var(--red)', borderRadius:4, transition:'width .5s' }}/>
          </div>
          <div style={{ fontSize:10, color:'var(--t3)', marginTop:4 }}>
            {pitchUtil.rate < 30 ? '⚠️ إشغال منخفض' : pitchUtil.rate < 60 ? '📊 إشغال متوسط' : '✅ إشغال جيد'} · 8 ساعات/ليلة · ملعبين
          </div>
        </div>
      </div>

      {/* DOW CHART + TOP SUBS */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'.75rem' }}>
        {/* DAY OF WEEK BOOKINGS */}
        <div className="card" style={{ margin:0 }}>
          <div style={{ padding:'.6rem .875rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>حجوزات/يوم الأسبوع</div>
          <div style={{ padding:'.75rem .5rem' }}>
            <BarChart
              labels={['أح','إث','ثل','أر','خم','جم','سب']}
              vals={dowData}
              color='#2563eb'
              height={100}
            />
          </div>
        </div>

        {/* TOP SUBSCRIBERS */}
        <div className="card" style={{ margin:0 }}>
          <div style={{ padding:'.6rem .875rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>أعلى اشتراكات</div>
          {topSubs.length === 0 ? <div className="empty" style={{ padding:'1rem' }}>لا بيانات</div> :
            topSubs.map((s,i) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.5rem .875rem', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--t3)', width:14 }}>{i+1}</span>
                  <span style={{ fontSize:11, color:'var(--t1)', fontWeight:500 }}>{s.name.split(' ').slice(0,2).join(' ')}</span>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--green)' }}>{fmt(s.total_amount)} ر</span>
              </div>
            ))}
        </div>
      </div>

      {/* EXPIRING SOON */}
      {expiringSoon.length > 0 && (
        <div className="card" style={{ borderColor:'var(--orange)' }}>
          <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--orange)' }}>⚠️ اشتراكات تنتهي قريباً</span>
            <div style={{ display:'flex', gap:6 }}>
              <span className="badge badge-r" style={{ fontSize:10 }}>هذا الأسبوع: {expiringSoon.filter(s=>daysBetween(TODAY,s.end_date)<=7).length}</span>
              <span className="badge badge-o" style={{ fontSize:10 }}>الأسبوع القادم: {expiringSoon.filter(s=>{const d=daysBetween(TODAY,s.end_date);return d>7&&d<=14}).length}</span>
            </div>
          </div>
          {expiringSoon.map(s => {
            const days = daysBetween(TODAY, s.end_date)
            return (
              <div key={s.id} className="list-row">
                <div className="list-left">
                  <div className="list-av list-av-yellow">{s.name[0]}</div>
                  <div>
                    <div className="list-name">{s.name}</div>
                    <div className="list-sub">ينتهي {s.end_date}{s.guardian_phone?` · 📞 ${s.guardian_phone}`:''}</div>
                  </div>
                </div>
                <span className={`badge ${days<=3?'badge-r':days<=7?'badge-o':'badge-y'}`} style={{ fontSize:10 }}>{days} أيام</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ARCHIVE */}
      <div className="sec">الأرشيف</div>
      <div className="card">
        {loading ? <div className="loading">جاري التحميل...</div> :
          archive.length === 0 ? <div className="empty"><div className="empty-icon">📁</div>الأرشيف فارغ</div> :
            archive.map((item,i) => (
              <div key={i} className="list-row">
                <div className="list-left">
                  <div style={{ fontSize:18, width:36, textAlign:'center', flexShrink:0 }}>{typeIcon[item._type]}</div>
                  <div>
                    <div className="list-name">{item._desc}</div>
                    <div className="list-sub">{item._label} · {item._meta}</div>
                    {item.receipt_url && <a href={item.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                  </div>
                </div>
                <div className="list-right">
                  <span className={`badge ${item.status==='approved'?'badge-g':'badge-r'}`}>{fmt(item._amount)} ر</span>
                  <span style={{ fontSize:9, color:'var(--t3)', marginTop:2 }}>{item.status==='approved'?'معتمد':'مرفوض'}</span>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}

// ============ OWNER ACADEMY ============
function OwnerAcademy({ toast, refresh, branch }) {
  const [tab, setTab] = useState('subs')
  const [subs, setSubs] = useState([])
  const [inventory, setInventory] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, inv] = await Promise.all([
        supabase.from('subscribers').select('*').eq('branch', branch).eq('status','approved').order('created_at',{ascending:false}),
        supabase.from('inventory').select('*').order('name'),
      ])
      setSubs(s.data||[]); setInventory(inv.data||[]); setLoading(false)
    }
    load()
  }, [refresh, branch])

  const expiringSoon = subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d>=0 && d<=7 })
  const expired = subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d<0 })
  let filtered = search ? subs.filter(s => s.name.includes(search)) : subs
  if (filter==='expiring') filtered = filtered.filter(s => expiringSoon.find(e=>e.id===s.id))
  if (filter==='expired') filtered = filtered.filter(s => expired.find(e=>e.id===s.id))
  if (filter==='bus') filtered = filtered.filter(s => s.has_bus)
  if (filter==='kit') filtered = filtered.filter(s => s.has_kit)

  const totalSubRev = subs.reduce((a,s) => a+Number(s.sub_amount||0), 0)
  const busCount = subs.filter(s => s.has_bus).length
  const kitCount = subs.filter(s => s.has_kit).length
  const kitRev = subs.reduce((a,s) => a+Number(s.kit_amount||0), 0)
  const busRev = subs.reduce((a,s) => a+Number(s.bus_amount||0), 0)

  return (
    <div className="page">
      <div className="inner-tabs">
        <button className={`inner-tab ${tab==='subs'?'inner-tab-active':''}`} onClick={() => setTab('subs')}>المشتركون</button>
        <button className={`inner-tab ${tab==='other'?'inner-tab-active':''}`} onClick={() => setTab('other')}>الباص والمستلزمات</button>
      </div>

      {tab==='subs' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">إجمالي المشتركين</div><div className="kpi-val">{subs.length}</div><div className="kpi-sub">نشط: {subs.length-expired.length}</div></div>
            <div className="kpi"><div className="kpi-label">إيرادات الاشتراكات</div><div className="kpi-val kpi-val-g">{fmt(totalSubRev)} ر</div></div>
            {expiringSoon.length>0 && <div className="kpi kpi-full" style={{ borderColor:'var(--orange)', background:'var(--orange-l)' }}><div className="kpi-label" style={{ color:'var(--orange)' }}>ينتهي قريباً</div><div className="kpi-val" style={{ color:'var(--orange)' }}>{expiringSoon.length} مشترك</div><div className="kpi-sub" style={{ color:'var(--orange)' }}>خلال 7 أيام</div></div>}
          </div>
          {/* CATEGORIES PLACEHOLDER */}
          <div className="info-box info-blue" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📂</span>
            <span>تصنيف الفئات العمرية سيظهر هنا بعد استلام البيانات من مدير الشؤون</span>
          </div>
          <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', marginBottom:'.75rem', scrollbarWidth:'none' }}>
            {[['all','الكل'],['expiring','ينتهي قريباً'],['expired','منتهي'],['bus','الباص'],['kit','اشترى طقم']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid', borderColor:filter===v?'var(--red)':'var(--border)', background:filter===v?'var(--red-l)':'var(--surface)', color:filter===v?'var(--red)':'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:filter===v?600:400 }}>{l}</button>
            ))}
          </div>
          <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
            <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
            {loading ? <div className="loading">جاري التحميل...</div> : filtered.length===0 ? <div className="empty"><div className="empty-icon">👥</div>لا يوجد مشتركون</div> :
              filtered.slice(0,50).map((s,i) => {
                const st = subStatus(s.end_date)
                return (
                  <div key={s.id} className="list-row">
                    <div className="list-left">
                      <div className={`list-av ${avColors[i%4]}`}>{s.name[0]}</div>
                      <div style={{ minWidth:0 }}>
                        <div className="list-name">{s.name}</div>
                        <div className="list-sub">{s.sub_amount>0?`${fmt(s.sub_amount)} ر`:''}{s.has_bus?' · باص':''}{s.has_kit?' · طقم':''}{s.end_date?` · حتى ${s.end_date}`:''}{s.guardian_phone?` · ${s.guardian_phone}`:''}</div>
                      </div>
                    </div>
                    <div className="list-right">
                      <div className="list-amt">{fmt(s.total_amount||s.sub_amount)} ر</div>
                      <span className={`badge ${st.cls}`} style={{ fontSize:9, marginTop:3 }}>{st.label}</span>
                    </div>
                  </div>
                )
              })}
            {filtered.length>50 && <div className="empty">+{filtered.length-50} آخرين</div>}
          </div>
        </>
      )}

      {tab==='other' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">مستخدمو الباص</div><div className="kpi-val">{busCount}</div><div className="kpi-sub">من {subs.length} مشترك</div></div>
            <div className="kpi"><div className="kpi-label">المبلغ المحصل للباص</div><div className="kpi-val">{fmt(busRev)} ر</div><div className="kpi-sub" style={{ color:'var(--orange)', fontSize:10 }}>يُحوَّل لأصحاب الباص</div></div>
            <div className="kpi"><div className="kpi-label">اشتروا طقم</div><div className="kpi-val">{kitCount} مشترك</div></div>
            <div className="kpi"><div className="kpi-label">إيراد الطقم</div><div className="kpi-val kpi-val-g">{fmt(kitRev)} ر</div></div>
          </div>
          <div className="sec">المخزون</div>
          <div className="store-grid">
            {inventory.map(item => (
              <div key={item.id} className="store-card">
                <div className="store-icon-wrap">{item.icon||'📦'}</div>
                <div className="store-info">
                  <div className="store-name">{item.name}</div>
                  <div className="store-price">{item.price} ر</div>
                  <div className="store-stock"><span style={{ color:'var(--green)' }}>متبقي: {item.stock}</span> · <span style={{ color:'var(--t3)' }}>مباع: {item.sold}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============ OWNER FIELDS ============
function OwnerFields({ toast, refresh, branch }) {
  const [tab, setTab] = useState('stats')
  const [bookings, setBookings] = useState([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [month, setMonth] = useState('2026-09')

  useEffect(() => {
    supabase.from('bookings').select('*').eq('branch', branch).eq('status','approved').order('date',{ascending:false}).then(({data}) => setBookings(data||[]))
  }, [refresh, branch])

  const monthBks = bookings.filter(b => b.date?.startsWith(month))
  const smallRev = monthBks.filter(b => b.pitch==='small').reduce((a,b) => a+Number(b.amount), 0)
  const bigRev = monthBks.filter(b => b.pitch==='big').reduce((a,b) => a+Number(b.amount), 0)
  const smallCount = monthBks.filter(b => b.pitch==='small').length
  const bigCount = monthBks.filter(b => b.pitch==='big').length
  const waterCount = monthBks.filter(b => b.water).length
  const selectedBks = selectedDate ? bookings.filter(b => b.date===selectedDate) : []
  const selectedRev = selectedBks.reduce((a,b) => a+Number(b.amount), 0)

  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const dayNames = ['ح','ن','ث','ر','خ','ج','س']

  function renderCal() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate()
    const daysInPrev = new Date(calYear, calMonth, 0).getDate()
    const startDay = (firstDay+1)%7
    const cells = []
    for (let i=0; i<startDay; i++) cells.push({ day:daysInPrev-startDay+i+1, other:true })
    for (let d=1; d<=daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      cells.push({ day:d, dateStr, isToday:dateStr===TODAY, isSelected:dateStr===selectedDate, bookings:bookings.filter(b=>b.date===dateStr) })
    }
    const remaining = 42-cells.length
    for (let i=1; i<=remaining; i++) cells.push({ day:i, other:true })
    return cells
  }

  return (
    <div className="page">
      <div className="inner-tabs">
        <button className={`inner-tab ${tab==='stats'?'inner-tab-active':''}`} onClick={() => setTab('stats')}>الإحصائيات</button>
        <button className={`inner-tab ${tab==='cal'?'inner-tab-active':''}`} onClick={() => setTab('cal')}>التقويم</button>
      </div>

      {tab==='stats' && (
        <>
          <div className="month-bar">
            <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="kpi-grid">
            <div className="kpi kpi-accent kpi-full">
              <div className="kpi-label">إجمالي إيرادات الملاعب</div>
              <div className="kpi-val">{fmt(smallRev+bigRev+waterCount*20)} ر</div>
              <div className="kpi-sub">{monthBks.length} حجز · {waterCount} صندوق مياه</div>
            </div>
          </div>
          <div className="field-card">
            <div className="field-name">ملعب صغير · 250 ر / 2 ساعات</div>
            <div className="field-status">8 مساءً – 4 صباحاً</div>
            <div className="field-stats">
              <div><div className="fs-label">الإيراد</div><div className="fs-val">{fmt(smallRev)} ر</div></div>
              <div><div className="fs-label">الحجوزات</div><div className="fs-val">{smallCount}</div></div>
              <div><div className="fs-label">متوسط/حجز</div><div className="fs-val">{smallCount>0?fmt(Math.round(smallRev/smallCount)):0} ر</div></div>
            </div>
          </div>
          <div className="field-card">
            <div className="field-name">ملعب كبير · 300 ر / 2 ساعات</div>
            <div className="field-status">8 مساءً – 4 صباحاً</div>
            <div className="field-stats">
              <div><div className="fs-label">الإيراد</div><div className="fs-val">{fmt(bigRev)} ر</div></div>
              <div><div className="fs-label">الحجوزات</div><div className="fs-val">{bigCount}</div></div>
              <div><div className="fs-label">متوسط/حجز</div><div className="fs-val">{bigCount>0?fmt(Math.round(bigRev/bigCount)):0} ر</div></div>
            </div>
          </div>
        </>
      )}

      {tab==='cal' && (
        <>
          <div className="summary-strip">
            <div className="strip-item"><div className="strip-label">اليوم المحدد</div><div className="strip-val">{selectedDate||'—'}</div></div>
            <div className="strip-item"><div className="strip-label">الحجوزات</div><div className="strip-val">{selectedBks.length}</div></div>
            <div className="strip-item"><div className="strip-label">الإيراد</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(selectedRev)} ر</div></div>
          </div>
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="cal-header">
              <button className="cal-nav" onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }}>›</button>
              <span className="cal-title">{monthNames[calMonth]} {calYear}</span>
              <button className="cal-nav" onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }}>‹</button>
            </div>
            <div className="cal-grid">
              {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
              {renderCal().map((cell,i) => (
                <div key={i} className={`cal-cell ${cell.other?'cal-other':''} ${cell.isToday?'cal-today':''} ${cell.isSelected?'cal-today':''}`} onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}>
                  <div className="cal-date">{cell.day}</div>
                  {(cell.bookings||[]).map((b,j) => <div key={j} className={`cal-booking ${b.pitch==='big'?'cal-booking-big':''}`}>{b.time} {b.pitch==='small'?'ص':'ك'}</div>)}
                </div>
              ))}
            </div>
          </div>
          <div className="sec">حجوزات {selectedDate||'اختر يوماً'}</div>
          <div className="card">
            {!selectedDate ? <div className="empty"><div className="empty-icon">📅</div>اختر يوماً من التقويم</div> :
              selectedBks.length===0 ? <div className="empty"><div className="empty-icon">📅</div>لا يوجد حجوزات</div> :
                selectedBks.map(b => (
                  <div key={b.id} className="list-row">
                    <div className="list-left">
                      <div className={`list-av ${b.pitch==='small'?'list-av-blue':'list-av-red'}`}>{b.pitch==='small'?'ص':'ك'}</div>
                      <div>
                        <div className="list-name">{b.booker_name}</div>
                        <div className="list-sub">{b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · {b.time} · {b.payment_method}{b.water?' · 💧':''}</div>
                        {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                      </div>
                    </div>
                    <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ر</span>
                  </div>
                ))}
          </div>

          {/* BOOKING SEARCH */}
          <div className="sec">بحث في الحجوزات</div>
          <BookingSearch bookings={bookings} />
        </>
      )}
    </div>
  )
}

function BookingSearch({ bookings }) {
  const [q, setQ] = useState('')
  const results = q.length > 1 ? bookings.filter(b => b.booker_name?.includes(q)) : []
  return (
    <>
      <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
        <input className="search-input" placeholder="ابحث باسم الحاجز..." value={q} onChange={e => setQ(e.target.value)}/>
      </div>
      <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)', marginBottom:'.75rem' }}>
        {q.length < 2 ? <div className="empty" style={{ padding:'1rem' }}>اكتب اسم الحاجز للبحث</div> :
          results.length === 0 ? <div className="empty" style={{ padding:'1rem' }}>لا توجد نتائج</div> :
            results.map(b => (
              <div key={b.id} className="list-row">
                <div className="list-left">
                  <div className={`list-av ${b.pitch==='small'?'list-av-blue':'list-av-red'}`}>{b.pitch==='small'?'ص':'ك'}</div>
                  <div>
                    <div className="list-name">{b.booker_name}</div>
                    <div className="list-sub">{b.date} · {b.time} · {b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · {b.payment_method}</div>
                  </div>
                </div>
                <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ر</span>
              </div>
            ))}
      </div>
    </>
  )
}

// ============ OWNER EXPENSES ============
function OwnerExpenses({ toast, refresh, branch }) {
  const [tab, setTab] = useState('monthly')
  const [month, setMonth] = useState('2026-09')
  const [expenses, setExpenses] = useState([])
  const [pnlRows, setPnlRows] = useState([])
  const [loading, setLoading] = useState(true)

  async function load(m) {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').eq('branch', branch).eq('status','approved').gte('date', m+'-01').lte('date', monthEnd(m)).order('date',{ascending:false})
    setExpenses(data||[]); setLoading(false)
  }

  async function loadPnl() {
    setLoading(true)
    const dataMonths = ['2026-10','2026-09','2026-08','2026-07','2026-06']
    const rows = await Promise.all(dataMonths.map(async m => {
      const start = m+'-01', end = monthEnd(m)
      const [bkRes, exRes, subRes, slRes] = await Promise.all([
        supabase.from('bookings').select('amount').eq('branch',branch).eq('status','approved').gte('date',start).lte('date',end),
        supabase.from('expenses').select('amount,category').eq('branch',branch).eq('status','approved').gte('date',start).lte('date',end),
        supabase.from('subscribers').select('sub_amount,kit_amount,other_amount,start_date').eq('branch',branch).eq('status','approved'),
        supabase.from('sales').select('total,created_at').eq('branch',branch).eq('status','approved').gte('created_at',start+'T00:00:00').lte('created_at',end+'T23:59:59'),
      ])
      const pitchRev = (bkRes.data||[]).reduce((a,b)=>a+Number(b.amount),0)
      const mSubs = (subRes.data||[]).filter(s=>s.start_date?.startsWith(m))
      const subRev = mSubs.reduce((a,s)=>a+Number(s.sub_amount||0),0)
      const kitRev = mSubs.reduce((a,s)=>a+Number(s.kit_amount||0),0)+(slRes.data||[]).reduce((a,s)=>a+Number(s.total),0)
      const allExp = (exRes.data||[])
      const operExp = allExp.filter(e=>e.category!=='قرض').reduce((a,e)=>a+Number(e.amount),0)
      const loanExp = allExp.filter(e=>e.category==='قرض').reduce((a,e)=>a+Number(e.amount),0)
      const totalRev = pitchRev+subRev+kitRev
      return { month:m, pitchRev, subRev, kitRev, operExp, loanExp, totalRev, net:totalRev-operExp-loanExp, netExLoan:totalRev-operExp }
    }))
    setPnlRows(rows); setLoading(false)
  }

  useEffect(() => { if(tab==='monthly') load(month); else loadPnl() }, [month, refresh, branch, tab])

  const catTotals = {}
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0)+Number(e.amount) })
  const labels = Object.keys(catTotals)
  const vals = Object.values(catTotals)
  const colors = labels.map(l => EXP_COLORS[EXP_CATS.indexOf(l)]||'#6b7280')
  const total = vals.reduce((a,v) => a+v, 0)

  return (
    <div className="page">
      <div className="inner-tabs">
        <button className={`inner-tab ${tab==='monthly'?'inner-tab-active':''}`} onClick={() => setTab('monthly')}>المصاريف الشهرية</button>
        <button className={`inner-tab ${tab==='pnl'?'inner-tab-active':''}`} onClick={() => setTab('pnl')}>ملخص P&L</button>
      </div>

      {tab==='monthly' && (
        <>
          <div className="month-bar">
            <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="kpi-grid">
            <div className="kpi kpi-full"><div className="kpi-label">إجمالي المصاريف المعتمدة</div><div className="kpi-val kpi-val-r">{fmt(total)} ر</div></div>
          </div>
          {!loading && labels.length>0 && (
            <div className="card">
              <div className="donut-wrap">
                <div style={{ width:120, height:120, flexShrink:0 }}>
                  <DonutChart labels={labels} vals={vals} colors={colors}/>
                </div>
                <div className="donut-legend">
                  {labels.map((l,i) => (
                    <div key={l} className="donut-row">
                      <div className="donut-left"><span className="donut-dot" style={{ background:colors[i] }}/>{l}</div>
                      <span className="donut-val">{fmt(vals[i])} ر</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="sec">تفصيل المصاريف</div>
          <div className="card">
            {loading ? <div className="loading">جاري التحميل...</div> : expenses.length===0 ? <div className="empty"><div className="empty-icon">💸</div>لا يوجد مصاريف</div> :
              expenses.map(e => (
                <div key={e.id} className="list-row">
                  <div className="list-left">
                    <div className="list-av" style={{ background:(EXP_COLORS[EXP_CATS.indexOf(e.category)]||'#6b7280')+'22', color:EXP_COLORS[EXP_CATS.indexOf(e.category)]||'#6b7280', fontSize:10, fontWeight:700 }}>{e.category[0]}</div>
                    <div>
                      <div className="list-name">{e.description}</div>
                      <div className="list-sub">{e.category} · {e.date} · {e.payment_method}</div>
                      {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                    </div>
                  </div>
                  <span className="badge badge-r">{fmt(e.amount)} ر</span>
                </div>
              ))}
          </div>
        </>
      )}

      {tab==='pnl' && (
        <>
          <div className="info-box info-blue">الأرقام تعكس الإيرادات والمصاريف الفعلية لكل شهر. القرض مفصول عن المصاريف التشغيلية.</div>
          {loading ? <div className="loading">جاري التحميل...</div> :
            pnlRows.map(r => {
              const mLabel = MONTHS.find(m=>m.value===r.month)?.label||r.month
              return (
                <div key={r.month} className="card" style={{ marginBottom:'.75rem' }}>
                  <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{mLabel}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <span className={`badge ${r.netExLoan>=0?'badge-g':'badge-r'}`} style={{ fontSize:10 }}>بدون قرض: {r.netExLoan>=0?'+':''}{fmt(r.netExLoan)} ر</span>
                      <span className={`badge ${r.net>=0?'badge-g':'badge-r'}`} style={{ fontSize:10 }}>الصافي: {r.net>=0?'+':''}{fmt(r.net)} ر</span>
                    </div>
                  </div>
                  <div className="pnl-row"><span className="pnl-label">إيراد الملاعب</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.pitchRev)} ر</span></div>
                  <div className="pnl-row"><span className="pnl-label">إيراد الاشتراكات</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.subRev)} ر</span></div>
                  <div className="pnl-row"><span className="pnl-label">المستلزمات</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.kitRev)} ر</span></div>
                  <div className="pnl-row" style={{ background:'var(--surface2)' }}><span className="pnl-label" style={{ fontWeight:600 }}>إجمالي الإيرادات</span><span className="pnl-val" style={{ color:'var(--green)', fontWeight:700 }}>{fmt(r.totalRev)} ر</span></div>
                  <div className="pnl-row"><span className="pnl-label">المصاريف التشغيلية</span><span className="pnl-val" style={{ color:'var(--red)' }}>{fmt(r.operExp)} ر</span></div>
                  {r.loanExp > 0 && <div className="pnl-row"><span className="pnl-label">القرض</span><span className="pnl-val" style={{ color:'var(--orange)' }}>{fmt(r.loanExp)} ر</span></div>}
                  <div className="pnl-row" style={{ background:'var(--black)' }}>
                    <span style={{ color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600 }}>صافي الربح</span>
                    <span style={{ color: r.net>=0?'var(--green)':'var(--red)', fontSize:15, fontWeight:700 }}>{r.net>=0?'+':''}{fmt(r.net)} ر</span>
                  </div>
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}

// ============ STAFF SUBS ============
function StaffSubs({ toast, refresh, branch }) {
  const [subs, setSubs] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [renewModal, setRenewModal] = useState(false)
  const [renewSub, setRenewSub] = useState(null)
  const [form, setForm] = useState({ name:'', type:'individual', pkg:300, familyCount:2, payment:'نقدي', receiptUrl:'', startDate:TODAY, endDate:'', phone:'' })
  const [renewForm, setRenewForm] = useState({ pkg:300, payment:'نقدي', receiptUrl:'', startDate:TODAY, endDate:'' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const { data } = await supabase.from('subscribers').select('*').eq('branch', branch).order('created_at',{ascending:false})
    setSubs(data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [refresh, branch])

  function calcEnd(start, pkg) {
    if (!start) return ''
    const d = new Date(start)
    d.setMonth(d.getMonth()+(pkg===700||pkg===900?3:1))
    return d.toISOString().slice(0,10)
  }

  async function submit() {
    if (!form.name.trim()) { alert('أدخل الاسم'); return }
    if (form.payment!=='نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const count = form.type==='family'?form.familyCount:1
    const total = form.pkg*count
    const { error } = await supabase.from('subscribers').insert({
      name:form.name, type:form.type, package:total,
      sub_amount:total, bus_amount:0, kit_amount:0, other_amount:0, total_amount:total,
      payment_method:form.payment, has_receipt:form.payment!=='نقدي',
      receipt_url:form.receiptUrl||null, has_bus:false, has_kit:false,
      start_date:form.startDate||null, end_date:form.endDate||null,
      guardian_phone:form.phone||null,
      created_by:ROLES[branch==='jazan'?'admin_jazan':'admin_riyadh']?.label,
      branch, status:'pending'
    })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ','error'); return }
    toast('✅ تم الحفظ بنجاح','success')
    setModal(false)
    setForm({ name:'', type:'individual', pkg:300, familyCount:2, payment:'نقدي', receiptUrl:'', startDate:TODAY, endDate:calcEnd(TODAY,300), phone:'' })
    load()
  }

  async function renew() {
    if (!renewSub) return
    if (renewForm.payment!=='نقدي' && !renewForm.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const { error } = await supabase.from('subscribers').update({
      package:renewForm.pkg, sub_amount:renewForm.pkg,
      total_amount:renewForm.pkg+Number(renewSub.bus_amount||0)+Number(renewSub.kit_amount||0),
      payment_method:renewForm.payment, has_receipt:renewForm.payment!=='نقدي',
      receipt_url:renewForm.receiptUrl||null,
      start_date:renewForm.startDate, end_date:renewForm.endDate, status:'pending'
    }).eq('id', renewSub.id)
    setSubmitting(false)
    if (error) { toast('خطأ في التجديد','error'); return }
    toast('✅ تم تجديد الاشتراك بنجاح','success')
    setRenewModal(false); setRenewSub(null); load()
  }

  const approvedSubs = subs.filter(s => s.status==='approved')
  const pendingSubs = subs.filter(s => s.status==='pending')
  const expiringSoon = approvedSubs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d>=0 && d<=7 })
  const expired = approvedSubs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d<0 })
  let filtered = search ? approvedSubs.filter(s => s.name.includes(search)) : approvedSubs
  if (filter==='expiring') filtered = filtered.filter(s => expiringSoon.find(e=>e.id===s.id))
  if (filter==='expired') filtered = filtered.filter(s => expired.find(e=>e.id===s.id))
  if (filter==='bus') filtered = filtered.filter(s => s.has_bus)
  if (filter==='kit') filtered = filtered.filter(s => s.has_kit)

  const totalRev = approvedSubs.reduce((a,s) => a+Number(s.sub_amount||0), 0)

  useEffect(() => { setForm(f => ({...f, endDate:calcEnd(f.startDate, f.pkg)})) }, [])

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">المشتركون</div><div className="strip-val">{approvedSubs.length}</div></div>
        <div className="strip-item"><div className="strip-label">الإجمالي</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(totalRev)} ر</div></div>
        {pendingSubs.length>0 && <div className="strip-item"><div className="strip-label">معلق</div><div className="strip-val" style={{ color:'var(--orange)' }}>{pendingSubs.length}</div></div>}
        {expiringSoon.length>0 && <div className="strip-item"><div className="strip-label">ينتهي قريباً</div><div className="strip-val" style={{ color:'var(--orange)' }}>{expiringSoon.length}</div></div>}
      </div>

      {/* RENEWAL REMINDERS */}
      {expiringSoon.length>0 && (
        <div className="card" style={{ borderColor:'var(--orange)', marginBottom:'.75rem' }}>
          <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, color:'var(--orange)' }}>
            ⏰ يحتاجون تجديد قريباً ({expiringSoon.length})
          </div>
          {expiringSoon.map(s => {
            const days = daysBetween(TODAY, s.end_date)
            return (
              <div key={s.id} className="list-row">
                <div className="list-left">
                  <div className="list-av list-av-yellow">{s.name[0]}</div>
                  <div>
                    <div className="list-name">{s.name}</div>
                    <div className="list-sub">ينتهي {s.end_date}{s.guardian_phone ? ` · 📞 ${s.guardian_phone}` : ''}</div>
                  </div>
                </div>
                <div className="list-right">
                  <span className={`badge ${days<=3?'badge-r':'badge-o'}`} style={{ fontSize:10 }}>{days} أيام</span>
                  <button onClick={() => { setRenewSub(s); setRenewForm({ pkg:300, payment:'نقدي', receiptUrl:'', startDate:TODAY, endDate:calcEnd(TODAY,300) }); setRenewModal(true) }}
                    style={{ fontSize:10, background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:6, padding:'3px 8px', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', marginTop:3 }}>تجديد</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PENDING */}
      {pendingSubs.length>0 && (
        <>
          <div className="sec">معلق - بانتظار موافقة المالك</div>
          <div className="card">
            {pendingSubs.map((s,i) => (
              <div key={s.id} className="list-row">
                <div className="list-left">
                  <div className="list-av list-av-yellow">{s.name[0]}</div>
                  <div><div className="list-name">{s.name}</div><div className="list-sub">{fmt(s.total_amount)} ر · {s.payment_method}</div></div>
                </div>
                <span className="badge badge-o" style={{ fontSize:10 }}>معلق</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', marginBottom:'.75rem', scrollbarWidth:'none' }}>
        {[['all','الكل'],['expiring','ينتهي قريباً'],['expired','منتهي'],['bus','الباص'],['kit','اشترى طقم']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid', borderColor:filter===v?'var(--red)':'var(--border)', background:filter===v?'var(--red-l)':'var(--surface)', color:filter===v?'var(--red)':'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:filter===v?600:400 }}>{l}</button>
        ))}
      </div>
      <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
        <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
        {loading ? <div className="loading">جاري التحميل...</div> : filtered.length===0 ? <div className="empty"><div className="empty-icon">👥</div>لا يوجد مشتركون</div> :
          filtered.slice(0,50).map((s,i) => {
            const st = subStatus(s.end_date)
            return (
              <div key={s.id} className="list-row">
                <div className="list-left">
                  <div className={`list-av ${avColors[i%4]}`}>{s.name[0]}</div>
                  <div style={{ minWidth:0 }}>
                    <div className="list-name">{s.name}</div>
                    <div className="list-sub">{s.sub_amount>0?`${fmt(s.sub_amount)} ر`:''}{s.has_bus?' · باص':''}{s.has_kit?' · طقم':''}{s.guardian_phone?` · 📞 ${s.guardian_phone}`:''}</div>
                    <div className="list-sub">{s.end_date?`حتى ${s.end_date}`:''}</div>
                  </div>
                </div>
                <div className="list-right">
                  <div className="list-amt">{fmt(s.total_amount||s.sub_amount)} ر</div>
                  <div style={{ display:'flex', gap:4, marginTop:3 }}>
                    <span className={`badge ${st.cls}`} style={{ fontSize:9 }}>{st.label}</span>
                    {(st.cls==='badge-r'||st.cls==='badge-o') && (
                      <button onClick={() => { setRenewSub(s); setRenewForm({ pkg:300, payment:'نقدي', receiptUrl:'', startDate:TODAY, endDate:calcEnd(TODAY,300) }); setRenewModal(true) }}
                        style={{ fontSize:9, background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:5, padding:'2px 6px', color:'var(--green)', cursor:'pointer', fontFamily:'inherit' }}>تجديد</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        {filtered.length>50 && <div className="empty">+{filtered.length-50} آخرين</div>}
      </div>

      <button className="fab" onClick={() => setModal(true)}>👤</button>

      {/* RENEW MODAL */}
      <Modal open={renewModal} onClose={() => setRenewModal(false)} title={`تجديد: ${renewSub?.name||''}`}>
        <div className="form-group">
          <label className="form-label">الباقة الجديدة</label>
          <div className="pkg-grid">
            {[{v:300,l:'اشتراك فقط\n300 ر'},{v:400,l:'اشتراك + طقم\n400 ر'},{v:450,l:'اشتراك + باص\n450 ر'},{v:550,l:'اشتراك + طقم + باص\n550 ر'},{v:900,l:'3 أشهر\n900 ر'},{v:700,l:'3 أشهر مخفض\n700 ر'}].map(p => (
              <button key={p.v} className={`pkg-btn ${renewForm.pkg===p.v?'pkg-selected':''}`} onClick={() => setRenewForm(f=>({...f,pkg:p.v,endDate:calcEnd(f.startDate,p.v)}))} style={{ whiteSpace:'pre-line' }}>{p.l}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">تاريخ البداية</label><input className="form-input" type="date" value={renewForm.startDate} onChange={e => setRenewForm(f=>({...f,startDate:e.target.value,endDate:calcEnd(e.target.value,f.pkg)}))}/></div>
          <div className="form-group"><label className="form-label">تاريخ الانتهاء</label><input className="form-input" type="date" value={renewForm.endDate} onChange={e => setRenewForm(f=>({...f,endDate:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={renewForm.payment} onChange={v => setRenewForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
        {renewForm.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="subscribers" onUploaded={url => setRenewForm(f=>({...f,receiptUrl:url}))}/>}
        <div className="form-group"><label className="form-label">الإجمالي</label><input className="form-input" readOnly value={fmt(renewForm.pkg)+' ر'} style={{ fontWeight:700, color:'var(--green)' }}/></div>
        <button className="btn-primary" disabled={submitting} onClick={renew} style={{ background:'var(--green)' }}>{submitting?'جاري الحفظ...':'تجديد الاشتراك ✓'}</button>
        <button className="btn-secondary" onClick={() => setRenewModal(false)}>إلغاء</button>
      </Modal>

      {/* ADD MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title="إضافة مشترك جديد">
        <div className="form-group">
          <label className="form-label">نوع الاشتراك</label>
          <select className="form-select" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
            <option value="individual">فردي</option><option value="family">عائلي</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">الاسم</label><input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="اسم المشترك أو العائلة"/></div>
        {form.type==='family' && <div className="form-group"><label className="form-label">عدد اللاعبين</label><input className="form-input" type="number" min="2" max="10" value={form.familyCount} onChange={e => setForm(f=>({...f,familyCount:parseInt(e.target.value)||2}))}/></div>}
        <div className="form-group"><label className="form-label">رقم ولي الأمر</label><input className="form-input" type="tel" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="05XXXXXXXX"/></div>
        <div className="form-group">
          <label className="form-label">الباقة</label>
          <div className="pkg-grid">
            {[{v:300,l:'اشتراك فقط\n300 ر'},{v:400,l:'اشتراك + طقم\n400 ر'},{v:450,l:'اشتراك + باص\n450 ر'},{v:550,l:'اشتراك + طقم + باص\n550 ر'},{v:900,l:'3 أشهر\n900 ر'},{v:700,l:'3 أشهر مخفض\n700 ر'}].map(p => (
              <button key={p.v} className={`pkg-btn ${form.pkg===p.v?'pkg-selected':''}`} onClick={() => setForm(f=>({...f,pkg:p.v,endDate:calcEnd(f.startDate,p.v)}))} style={{ whiteSpace:'pre-line' }}>{p.l}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">تاريخ البداية</label><input className="form-input" type="date" value={form.startDate} onChange={e => setForm(f=>({...f,startDate:e.target.value,endDate:calcEnd(e.target.value,f.pkg)}))}/></div>
          <div className="form-group"><label className="form-label">تاريخ الانتهاء</label><input className="form-input" type="date" value={form.endDate} onChange={e => setForm(f=>({...f,endDate:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
        {form.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="subscribers" onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/>}
        <div className="form-group"><label className="form-label">الإجمالي</label><input className="form-input" readOnly value={fmt(form.pkg*(form.type==='family'?form.familyCount:1))+' ر'} style={{ fontWeight:700, color:'var(--red)' }}/></div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':'إضافة المشترك'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ STAFF BUS ============
function StaffBus({ refresh, branch }) {
  const [subs, setSubs] = useState([])
  useEffect(() => {
    supabase.from('subscribers').select('*').eq('branch', branch).eq('has_bus', true).eq('status','approved').order('created_at',{ascending:false}).then(({data}) => setSubs(data||[]))
  }, [refresh, branch])

  const busRev = subs.reduce((a,s) => a+Number(s.bus_amount||0), 0)

  return (
    <div className="page">
      <div className="kpi-grid">
        <div className="kpi kpi-accent kpi-full">
          <div className="kpi-label">مستخدمو الباص</div>
          <div className="kpi-val">{subs.length} مشترك</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">المبلغ المحصل</div>
          <div className="kpi-val">{fmt(busRev)} ر</div>
        </div>
      </div>
      <div style={{ background:'var(--orange-l)', border:'1px solid #fbbf24', borderRadius:8, padding:'.6rem .875rem', fontSize:12, color:'var(--orange)', marginBottom:'.75rem' }}>
        ⚠️ إيراد الباص ({fmt(busRev)} ر) يُحوَّل لأصحاب الباص ولا يدخل في حسابات الأكاديمية
      </div>
      <div className="sec">قائمة الباص ({subs.length} مشترك)</div>
      <div className="card">
        {subs.length===0 ? <div className="empty"><div className="empty-icon">🚌</div>لا يوجد مشتركون بالباص</div> :
          subs.map((s,i) => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-blue">{s.name[0]}</div>
                <div><div className="list-name">{s.name}</div><div className="list-sub">{s.payment_method}{s.guardian_phone?` · 📞 ${s.guardian_phone}`:''}</div></div>
              </div>
              <span className="badge badge-b">{fmt(s.bus_amount||150)} ر</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ============ STAFF INVENTORY ============
function StaffInventory({ toast, refresh, branch }) {
  const [inventory, setInventory] = useState([])
  const [sales, setSales] = useState([])
  const [month, setMonth] = useState('2026-10')
  const [modal, setModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [form, setForm] = useState({ qty:1, price:0, payment:'نقدي', receiptUrl:'' })
  const [submitting, setSubmitting] = useState(false)
  const [subsKitUnits, setSubsKitUnits] = useState(0)

  async function load() {
    const [inv, s, subsKits] = await Promise.all([
      supabase.from('inventory').select('*').order('name'),
      supabase.from('sales').select('*').eq('branch', branch).order('created_at',{ascending:false}).limit(30),
      supabase.from('subscribers').select('kit_amount,start_date').eq('branch', branch).eq('status','approved').gt('kit_amount', 0),
    ])
    setInventory(inv.data||[]); setSales(s.data||[])
    // Calculate kit units from subscribers (each kit = 100 ر)
    const subsKitUnits = (subsKits.data||[]).reduce((a,s) => a + Math.round(Number(s.kit_amount||0)/100), 0)
    setSubsKitUnits(subsKitUnits)
  }
  useEffect(() => { load() }, [refresh])

  const approvedSales = sales.filter(s => s.status==='approved')
  const pendingSales = sales.filter(s => s.status==='pending')
  const monthSales = approvedSales.filter(s => s.created_at?.startsWith(month))
  const monthRevenue = monthSales.reduce((a,s) => a+Number(s.total), 0)
  const monthSalesUnits = monthSales.filter(s => s.item !== 'مياه').reduce((a,s) => a+Number(s.qty||1), 0)
  const waterUnits = monthSales.filter(s => s.item === 'مياه').reduce((a,s) => a+Number(s.qty||1), 0)
  const monthUnits = monthSalesUnits + subsKitUnits

  const INV_ORDER = ['طقم صيفي (جيرسي + شورت)','طقم شتوي','جوارب','حقيبة','حقيبة + جوارب','مياه']
  const sortedInventory = [...inventory].sort((a,b) => {
    const ai = INV_ORDER.indexOf(a.name), bi = INV_ORDER.indexOf(b.name)
    return (ai===-1?99:ai) - (bi===-1?99:bi)
  })

  async function submit() {
    if (!form.price) { alert('أدخل السعر'); return }
    if (form.payment!=='نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const { error } = await supabase.from('sales').insert({
      item:selectedItem.name, qty:form.qty, price:form.price,
      total:form.qty*form.price, payment_method:form.payment,
      has_receipt:form.payment!=='نقدي', receipt_url:form.receiptUrl||null,
      created_by:ROLES[branch==='jazan'?'admin_jazan':'admin_riyadh']?.label,
      branch, status:'pending'
    })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ','error'); return }
    toast('✅ تم الحفظ بنجاح','success')
    setModal(false); load()
  }

  function openSale(item) {
    setSelectedItem(item)
    setForm({ qty:1, price:item.price, payment:'نقدي', receiptUrl:'' })
    setModal(true)
  }

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">إيراد الشهر</div><div className="kpi-val kpi-val-g">{fmt(monthRevenue)} ر</div></div>
        <div className="kpi"><div className="kpi-label">قطع مباعة</div><div className="kpi-val">{monthUnits} قطعة</div></div>
      </div>
      {pendingSales.length>0 && (
        <div className="info-box info-yellow">{pendingSales.length} مبيعات بانتظار موافقة المالك</div>
      )}
      <div className="store-grid">
        {sortedInventory.map(item => (
          <div key={item.id} className="store-card">
            <div className="store-icon-wrap">{item.icon||'📦'}</div>
            <div className="store-info">
              <div className="store-name">{item.name}</div>
              <div className="store-price">{item.price} ر</div>
              <div className="store-stock"><span style={{ color:'var(--green)' }}>متبقي: {item.stock}</span> · <span style={{ color:'var(--t3)' }}>مباع: {item.sold}</span></div>
              <button style={{ marginTop:6, width:'100%', background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:6, padding:'.35rem', fontSize:11, cursor:'pointer', color:'var(--red)', fontFamily:'inherit' }} onClick={() => openSale(item)}>تسجيل بيع</button>
            </div>
          </div>
        ))}
      </div>
      <div className="sec">سجل المبيعات</div>
      <div className="card">
        {sales.length===0 ? <div className="empty"><div className="empty-icon">🛍️</div>لا يوجد مبيعات</div> :
          sales.map(s => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-green">🛍</div>
                <div>
                  <div className="list-name">{s.item}</div>
                  <div className="list-sub">{s.qty} قطعة · {s.payment_method} · {s.created_at?.slice(0,10)}</div>
                  {s.receipt_url && <a href={s.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
              </div>
              <div className="list-right">
                <span className="badge badge-g">{fmt(s.total)} ر</span>
                {s.status==='pending' && <span className="badge badge-o" style={{ fontSize:9, marginTop:3 }}>معلق</span>}
              </div>
            </div>
          ))}
      </div>
      <button className="fab" onClick={() => { if(sortedInventory.length>0){ setSelectedItem(sortedInventory[0]); setForm({ qty:1, price:sortedInventory[0]?.price||0, payment:'نقدي', receiptUrl:'' }); setModal(true) } }}>🛍️</button>
      <Modal open={modal} onClose={() => setModal(false)} title="تسجيل بيع">
        <div className="form-group">
          <label className="form-label">الصنف</label>
          <select className="form-select" value={selectedItem?.name||''} onChange={e => { const item = inventory.find(i=>i.name===e.target.value); setSelectedItem(item); setForm(f=>({...f,price:item?.price||0})) }}>
            {sortedInventory.map(i => <option key={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">الكمية</label><input className="form-input" type="number" min="1" value={form.qty} onChange={e => setForm(f=>({...f,qty:parseInt(e.target.value)||1}))}/></div>
          <div className="form-group"><label className="form-label">السعر (ر)</label><input className="form-input" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:parseInt(e.target.value)||0}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
        {form.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="sales" onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/>}
        <div className="form-group"><label className="form-label">الإجمالي</label><input className="form-input" readOnly value={fmt(form.qty*form.price)+' ر'} style={{ fontWeight:700, color:'var(--red)' }}/></div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':'تسجيل البيع'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ MY EXPENSES ============
function MyExpenses({ role, toast, refresh, branch }) {
  const [month, setMonth] = useState('2026-09')
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ cat:'', desc:'', amount:'', date:TODAY, payment:'نقدي', receiptUrl:'' })
  const [submitting, setSubmitting] = useState(false)
  const by = ROLES[role]?.label

  async function load(m) {
    const [p, a] = await Promise.all([
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','pending').eq('submitted_by', by).order('created_at',{ascending:false}),
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','approved').eq('submitted_by', by).gte('date', m+'-01').lte('date', monthEnd(m)).order('date',{ascending:false}),
    ])
    setPending(p.data||[]); setApproved(a.data||[])
  }
  useEffect(() => { load(month) }, [month, refresh])

  async function submit() {
    if (!form.cat||!form.desc||!form.amount) { alert('أكمل جميع الحقول واختر التصنيف'); return }
    if (form.payment!=='نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const { error } = await supabase.from('expenses').insert({
      category:form.cat, description:form.desc, amount:parseFloat(form.amount),
      date:form.date, payment_method:form.payment, has_receipt:form.payment!=='نقدي',
      receipt_url:form.receiptUrl||null, status:'pending', submitted_by:by, branch
    })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ','error'); return }
    toast('✅ تم تسجيل المصروف بنجاح','success')
    setModal(false)
    setForm({ cat:'', desc:'', amount:'', date:TODAY, payment:'نقدي', receiptUrl:'' })
    load(month)
  }

  return (
    <div className="page">
      {/* EXPENSE FORM - on top */}
      <div className="card" style={{ marginBottom:'.75rem' }}>
        <div style={{ padding:'.875rem 1rem' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--red)', marginBottom:'.875rem' }}>تسجيل مصروف جديد</div>
          <div className="cat-grid" style={{ marginBottom:'.75rem' }}>
            {(role==='admin_riyadh'||role==='admin_jazan'
              ? [['رواتب','👤'],['مياه مخزون','💧'],['محامي','⚖️'],['أخرى','📦']]
              : [['كهرباء','⚡'],['ماء فاتورة','🚰'],['إنترنت','🌐'],['صيانة','🔧'],['تأمينات','🛡️'],['قرض','🏦'],['أخرى','📦']]
            ).map(([c,ic]) => (
              <button key={c} className={`cat-btn ${form.cat===c?'cat-selected':''}`} onClick={() => setForm(f=>({...f,cat:c}))}>{ic} {c}</button>
            ))}
          </div>
          <div className="form-group"><input className="form-input" value={form.desc} onChange={e => setForm(f=>({...f,desc:e.target.value}))} placeholder="الوصف"/></div>
          <div className="form-row" style={{ marginBottom:'.75rem' }}>
            <input className="form-input" type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="المبلغ (ر)"/>
            <input className="form-input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <PaymentBtns value={form.payment} onChange={v => setForm(f=>({...f,payment:v,receiptUrl:''}))}/>
          {form.payment!=='نقدي' && <div style={{ marginTop:'.75rem' }}><ReceiptUpload label="إرفاق الإيصال" folder="expenses" onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/></div>}
          <button className="btn-primary" style={{ marginTop:'.75rem' }} disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':'تسجيل المصروف ⟶'}</button>
        </div>
      </div>

      {/* ARCHIVE SECTION */}
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => { setMonth(e.target.value); load(e.target.value) }}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">معلق</div><div className="strip-val" style={{ color:'var(--red)' }}>{pending.length}</div></div>
        <div className="strip-item"><div className="strip-label">معتمد هذا الشهر</div><div className="strip-val" style={{ color:'var(--green)' }}>{approved.length}</div></div>
        <div className="strip-item"><div className="strip-label">إجمالي معتمد</div><div className="strip-val">{fmt(approved.reduce((a,e)=>a+Number(e.amount),0))} ر</div></div>
      </div>

      {pending.length>0 && (
        <>
          <div className="sec">بانتظار الموافقة</div>
          {pending.map(a => (
            <div key={a.id} className="approval-card">
              <div className="approval-head"><span style={{ fontSize:11, fontWeight:600, color:'var(--t3)' }}>{a.category}</span><span className="badge badge-o">معلق</span></div>
              <div className="approval-body">
                <div className="approval-desc">{a.description}</div>
                <div className="approval-meta">{a.date} · {fmt(a.amount)} ر · {a.payment_method}</div>
                {a.receipt_url && <a href={a.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="sec">المعتمدة</div>
      <div className="card">
        {approved.length===0 ? <div className="empty"><div className="empty-icon">📁</div>لا يوجد مصاريف معتمدة</div> :
          approved.map(e => (
            <div key={e.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-green">✓</div>
                <div>
                  <div className="list-name">{e.description}</div>
                  <div className="list-sub">{e.category} · {e.date} · {e.payment_method}</div>
                  {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
              </div>
              <span className="badge badge-g">{fmt(e.amount)} ر</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ============ WATER STOCK INLINE ============
function WaterStock({ branch }) {
  const [stock, setStock] = useState(null)
  useEffect(() => {
    supabase.from('inventory').select('stock').eq('name','مياه').single().then(({data}) => setStock(data?.stock??null))
  }, [])
  if (stock === null) return null
  return <span style={{ color: stock <= 5 ? 'var(--red)' : 'var(--green)', fontWeight:600 }}>متبقي: {stock} صندوق</span>
}

// ============ FIELDS CALENDAR ============
function FieldsCal({ role, toast, refresh, branch }) {
  const [bookings, setBookings] = useState([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(false)
  const [pitch, setPitch] = useState('small')
  const [water, setWater] = useState(false)
  const [form, setForm] = useState({ name:'', phone:'', date:TODAY, time:'', payment:'نقدي', receiptUrl:'' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const { data } = await supabase.from('bookings').select('*').eq('branch', branch).order('date',{ascending:false})
    setBookings(data||[])
  }
  useEffect(() => { load() }, [refresh, branch])

  async function submit() {
    if (!form.name.trim()) { alert('أدخل اسم الحاجز'); return }
    if (form.payment!=='نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }

    // Conflict check
    if (form.date && form.time) {
      const conflict = bookings.find(b =>
        b.date === form.date &&
        b.pitch === pitch &&
        b.time === form.time &&
        b.status !== 'rejected'
      )
      if (conflict) {
        alert(`⚠️ تعارض في الحجز!\n${pitch==='small'?'الملعب الصغير':'الملعب الكبير'} محجوز بالفعل في ${form.date} الساعة ${form.time} باسم "${conflict.booker_name}".\nاختر وقتاً آخر.`)
        return
      }
    }

    const base = pitch==='small'?250:300
    const amount = base+(water?20:0)
    setSubmitting(true)
    const { error } = await supabase.from('bookings').insert({
      pitch, booker_name:form.name, booker_phone:form.phone||null,
      date:form.date, time:form.time, water, amount,
      payment_method:form.payment, has_receipt:form.payment!=='نقدي',
      receipt_url:form.receiptUrl||null,
      created_by:ROLES[role]?.label, branch, status:'pending'
    })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ','error'); return }
    toast('✅ تم الحفظ بنجاح','success')
    setModal(false)
    setForm({ name:'', phone:'', date:TODAY, time:'', payment:'نقدي', receiptUrl:'' })
    setWater(false); load()
  }

  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const dayNames = ['ح','ن','ث','ر','خ','ج','س']
  const approvedBookings = bookings.filter(b => b.status==='approved')
  const pendingBookings = bookings.filter(b => b.status==='pending')
  const todayBks = approvedBookings.filter(b => b.date===TODAY)
  const todayRev = todayBks.reduce((a,b) => a+Number(b.amount), 0)
  // Show revenue for whichever month is currently displayed in the calendar
  const calMonthStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}`
  const monthBks = approvedBookings.filter(b => b.date?.startsWith(calMonthStr))
  const monthRev = monthBks.reduce((a,b) => a+Number(b.amount), 0)
  const selectedBks = selectedDate ? bookings.filter(b => b.date===selectedDate) : []
  const selectedRev = selectedBks.filter(b=>b.status==='approved').reduce((a,b) => a+Number(b.amount), 0)
  const base = pitch==='small'?250:300

  function renderCal() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate()
    const daysInPrev = new Date(calYear, calMonth, 0).getDate()
    const startDay = (firstDay+1)%7
    const cells = []
    for (let i=0; i<startDay; i++) cells.push({ day:daysInPrev-startDay+i+1, other:true })
    for (let d=1; d<=daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      cells.push({ day:d, dateStr, isToday:dateStr===TODAY, isSelected:dateStr===selectedDate, bookings:approvedBookings.filter(b=>b.date===dateStr) })
    }
    const remaining = 42-cells.length
    for (let i=1; i<=remaining; i++) cells.push({ day:i, other:true })
    return cells
  }

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">{selectedDate?'إيراد اليوم المحدد':'إيراد اليوم'}</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(selectedDate?selectedRev:todayRev)} ر</div></div>
        <div className="strip-item"><div className="strip-label">{selectedDate?'حجوزات اليوم المحدد':'حجوزات اليوم'}</div><div className="strip-val">{selectedDate?selectedBks.length:todayBks.length}</div></div>
        <div className="strip-item"><div className="strip-label">إيراد {monthNames[calMonth]}</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(monthRev)} ر</div></div>
      </div>

      {pendingBookings.length>0 && (
        <div className="info-box info-yellow">{pendingBookings.length} حجوزات بانتظار موافقة المالك</div>
      )}

      <div className="card" style={{ overflow:'hidden' }}>
        <div className="cal-header">
          <button className="cal-nav" onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }}>›</button>
          <span className="cal-title">{monthNames[calMonth]} {calYear}</span>
          <button className="cal-nav" onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }}>‹</button>
        </div>
        <div className="cal-grid">
          {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          {renderCal().map((cell,i) => (
            <div key={i} className={`cal-cell ${cell.other?'cal-other':''} ${cell.isToday?'cal-today':''} ${cell.isSelected?'cal-today':''}`} onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}>
              <div className="cal-date">{cell.day}</div>
              {(cell.bookings||[]).map((b,j) => <div key={j} className={`cal-booking ${b.pitch==='big'?'cal-booking-big':''}`}>{b.time} {b.pitch==='small'?'ص':'ك'}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div className="sec">حجوزات {selectedDate||'اختر يوماً'}</div>
      <div className="card">
        {!selectedDate ? <div className="empty"><div className="empty-icon">📅</div>اختر يوماً من التقويم</div> :
          selectedBks.length===0 ? <div className="empty"><div className="empty-icon">📅</div>لا يوجد حجوزات</div> :
            selectedBks.map(b => (
              <div key={b.id} className="list-row">
                <div className="list-left">
                  <div className={`list-av ${b.pitch==='small'?'list-av-blue':'list-av-red'}`}>{b.pitch==='small'?'ص':'ك'}</div>
                  <div>
                    <div className="list-name">{b.booker_name}</div>
                    <div className="list-sub">{b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · {b.time} · {b.payment_method}{b.water?' · 💧':''}{b.booker_phone?` · 📞 ${b.booker_phone}`:''}</div>
                    {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                  </div>
                </div>
                <div className="list-right">
                  <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ر</span>
                  {b.status==='pending' && <span className="badge badge-o" style={{ fontSize:9, marginTop:3 }}>معلق</span>}
                </div>
              </div>
            ))}
      </div>

      <button className="fab" onClick={() => setModal(true)}>📅</button>

      <Modal open={modal} onClose={() => setModal(false)} title="حجز ملعب جديد">
        <div className="form-group">
          <label className="form-label">اختر الملعب</label>
          <div className="pitch-grid">
            <div className={`pitch-card ${pitch==='small'?'pitch-selected':''}`} onClick={() => setPitch('small')}><div className="pitch-name">ملعب صغير</div><div className="pitch-price">250 ر</div><div className="pitch-sub">2 ساعات</div></div>
            <div className={`pitch-card ${pitch==='big'?'pitch-selected':''}`} onClick={() => setPitch('big')}><div className="pitch-name">ملعب كبير</div><div className="pitch-price">300 ر</div><div className="pitch-sub">2 ساعات</div></div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">اسم الحاجز</label><input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="الاسم"/></div>
          <div className="form-group"><label className="form-label">رقم الجوال</label><input className="form-input" type="tel" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="05XXXXXXXX"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">التاريخ</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">وقت البداية</label><input className="form-input" type="time" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))}/></div>
        </div>
        <div className="form-group">
          <label className="form-label">إضافات</label>
          <div className="water-toggle" onClick={() => setWater(w=>!w)}>
            <div className="water-toggle-left"><span style={{ fontSize:20 }}>💧</span><div><div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>صندوق مياه</div><div style={{ fontSize:12, color:'var(--t3)' }}>+20 ر · <WaterStock branch={branch}/></div></div></div>
            <div className={`toggle-switch ${water?'toggle-on':''}`}/>
          </div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
        {form.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="bookings" onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/>}
        <div className="form-group"><label className="form-label">الإجمالي</label><input className="form-input" readOnly value={fmt(base+(water?20:0))+' ر'} style={{ fontWeight:700, color:'var(--red)' }}/></div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':'تسجيل الحجز'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ MAIN APP ============
export default function App() {
  const [role, setRole] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('success')
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [branch, setBranch] = useState('riyadh')

  function showToast(msg, type='success') { setToastMsg(msg); setToastType(type); setTimeout(() => setToastMsg(''), 2500) }

  function login(r) {
    setRole(r)
    const roleMeta = ROLES[r]
    if (roleMeta?.branch) setBranch(roleMeta.branch)
    const first = { owner:'dashboard', admin_riyadh:'subs', fields_riyadh:'cal', admin_jazan:'subs', fields_jazan:'cal' }
    setActiveTab(first[r])
  }

  function logout() { setRole(null); setActiveTab(null) }
  function handleRefresh() { setSyncing(true); setRefreshKey(k=>k+1); setTimeout(() => setSyncing(false), 1500) }

  useEffect(() => {
    if (role==='owner') {
      Promise.all([
        supabase.from('expenses').select('id',{count:'exact'}).eq('branch', branch).eq('status','pending'),
        supabase.from('bookings').select('id',{count:'exact'}).eq('branch', branch).eq('status','pending'),
        supabase.from('sales').select('id',{count:'exact'}).eq('branch', branch).eq('status','pending'),
        supabase.from('subscribers').select('id',{count:'exact'}).eq('branch', branch).eq('status','pending'),
      ]).then(results => {
        const total = results.reduce((a,r) => a+(r.count||0), 0)
        setPendingCount(total)
      })
    }
  }, [role, activeTab, refreshKey, branch])

  if (!role) return <LoginPage onLogin={login}/>

  const isOwner = role==='owner'
  const isAdmin = role==='admin_riyadh'||role==='admin_jazan'
  const isFields = role==='fields_riyadh'||role==='fields_jazan'
  const userBranch = ROLES[role]?.branch||branch

  const renderPage = () => {
    if (isOwner) {
      if (activeTab==='dashboard') return <OwnerDashboard toast={showToast} refresh={refreshKey} branch={branch}/>
      if (activeTab==='academy')   return <OwnerAcademy  toast={showToast} refresh={refreshKey} branch={branch}/>
      if (activeTab==='fields')    return <OwnerFields   toast={showToast} refresh={refreshKey} branch={branch}/>
      if (activeTab==='expenses')  return <OwnerExpenses toast={showToast} refresh={refreshKey} branch={branch}/>
    }
    if (isAdmin) {
      if (activeTab==='subs')        return <StaffSubs      toast={showToast} refresh={refreshKey} branch={userBranch}/>
      if (activeTab==='bus')         return <StaffBus                         refresh={refreshKey} branch={userBranch}/>
      if (activeTab==='inventory')   return <StaffInventory toast={showToast} refresh={refreshKey} branch={userBranch}/>
      if (activeTab==='my-expenses') return <MyExpenses role={role} toast={showToast} refresh={refreshKey} branch={userBranch}/>
    }
    if (isFields) {
      if (activeTab==='cal')         return <FieldsCal  role={role} toast={showToast} refresh={refreshKey} branch={userBranch}/>
      if (activeTab==='my-expenses') return <MyExpenses role={role} toast={showToast} refresh={refreshKey} branch={userBranch}/>
    }
    return null
  }

  return (
    <>
      <Banner role={role} onLogout={logout} onRefresh={handleRefresh} syncing={syncing} branch={branch} setBranch={setBranch}/>
      {renderPage()}
      <BottomNav role={role} active={activeTab} setActive={setActiveTab} pendingCount={pendingCount}/>
      <Toast msg={toastMsg} type={toastType}/>
    </>
  )
}
