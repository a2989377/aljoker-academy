'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, PINS, ROLES, EXP_CATS, EXP_COLORS, monthEnd, fmt, uploadReceipt } from '../lib/supabase'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const avColors = ['list-av-red', 'list-av-green', 'list-av-blue', 'list-av-yellow']
const MONTHS = [
  { value: '2026-09', label: 'سبتمبر 2026' },
  { value: '2026-10', label: 'أكتوبر 2026' },
  { value: '2026-11', label: 'نوفمبر 2026' },
  { value: '2026-12', label: 'ديسمبر 2026' },
]

function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`toast toast-show toast-${type}`}>{msg}</div>
}

function Banner({ role, onLogout }) {
  const r = ROLES[role]
  return (
    <div className="banner">
      <div className="brand">
        <div className="logo">J</div>
        <div>
          <div className="brand-title">أكاديمية الجوكر</div>
          <div className="brand-sub">{r?.label}</div>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        <div className="user-av">{r?.avatar}</div>
        <span className="username">خروج</span>
      </button>
    </div>
  )
}

function BottomNav({ role, active, setActive, pendingCount }) {
  const ownerTabs = [
    { id: 'dashboard', icon: '📊', label: 'داشبورد' },
    { id: 'academy', icon: '🎓', label: 'الأكاديمية' },
    { id: 'fields', icon: '🏟️', label: 'الملاعب' },
    { id: 'expenses', icon: '💸', label: 'المصاريف' },
  ]
  const adminTabs = [
    { id: 'admin-subs', icon: '👥', label: 'المشتركون' },
    { id: 'admin-bus', icon: '🚌', label: 'الباص' },
    { id: 'admin-inventory', icon: '🛍️', label: 'المستلزمات' },
    { id: 'admin-expenses', icon: '💸', label: 'المصاريف' },
  ]
  const fieldsTabs = [
    { id: 'fields-cal', icon: '🏟️', label: 'الملاعب' },
    { id: 'fields-expenses', icon: '💸', label: 'المصاريف' },
  ]
  const tabs = role === 'owner' ? ownerTabs : role === 'admin' ? adminTabs : fieldsTabs
  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={`nav-item ${active === t.id ? 'nav-active' : ''}`} onClick={() => setActive(t.id)}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
          {t.id === 'dashboard' && pendingCount > 0 && <span className="nav-notif">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

function ReceiptUpload({ label, folder, onUploaded }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function handleChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setUploading(true)
    try {
      const url = await uploadReceipt(f, folder)
      onUploaded(url)
    } catch (err) {
      console.error(err)
    }
    setUploading(false)
  }

  return (
    <div className="form-group">
      <label className="form-label">{label} <span style={{ color: 'var(--red)' }}>*</span></label>
      <div className={`receipt-wrap ${file ? 'receipt-has-file' : ''}`} onClick={() => inputRef.current?.click()}>
        <div className="receipt-icon">📎</div>
        <div className={`receipt-text ${file ? 'receipt-text-green' : ''}`}>
          {uploading ? 'جاري الرفع...' : file ? '✅ ' + file.name : 'اضغط لرفع الإيصال'}
        </div>
        <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleChange} />
      </div>
      <div className="receipt-note">⚠️ الإيصال مطلوب للدفع غير النقدي</div>
    </div>
  )
}

function PaymentBtns({ value, onChange }) {
  return (
    <div className="payment-btns">
      {['نقدي', 'شبكة', 'تحويل'].map(m => (
        <button key={m} className={`pay-btn ${value === m ? 'pay-selected' : ''}`} onClick={() => onChange(m)}>
          {m === 'نقدي' ? '💵 نقدي' : m === 'شبكة' ? '💳 شبكة' : '📱 تحويل'}
        </button>
      ))}
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
    const newPin = pin + d
    setPin(newPin)
    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === PINS[role]) {
          onLogin(role)
        } else {
          setError(true)
          setPin('')
        }
      }, 150)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">J</div>
      <div className="login-title">أكاديمية الجوكر</div>
      <div className="login-sub">أدخل رمز الدخول</div>
      <div className="login-card">
        <label className="login-label">نوع المستخدم</label>
        <select className="login-select" value={role} onChange={e => { setRole(e.target.value); setPin(''); setError(false); }}>
          <option value="owner">المالك</option>
          <option value="admin">مدير الشؤون الإدارية</option>
          <option value="fields">مسؤول الملاعب</option>
        </select>
        <div className="pin-wrap">
          {[0, 1, 2, 3].map(i => <div key={i} className={`pin-dot ${i < pin.length ? 'pin-filled' : ''}`} />)}
        </div>
        <div className="numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} className="num-btn" onClick={() => press(String(n))}>{n}</button>
          ))}
          <button className="num-btn" onClick={() => { setPin(''); setError(false); }}>مسح</button>
          <button className="num-btn" onClick={() => press('0')}>0</button>
          <button className="num-btn num-btn-del" onClick={() => setPin(p => p.slice(0, -1))}>⌫</button>
        </div>
        {error && <div className="login-error">رمز الدخول غير صحيح</div>}
      </div>
    </div>
  )
}

// ============ OWNER DASHBOARD ============
function OwnerDashboard({ toast }) {
  const [month, setMonth] = useState('2026-09')
  const [data, setData] = useState({ rev: 0, exp: 0, profit: 0 })
  const [pending, setPending] = useState([])
  const [archive, setArchive] = useState([])
  const [loading, setLoading] = useState(true)

  async function load(m) {
    setLoading(true)
    const start = m + '-01', end = monthEnd(m)
    const [r1, r2, r3] = await Promise.all([
      supabase.from('bookings').select('amount').gte('date', start).lte('date', end),
      supabase.from('sales').select('total,created_at').gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
      supabase.from('expenses').select('amount').eq('status', 'approved').gte('date', start).lte('date', end),
    ])
    const rev = (r1.data || []).reduce((a, b) => a + Number(b.amount), 0) + (r2.data || []).reduce((a, s) => a + Number(s.total), 0)
    const exp = (r3.data || []).reduce((a, e) => a + Number(e.amount), 0)
    setData({ rev, exp, profit: rev - exp })

    const [p, a] = await Promise.all([
      supabase.from('expenses').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').neq('status', 'pending').order('approved_at', { ascending: false }).limit(30),
    ])
    setPending(p.data || [])
    setArchive(a.data || [])
    setLoading(false)
  }

  useEffect(() => { load(month) }, [month])

  async function approve(id) {
    await supabase.from('expenses').update({ status: 'approved', approved_by: 'المالك', approved_at: new Date().toISOString() }).eq('id', id)
    toast('✅ تمت الموافقة على المصروف', 'success')
    load(month)
  }
  async function reject(id) {
    await supabase.from('expenses').update({ status: 'rejected', approved_by: 'المالك', approved_at: new Date().toISOString() }).eq('id', id)
    toast('تم رفض المصروف', 'error')
    load(month)
  }

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <div className={`kpi kpi-accent kpi-full`}>
          <div className="kpi-label">صافي الربح</div>
          <div className={`kpi-val ${data.profit >= 0 ? 'kpi-val-g' : 'kpi-val-r'}`}>{(data.profit >= 0 ? '+' : '') + fmt(data.profit)} ر</div>
          <div className="kpi-sub">إيرادات {fmt(data.rev)} · مصاريف {fmt(data.exp)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">إجمالي الإيرادات</div>
          <div className="kpi-val kpi-val-g">{fmt(data.rev)} ر</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">إجمالي المصاريف</div>
          <div className="kpi-val kpi-val-r">{fmt(data.exp)} ر</div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--orange)', background: 'var(--orange-l)', marginBottom: '.75rem' }}>
          <div className="list-row" style={{ border: 'none' }}>
            <div className="list-left">
              <div className={`list-av list-av-yellow`}>⏳</div>
              <div><div className="list-name">مصاريف بانتظار موافقتك</div><div className="list-sub">{pending.length} طلبات معلقة</div></div>
            </div>
            <span className="badge badge-o">راجع</span>
          </div>
        </div>
      )}

      <div className="sec">طلبات الموافقة</div>
      {loading ? <div className="loading">جاري التحميل...</div> : pending.length === 0 ? (
        <div className="empty"><div className="empty-icon">✅</div>لا يوجد طلبات معلقة</div>
      ) : pending.map(a => (
        <div key={a.id} className="approval-card">
          <div className="approval-head">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)' }}>{a.category}</span>
            <span className="badge badge-o">معلق</span>
          </div>
          <div className="approval-body">
            <div className="approval-desc">{a.description}</div>
            <div className="approval-meta">{a.submitted_by} · {a.date} · {fmt(a.amount)} ر · {a.payment_method}</div>
            {a.receipt_url && <a href={a.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 عرض الإيصال</a>}
          </div>
          <div className="approval-actions">
            <button className="btn-approve" onClick={() => approve(a.id)}>✓ موافقة</button>
            <button className="btn-reject" onClick={() => reject(a.id)}>✕ رفض</button>
          </div>
        </div>
      ))}

      <div className="sec">الأرشيف</div>
      <div className="card">
        {archive.length === 0 ? <div className="empty"><div className="empty-icon">📁</div>الأرشيف فارغ</div> :
          archive.map(a => (
            <div key={a.id} className="list-row">
              <div className="list-left">
                <div className={`list-av ${a.status === 'approved' ? 'list-av-green' : 'list-av-red'}`}>{a.status === 'approved' ? '✓' : '✕'}</div>
                <div>
                  <div className="list-name">{a.description}</div>
                  <div className="list-sub">{a.category} · {a.submitted_by} · {a.payment_method}</div>
                  {a.receipt_url && <a href={a.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
              </div>
              <div className="list-right">
                <span className={`badge ${a.status === 'approved' ? 'badge-g' : 'badge-r'}`}>{fmt(a.amount)} ر</span>
                <span style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{a.status === 'approved' ? 'معتمد' : 'مرفوض'}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

// ============ OWNER ACADEMY ============
function OwnerAcademy({ toast }) {
  const [tab, setTab] = useState('subs')
  const [subs, setSubs] = useState([])
  const [inventory, setInventory] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, inv] = await Promise.all([
        supabase.from('subscribers').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('name'),
      ])
      setSubs(s.data || [])
      setInventory(inv.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = search ? subs.filter(s => s.name.includes(search)) : subs
  const total = subs.reduce((a, s) => a + Number(s.package), 0)
  const busCount = subs.filter(s => s.package === 450 || s.package === 550).length

  return (
    <div className="page">
      <div className="inner-tabs">
        <button className={`inner-tab ${tab === 'subs' ? 'inner-tab-active' : ''}`} onClick={() => setTab('subs')}>المشتركون</button>
        <button className={`inner-tab ${tab === 'other' ? 'inner-tab-active' : ''}`} onClick={() => setTab('other')}>الباص والمستلزمات</button>
      </div>

      {tab === 'subs' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">المشتركون</div><div className="kpi-val">{subs.length}</div></div>
            <div className="kpi"><div className="kpi-label">إجمالي الاشتراكات</div><div className="kpi-val kpi-val-g">{fmt(total)} ر</div></div>
          </div>
          <div className="card" style={{ borderRadius: 'var(--r) var(--r) 0 0', borderBottom: 'none' }}>
            <div className="search-wrap" style={{ borderRadius: 0 }}>
              <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 var(--r) var(--r)' }}>
            {loading ? <div className="loading">جاري التحميل...</div> : filtered.length === 0 ? <div className="empty"><div className="empty-icon">👥</div>لا يوجد مشتركون</div> :
              filtered.slice(0, 30).map((s, i) => (
                <div key={s.id} className="list-row">
                  <div className="list-left">
                    <div className={`list-av ${avColors[i % 4]}`}>{s.name[0]}</div>
                    <div>
                      <div className="list-name">{s.name}</div>
                      <div className="list-sub">{s.package} ر · {s.type === 'family' ? 'عائلي' : 'فردي'} · {s.payment_method}</div>
                    </div>
                  </div>
                  <div className="list-right">
                    <div className="list-amt">{fmt(s.package)} ر</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      <span className={`badge ${s.payment_method === 'نقدي' ? 'badge-y' : s.payment_method === 'شبكة' ? 'badge-b' : 'badge-g'}`}>{s.payment_method}</span>
                    </div>
                  </div>
                </div>
              ))}
            {filtered.length > 30 && <div className="empty">+ {filtered.length - 30} آخرين</div>}
          </div>
        </>
      )}

      {tab === 'other' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">مستخدمو الباص</div><div className="kpi-val">{busCount}</div></div>
            <div className="kpi"><div className="kpi-label">إيراد الباص</div><div className="kpi-val kpi-val-g">{fmt(busCount * 150)} ر</div></div>
          </div>
          <div className="sec">المخزون</div>
          <div className="store-grid">
            {inventory.map(item => (
              <div key={item.id} className="store-card">
                <div className="store-icon-wrap">{item.icon || '📦'}</div>
                <div className="store-info">
                  <div className="store-name">{item.name}</div>
                  <div className="store-price">{item.price} ر</div>
                  <div className="store-stock">متبقي: {item.stock} · مباع: {item.sold}</div>
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
function OwnerFields({ toast }) {
  const [tab, setTab] = useState('stats')
  const [bookings, setBookings] = useState([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.from('bookings').select('*').order('date', { ascending: false }).then(({ data }) => setBookings(data || []))
  }, [])

  const smallRev = bookings.filter(b => b.pitch === 'small').reduce((a, b) => a + Number(b.amount), 0)
  const bigRev = bookings.filter(b => b.pitch === 'big').reduce((a, b) => a + Number(b.amount), 0)

  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const dayNames = ['ح','ن','ث','ر','خ','ج','س']

  function renderCal() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const daysInPrev = new Date(calYear, calMonth, 0).getDate()
    const startDay = (firstDay + 1) % 7
    const cells = []
    for (let i = 0; i < startDay; i++) cells.push({ day: daysInPrev - startDay + i + 1, other: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayBks = bookings.filter(b => b.date === dateStr)
      cells.push({ day: d, dateStr, isToday: dateStr === today, bookings: dayBks })
    }
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) cells.push({ day: i, other: true })
    return cells
  }

  const todayBks = selectedDate ? bookings.filter(b => b.date === selectedDate) : []

  return (
    <div className="page">
      <div className="inner-tabs">
        <button className={`inner-tab ${tab === 'stats' ? 'inner-tab-active' : ''}`} onClick={() => setTab('stats')}>الإحصائيات</button>
        <button className={`inner-tab ${tab === 'cal' ? 'inner-tab-active' : ''}`} onClick={() => setTab('cal')}>التقويم</button>
      </div>

      {tab === 'stats' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">ملعب صغير</div><div className="kpi-val">{fmt(smallRev)} ر</div><div className="kpi-sub">250 ر / 2 ساعات</div></div>
            <div className="kpi"><div className="kpi-label">ملعب كبير</div><div className="kpi-val">{fmt(bigRev)} ر</div><div className="kpi-sub">300 ر / 2 ساعات</div></div>
            <div className="kpi kpi-full"><div className="kpi-label">إجمالي الحجوزات</div><div className="kpi-val">{bookings.length} حجز</div></div>
          </div>
        </>
      )}

      {tab === 'cal' && (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="cal-header">
              <button className="cal-nav" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}>›</button>
              <span className="cal-title">{monthNames[calMonth]} {calYear}</span>
              <button className="cal-nav" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}>‹</button>
            </div>
            <div className="cal-grid">
              {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
              {renderCal().map((cell, i) => (
                <div key={i} className={`cal-cell ${cell.other ? 'cal-other' : ''} ${cell.isToday ? 'cal-today' : ''}`} onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}>
                  <div className="cal-date">{cell.day}</div>
                  {(cell.bookings || []).map((b, j) => (
                    <div key={j} className={`cal-booking ${b.pitch === 'big' ? 'cal-booking-big' : ''}`}>{b.time} {b.pitch === 'small' ? 'ص' : 'ك'}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="sec">حجوزات {selectedDate || 'اليوم المحدد'}</div>
          <div className="card">
            {!selectedDate ? <div className="empty"><div className="empty-icon">📅</div>اختر يوماً من التقويم</div> :
              todayBks.length === 0 ? <div className="empty"><div className="empty-icon">📅</div>لا يوجد حجوزات في هذا اليوم</div> :
                todayBks.map(b => (
                  <div key={b.id} className="list-row">
                    <div className="list-left">
                      <div className={`list-av ${b.pitch === 'small' ? 'list-av-blue' : 'list-av-red'}`}>{b.pitch === 'small' ? 'ص' : 'ك'}</div>
                      <div>
                        <div className="list-name">{b.booker_name}</div>
                        <div className="list-sub">{b.pitch === 'small' ? 'ملعب صغير' : 'ملعب كبير'} · {b.time} · {b.payment_method}{b.water ? ' · مياه' : ''}</div>
                        {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                      </div>
                    </div>
                    <span className={`badge ${b.pitch === 'small' ? 'badge-b' : 'badge-r'}`}>{fmt(b.amount)} ر</span>
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============ OWNER EXPENSES ============
function OwnerExpenses({ toast }) {
  const [month, setMonth] = useState('2026-09')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  async function load(m) {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').eq('status', 'approved').gte('date', m + '-01').lte('date', monthEnd(m)).order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }
  useEffect(() => { load(month) }, [month])

  const catTotals = {}
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount) })
  const labels = Object.keys(catTotals)
  const vals = Object.values(catTotals)
  const colors = labels.map(l => EXP_COLORS[EXP_CATS.indexOf(l)] || '#6b7280')
  const total = vals.reduce((a, v) => a + v, 0)

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <div className="kpi kpi-full"><div className="kpi-label">إجمالي المصاريف المعتمدة</div><div className="kpi-val kpi-val-r">{fmt(total)} ر</div></div>
      </div>
      {!loading && labels.length > 0 && (
        <div className="card">
          <div className="donut-wrap">
            <div style={{ width: 120, height: 120, flexShrink: 0 }}>
              <Doughnut data={{ labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0 }] }} options={{ responsive: true, plugins: { legend: { display: false } }, cutout: '68%' }} />
            </div>
            <div className="donut-legend">
              {labels.map((l, i) => (
                <div key={l} className="donut-row">
                  <div className="donut-left"><span className="donut-dot" style={{ background: colors[i] }} />{l}</div>
                  <span className="donut-val">{fmt(vals[i])} ر</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="sec">تفصيل المصاريف</div>
      <div className="card">
        {loading ? <div className="loading">جاري التحميل...</div> : expenses.length === 0 ? <div className="empty"><div className="empty-icon">💸</div>لا يوجد مصاريف معتمدة</div> :
          expenses.map(e => (
            <div key={e.id} className="list-row">
              <div className="list-left">
                <div className="list-av" style={{ background: (EXP_COLORS[EXP_CATS.indexOf(e.category)] || '#6b7280') + '22', color: EXP_COLORS[EXP_CATS.indexOf(e.category)] || '#6b7280', fontSize: 10, fontWeight: 700 }}>{e.category[0]}</div>
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
    </div>
  )
}

// ============ ADMIN SUBS ============
function AdminSubs({ toast }) {
  const [subs, setSubs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'individual', pkg: 300, familyCount: 2, payment: 'نقدي', receiptUrl: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const { data } = await supabase.from('subscribers').select('*').order('created_at', { ascending: false })
    setSubs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit() {
    if (!form.name.trim()) { alert('أدخل الاسم'); return }
    if (form.payment !== 'نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال للدفع غير النقدي'); return }
    setSubmitting(true)
    const count = form.type === 'family' ? form.familyCount : 1
    const { error } = await supabase.from('subscribers').insert({ name: form.name, type: form.type, package: form.pkg * count, payment_method: form.payment, has_receipt: form.payment !== 'نقدي', receipt_url: form.receiptUrl || null, created_by: 'مدير الشؤون الإدارية' })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); return }
    toast('✅ تم إضافة المشترك بنجاح', 'success')
    setModal(false)
    setForm({ name: '', type: 'individual', pkg: 300, familyCount: 2, payment: 'نقدي', receiptUrl: '' })
    load()
  }

  const filtered = search ? subs.filter(s => s.name.includes(search)) : subs
  const total = subs.reduce((a, s) => a + Number(s.package), 0)

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">المشتركون</div><div className="strip-val">{subs.length}</div></div>
        <div className="strip-item"><div className="strip-label">الإجمالي</div><div className="strip-val" style={{ color: 'var(--green)' }}>{fmt(total)} ر</div></div>
      </div>
      <div className="card" style={{ borderRadius: 'var(--r) var(--r) 0 0', borderBottom: 'none' }}>
        <div className="search-wrap" style={{ borderRadius: 0 }}>
          <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 var(--r) var(--r)' }}>
        {loading ? <div className="loading">جاري التحميل...</div> : filtered.slice(0, 30).map((s, i) => (
          <div key={s.id} className="list-row">
            <div className="list-left">
              <div className={`list-av ${avColors[i % 4]}`}>{s.name[0]}</div>
              <div><div className="list-name">{s.name}</div><div className="list-sub">{s.package} ر · {s.payment_method}</div></div>
            </div>
            <div className="list-right">
              <div className="list-amt">{fmt(s.package)} ر</div>
              <span className={`badge ${s.payment_method === 'نقدي' ? 'badge-y' : s.payment_method === 'شبكة' ? 'badge-b' : 'badge-g'}`}>{s.payment_method}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setModal(true)}>👤</button>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة مشترك جديد">
        <div className="form-group">
          <label className="form-label">نوع الاشتراك</label>
          <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="individual">فردي</option>
            <option value="family">عائلي</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">الاسم</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم المشترك أو العائلة" />
        </div>
        {form.type === 'family' && (
          <div className="form-group">
            <label className="form-label">عدد اللاعبين</label>
            <input className="form-input" type="number" min="2" max="10" value={form.familyCount} onChange={e => setForm(f => ({ ...f, familyCount: parseInt(e.target.value) || 2 }))} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">الباقة</label>
          <div className="pkg-grid">
            {[{ v: 300, l: 'اشتراك فقط\n300 ر' }, { v: 400, l: 'اشتراك + طقم\n400 ر' }, { v: 450, l: 'اشتراك + باص\n450 ر' }, { v: 550, l: 'اشتراك + طقم + باص\n550 ر' }, { v: 900, l: '3 أشهر\n900 ر' }, { v: 700, l: '3 أشهر مخفض\n700 ر' }].map(p => (
              <button key={p.v} className={`pkg-btn ${form.pkg === p.v ? 'pkg-selected' : ''}`} onClick={() => setForm(f => ({ ...f, pkg: p.v }))} style={{ whiteSpace: 'pre-line' }}>{p.l}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">طريقة الدفع</label>
          <PaymentBtns value={form.payment} onChange={v => setForm(f => ({ ...f, payment: v, receiptUrl: '' }))} />
        </div>
        {form.payment !== 'نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="subscribers" onUploaded={url => setForm(f => ({ ...f, receiptUrl: url }))} />}
        <div className="form-group">
          <label className="form-label">الإجمالي</label>
          <input className="form-input" readOnly value={fmt(form.pkg * (form.type === 'family' ? form.familyCount : 1)) + ' ر'} style={{ fontWeight: 700, color: 'var(--red)' }} />
        </div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'جاري الحفظ...' : 'إضافة المشترك'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ ADMIN BUS ============
function AdminBus({ toast }) {
  const [subs, setSubs] = useState([])
  useEffect(() => {
    supabase.from('subscribers').select('*').order('created_at', { ascending: false }).then(({ data }) => setSubs(data || []))
  }, [])
  const busSubs = subs.filter(s => s.package === 450 || s.package === 550)

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">مستخدمو الباص</div><div className="strip-val">{busSubs.length}</div></div>
        <div className="strip-item"><div className="strip-label">إيراد الباص</div><div className="strip-val" style={{ color: 'var(--green)' }}>{fmt(busSubs.length * 150)} ر</div></div>
      </div>
      <div className="sec">قائمة الباص</div>
      <div className="card">
        {busSubs.length === 0 ? <div className="empty"><div className="empty-icon">🚌</div>لا يوجد مشتركون بالباص</div> :
          busSubs.map((s, i) => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-blue">{s.name[0]}</div>
                <div><div className="list-name">{s.name}</div><div className="list-sub">مشترك بالباص</div></div>
              </div>
              <span className="badge badge-b">150 ر</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ============ ADMIN INVENTORY ============
function AdminInventory({ toast }) {
  const [inventory, setInventory] = useState([])
  const [sales, setSales] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ item: 'زي الأكاديمية', qty: 1, price: 0, payment: 'نقدي', receiptUrl: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const [inv, s] = await Promise.all([
      supabase.from('inventory').select('*').order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setInventory(inv.data || [])
    setSales(s.data || [])
  }
  useEffect(() => { load() }, [])

  async function submit() {
    if (!form.price) { alert('أدخل السعر'); return }
    if (form.payment !== 'نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const { error } = await supabase.from('sales').insert({ item: form.item, qty: form.qty, price: form.price, total: form.qty * form.price, payment_method: form.payment, has_receipt: form.payment !== 'نقدي', receipt_url: form.receiptUrl || null, created_by: 'مدير الشؤون الإدارية' })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); return }
    toast('✅ تم تسجيل البيع بنجاح', 'success')
    setModal(false)
    load()
  }

  return (
    <div className="page">
      <div className="store-grid">
        {inventory.map(item => (
          <div key={item.id} className="store-card">
            <div className="store-icon-wrap">{item.icon || '📦'}</div>
            <div className="store-info">
              <div className="store-name">{item.name}</div>
              <div className="store-price">{item.price} ر</div>
              <div className="store-stock">متبقي: {item.stock} · مباع: {item.sold}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="sec">سجل المبيعات</div>
      <div className="card">
        {sales.length === 0 ? <div className="empty"><div className="empty-icon">🛍️</div>لا يوجد مبيعات</div> :
          sales.map(s => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-green">🛍</div>
                <div>
                  <div className="list-name">{s.item}</div>
                  <div className="list-sub">{s.qty} قطعة · {s.payment_method} · {s.created_at?.slice(0, 10)}</div>
                  {s.receipt_url && <a href={s.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
              </div>
              <span className="badge badge-g">{fmt(s.total)} ر</span>
            </div>
          ))}
      </div>

      <button className="fab" onClick={() => setModal(true)}>🛍️</button>

      <Modal open={modal} onClose={() => setModal(false)} title="تسجيل بيع">
        <div className="form-group">
          <label className="form-label">الصنف</label>
          <select className="form-select" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}>
            {['زي الأكاديمية', 'جوارب', 'مياه', 'كرة تدريب', 'شورت', 'أخرى'].map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">الكمية</label><input className="form-input" type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseInt(e.target.value) || 1 }))} /></div>
          <div className="form-group"><label className="form-label">السعر (ر)</label><input className="form-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} /></div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f => ({ ...f, payment: v, receiptUrl: '' }))} /></div>
        {form.payment !== 'نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="sales" onUploaded={url => setForm(f => ({ ...f, receiptUrl: url }))} />}
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'جاري الحفظ...' : 'تسجيل البيع'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ EXPENSES PAGE (ADMIN + FIELDS) ============
function ExpensesPage({ role, toast }) {
  const [month, setMonth] = useState('2026-09')
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ cat: '', desc: '', amount: '', date: new Date().toISOString().slice(0, 10), payment: 'نقدي', receiptUrl: '' })
  const [submitting, setSubmitting] = useState(false)
  const by = ROLES[role]?.label

  async function load(m) {
    const [p, a] = await Promise.all([
      supabase.from('expenses').select('*').eq('status', 'pending').eq('submitted_by', by).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('status', 'approved').gte('date', m + '-01').lte('date', monthEnd(m)).order('date', { ascending: false }),
    ])
    setPending(p.data || [])
    setApproved(a.data || [])
  }
  useEffect(() => { load(month) }, [month])

  async function submit() {
    if (!form.cat || !form.desc || !form.amount) { alert('أكمل جميع الحقول واختر التصنيف'); return }
    if (form.payment !== 'نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const { error } = await supabase.from('expenses').insert({ category: form.cat, description: form.desc, amount: parseFloat(form.amount), date: form.date, payment_method: form.payment, has_receipt: form.payment !== 'نقدي', receipt_url: form.receiptUrl || null, status: 'pending', submitted_by: by })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); return }
    toast('✅ تم إرسال المصروف للموافقة', 'success')
    setModal(false)
    setForm({ cat: '', desc: '', amount: '', date: new Date().toISOString().slice(0, 10), payment: 'نقدي', receiptUrl: '' })
    load(month)
  }

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => { setMonth(e.target.value); load(e.target.value) }}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">معلق</div><div className="strip-val" style={{ color: 'var(--red)' }}>{pending.length}</div></div>
        <div className="strip-item"><div className="strip-label">معتمد</div><div className="strip-val" style={{ color: 'var(--green)' }}>{approved.length}</div></div>
      </div>
      <div className="info-box info-yellow">⚠️ كل المصاريف تحتاج موافقة المالك قبل الاعتماد</div>

      <div className="sec">مصاريفي المعلقة</div>
      {pending.length === 0 ? <div className="empty"><div className="empty-icon">✅</div>لا يوجد مصاريف معلقة</div> :
        pending.map(a => (
          <div key={a.id} className="approval-card">
            <div className="approval-head"><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)' }}>{a.category}</span><span className="badge badge-o">معلق</span></div>
            <div className="approval-body">
              <div className="approval-desc">{a.description}</div>
              <div className="approval-meta">{a.date} · {fmt(a.amount)} ر · {a.payment_method}</div>
              {a.receipt_url && <a href={a.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
            </div>
          </div>
        ))}

      <div className="sec">المصاريف المعتمدة</div>
      <div className="card">
        {approved.length === 0 ? <div className="empty"><div className="empty-icon">📁</div>لا يوجد مصاريف معتمدة</div> :
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

      <button className="fab" onClick={() => setModal(true)}>💸</button>

      <Modal open={modal} onClose={() => setModal(false)} title="تسجيل مصروف">
        <div className="form-group">
          <label className="form-label">التصنيف</label>
          <div className="cat-grid">
            {[['رواتب','👤'],['كهرباء','⚡'],['إنترنت','🌐'],['ماء فاتورة','🚰'],['مياه مخزون','💧'],['صيانة','🔧'],['محامي','⚖️'],['تأمينات','🛡️'],['باص','🚌'],['أخرى','📦']].map(([c, ic]) => (
              <button key={c} className={`cat-btn ${form.cat === c ? 'cat-selected' : ''}`} onClick={() => setForm(f => ({ ...f, cat: c }))}>{ic} {c}</button>
            ))}
          </div>
        </div>
        <div className="form-group"><label className="form-label">الوصف</label><input className="form-input" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="وصف المصروف" /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">المبلغ (ر)</label><input className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">التاريخ</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f => ({ ...f, payment: v, receiptUrl: '' }))} /></div>
        {form.payment !== 'نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="expenses" onUploaded={url => setForm(f => ({ ...f, receiptUrl: url }))} />}
        <div className="info-box info-yellow" style={{ marginTop: '.75rem' }}>⚠️ سيتم إرسال هذا المصروف للمالك للموافقة</div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'جاري الإرسال...' : 'إرسال للموافقة'}</button>
        <button className="btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ FIELDS CALENDAR ============
function FieldsCal({ toast }) {
  const [bookings, setBookings] = useState([])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(false)
  const [pitch, setPitch] = useState('small')
  const [water, setWater] = useState(false)
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), time: '', payment: 'نقدي', receiptUrl: '' })
  const [submitting, setSubmitting] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  async function load() {
    const { data } = await supabase.from('bookings').select('*').order('date', { ascending: false })
    setBookings(data || [])
  }
  useEffect(() => { load() }, [])

  async function submit() {
    if (!form.name.trim()) { alert('أدخل اسم الحاجز'); return }
    if (form.payment !== 'نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    const base = pitch === 'small' ? 250 : 300
    const amount = base + (water ? 20 : 0)
    setSubmitting(true)
    const { error } = await supabase.from('bookings').insert({ pitch, booker_name: form.name, date: form.date, time: form.time, water, amount, payment_method: form.payment, has_receipt: form.payment !== 'نقدي', receipt_url: form.receiptUrl || null, created_by: 'مسؤول الملاعب' })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); return }
    toast('✅ تم تسجيل الحجز بنجاح', 'success')
    setModal(false)
    setForm({ name: '', date: today, time: '', payment: 'نقدي', receiptUrl: '' })
    setWater(false)
    load()
  }

  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const dayNames = ['ح','ن','ث','ر','خ','ج','س']
  const monthBks = bookings.filter(b => b.date?.startsWith(today.slice(0, 7)))
  const todayRev = bookings.filter(b => b.date === today).reduce((a, b) => a + Number(b.amount), 0)
  const monthRev = monthBks.reduce((a, b) => a + Number(b.amount), 0)

  function renderCal() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const daysInPrev = new Date(calYear, calMonth, 0).getDate()
    const startDay = (firstDay + 1) % 7
    const cells = []
    for (let i = 0; i < startDay; i++) cells.push({ day: daysInPrev - startDay + i + 1, other: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateStr, isToday: dateStr === today, bookings: bookings.filter(b => b.date === dateStr) })
    }
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) cells.push({ day: i, other: true })
    return cells
  }

  const todayBks = selectedDate ? bookings.filter(b => b.date === selectedDate) : []
  const base = pitch === 'small' ? 250 : 300

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">حجوزات اليوم</div><div className="strip-val">{bookings.filter(b => b.date === today).length}</div></div>
        <div className="strip-item"><div className="strip-label">إيراد اليوم</div><div className="strip-val" style={{ color: 'var(--green)' }}>{fmt(todayRev)} ر</div></div>
        <div className="strip-item"><div className="strip-label">إيراد الشهر</div><div className="strip-val" style={{ color: 'var(--green)' }}>{fmt(monthRev)} ر</div></div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="cal-header">
          <button className="cal-nav" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}>›</button>
          <span className="cal-title">{monthNames[calMonth]} {calYear}</span>
          <button className="cal-nav" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}>‹</button>
        </div>
        <div className="cal-grid">
          {dayNames.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          {renderCal().map((cell, i) => (
            <div key={i} className={`cal-cell ${cell.other ? 'cal-other' : ''} ${cell.isToday ? 'cal-today' : ''}`} onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}>
              <div className="cal-date">{cell.day}</div>
              {(cell.bookings || []).map((b, j) => (
                <div key={j} className={`cal-booking ${b.pitch === 'big' ? 'cal-booking-big' : ''}`}>{b.time} {b.pitch === 'small' ? 'ص' : 'ك'}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="sec">حجوزات {selectedDate || 'اليوم المحدد'}</div>
      <div className="card">
        {!selectedDate ? <div className="empty"><div className="empty-icon">📅</div>اختر يوماً من التقويم</div> :
          todayBks.length === 0 ? <div className="empty"><div className="empty-icon">📅</div>لا يوجد حجوزات</div> :
            todayBks.map(b => (
              <div key={b.id} className="list-row">
                <div className="list-left">
                  <div className={`list-av ${b.pitch === 'small' ? 'list-av-blue' : 'list-av-red'}`}>{b.pitch === 'small' ? 'ص' : 'ك'}</div>
                  <div>
                    <div className="list-name">{b.booker_name}</div>
                    <div className="list-sub">{b.pitch === 'small' ? 'ملعب صغير' : 'ملعب كبير'} · {b.time} · {b.payment_method}{b.water ? ' · مياه' : ''}</div>
                    {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                  </div>
                </div>
                <span className={`badge ${b.pitch === 'small' ? 'badge-b' : 'badge-r'}`}>{fmt(b.amount)} ر</span>
              </div>
            ))}
      </div>

      <button className="fab" onClick={() => setModal(true)}>📅</button>

      <Modal open={modal} onClose={() => setModal(false)} title="حجز ملعب جديد">
        <div className="form-group">
          <label className="form-label">اختر الملعب</label>
          <div className="pitch-grid">
            <div className={`pitch-card ${pitch === 'small' ? 'pitch-selected' : ''}`} onClick={() => setPitch('small')}>
              <div className="pitch-name">ملعب صغير</div>
              <div className="pitch-price">250 ر</div>
              <div className="pitch-sub">2 ساعات</div>
            </div>
            <div className={`pitch-card ${pitch === 'big' ? 'pitch-selected' : ''}`} onClick={() => setPitch('big')}>
              <div className="pitch-name">ملعب كبير</div>
              <div className="pitch-price">300 ر</div>
              <div className="pitch-sub">2 ساعات</div>
            </div>
          </div>
        </div>
        <div className="form-group"><label className="form-label">اسم الحاجز</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الشخص أو الفريق" /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">التاريخ</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">وقت البداية</label><input className="form-input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
        </div>
        <div className="form-group">
          <label className="form-label">إضافات</label>
          <div className="water-toggle" onClick={() => setWater(w => !w)}>
            <div className="water-toggle-left">
              <span style={{ fontSize: 20 }}>💧</span>
              <div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>صندوق مياه</div><div style={{ fontSize: 12, color: 'var(--t3)' }}>+20 ر</div></div>
            </div>
            <div className={`toggle-switch ${water ? 'toggle-on' : ''}`} />
          </div>
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.payment} onChange={v => setForm(f => ({ ...f, payment: v, receiptUrl: '' }))} /></div>
        {form.payment !== 'نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="bookings" onUploaded={url => setForm(f => ({ ...f, receiptUrl: url }))} />}
        <div className="form-group">
          <label className="form-label">الإجمالي</label>
          <input className="form-input" readOnly value={fmt(base + (water ? 20 : 0)) + ' ر'} style={{ fontWeight: 700, color: 'var(--red)' }} />
        </div>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'جاري الحفظ...' : 'تسجيل الحجز'}</button>
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

  function showToast(msg, type = 'success') {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => setToastMsg(''), 2500)
  }

  function login(r) {
    setRole(r)
    const firstTab = { owner: 'dashboard', admin: 'admin-subs', fields: 'fields-cal' }
    setActiveTab(firstTab[r])
  }

  function logout() {
    setRole(null)
    setActiveTab(null)
  }

  useEffect(() => {
    if (role === 'owner') {
      supabase.from('expenses').select('id', { count: 'exact' }).eq('status', 'pending').then(({ count }) => setPendingCount(count || 0))
    }
  }, [role, activeTab])

  if (!role) return <LoginPage onLogin={login} />

  const renderPage = () => {
    if (role === 'owner') {
      if (activeTab === 'dashboard') return <OwnerDashboard toast={showToast} />
      if (activeTab === 'academy') return <OwnerAcademy toast={showToast} />
      if (activeTab === 'fields') return <OwnerFields toast={showToast} />
      if (activeTab === 'expenses') return <OwnerExpenses toast={showToast} />
    }
    if (role === 'admin') {
      if (activeTab === 'admin-subs') return <AdminSubs toast={showToast} />
      if (activeTab === 'admin-bus') return <AdminBus toast={showToast} />
      if (activeTab === 'admin-inventory') return <AdminInventory toast={showToast} />
      if (activeTab === 'admin-expenses') return <ExpensesPage role="admin" toast={showToast} />
    }
    if (role === 'fields') {
      if (activeTab === 'fields-cal') return <FieldsCal toast={showToast} />
      if (activeTab === 'fields-expenses') return <ExpensesPage role="fields" toast={showToast} />
    }
    return null
  }

  return (
    <>
      <Banner role={role} onLogout={logout} />
      {renderPage()}
      <BottomNav role={role} active={activeTab} setActive={setActiveTab} pendingCount={pendingCount} />
      <Toast msg={toastMsg} type={toastType} />
    </>
  )
}
