'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, todayStr, shiftDay, applyClosing, AGE_GROUPS, approveRecord, returnRecord, cancelRecord, correctSubscription, subscriptionFlags, subscriptionFlagItems, markFlagsReviewed, FLAG_LABELS, FLAG_ORDER, addDaysStr, PINS, ROLES, BRANCHES, MONTHS, EXP_CATS, EXP_COLORS, monthEnd, fmt, uploadReceipt, subStatus, daysBetween, PKG3_PRICE, bumpPaid, splitPayment, insertInitialPayments, fetchRevenue } from '../lib/supabase'

const TODAY = todayStr()
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

function BottomNav({ role, active, setActive, pendingCount, badges }) {
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
          {(badges?.[t.id]||0)>0 && <span className="nav-notif">{badges[t.id]}</span>}
        </button>
      ))}
    </nav>
  )
}

function Modal({ open, onClose, title, children }) {
  // while a popup is open the page behind it must not scroll, or the wheel moves the page instead of the popup
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        {/* the title stays visible while a long form scrolls */}
        <div style={{ position:'sticky', top:'-1.5rem', zIndex:2, background:'var(--surface)', margin:'-1.5rem -1.5rem 1rem', padding:'1.5rem 1.5rem .75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div className="modal-title" style={{ margin:0 }}>{title}</div>
          <button onClick={onClose} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:16, color:'var(--t2)', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ActionBtns({ onEdit, onDelete, small=false }) {
  const s = small ? { fontSize:10, padding:'2px 8px', borderRadius:5 } : { fontSize:11, padding:'4px 10px', borderRadius:6 }
  return (
    <div style={{ display:'flex', gap:4, marginTop:3 }}>
      {onEdit && <button onClick={onEdit} style={{ ...s, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--t2)', cursor:'pointer', fontFamily:'inherit' }}>تعديل</button>}
      {onDelete && <button onClick={onDelete} style={{ ...s, background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit' }}>حذف</button>}
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

function ReceiptUpload({ label, folder, onUploaded, current }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()
  async function handleChange(e) {
    const f = e.target.files[0]; if (!f) return
    setFile(f); setUploading(true)
    try { const url = await uploadReceipt(f, folder); onUploaded(url) } catch(err) { console.error(err) }
    setUploading(false)
  }
  const has = !!file || !!current
  return (
    <div className="form-group">
      <label className="form-label">{label} <span style={{ color:'var(--red)' }}>*</span></label>
      <div className={`receipt-wrap ${has?'receipt-has-file':''}`} onClick={() => inputRef.current?.click()}>
        <div className="receipt-icon">📎</div>
        <div className={`receipt-text ${has?'receipt-text-green':''}`}>{uploading?'جاري الرفع...':file?'✅ '+file.name:current?'✅ إيصال محفوظ · اضغط للاستبدال':'اضغط لرفع الإيصال'}</div>
        <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleChange}/>
      </div>
      <div className="receipt-note">⚠️ الإيصال مطلوب للدفع غير النقدي</div>
    </div>
  )
}

// ============ PRICING HELPERS ============
function calcEnd(start, months) {
  if (!start || !months) return ''
  const d = new Date(start)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}
function calcMonths(start, end) {
  if (!start || !end) return 1
  const s = new Date(start), e = new Date(end)
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  return Math.max(1, Math.round(diff))
}
function applyDiscount(price, pct) { return Math.round(price * (1 - pct / 100)) }
// the final price is typed by hand; left empty it falls back to the normal price
function finalAmount(base, override) {
  if (override !== '' && override !== null && override !== undefined && !isNaN(Number(override))) return Math.max(0, Math.round(Number(override)))
  return Math.round(Number(base) || 0)
}
const blankPricing = {
  type:'individual', members:1, months:1,
  subOverride:'', includeKit:false, kitOverride:'', kitQty:1,
  includeBus:false, busPrice:150, busMonths:1, busOverride:'',
  kitItem:'طقم صيفي (جيرسي + شورت)', isPkg:false, cashAmt:0, networkAmt:0, transferAmt:0, networkReceipt:'', transferReceipt:'',
  ages:[], players:[{ name:'', ages:[] }]
}
function famCount(f) { return f.type === 'family' ? Math.max(1, Number(f.members) || 1) : 1 }
// how many kits: one for an individual; for a family the number typed, never more than the members
function kitCount(f) { return !f.includeKit ? 0 : f.type === 'family' ? Math.max(1, Math.min(Number(f.kitQty) || 1, famCount(f))) : 1 }
// one section per family member, keeping what was already typed
function syncPlayers(list, n) { const out = []; for (let i = 0; i < n; i++) out.push((list || [])[i] || { name: '', ages: [] }); return out }
const clampMembers = v => Math.max(0, Math.min(12, parseInt(v) || 0))
// a family is saved under its players' names, so searching any of them finds the family
function subName(f) { return f.type === 'family' ? (f.players || []).map(p => (p.name || '').trim()).filter(Boolean).join(' و ') : (f.name || '').trim() }
function playersOf(f) { return f.type === 'family' ? (f.players || []).map(p => ({ name: (p.name || '').trim(), ages: p.ages || [] })) : [{ name: (f.name || '').trim(), ages: f.ages || [] }] }
// the price follows the number of months (and family members), never the typed dates
function subTotals(f) {
  const months = Math.max(1, Number(f.months) || 1)
  const subBase = (f.isPkg && months === 3 ? PKG3_PRICE : 300 * months) * famCount(f)
  const subFinal = finalAmount(subBase, f.subOverride)
  const kitBase = kitCount(f) * (f.kitItem === 'طقم شتوي' ? 120 : 100)
  const kitFinal = f.includeKit ? finalAmount(kitBase, f.kitOverride) : 0
  const busBase = f.includeBus ? Number(f.busPrice || 0) * Number(f.busMonths || 1) : 0
  const busFinal = f.includeBus ? finalAmount(busBase, f.busOverride) : 0
  const total = subFinal + kitFinal + busFinal
  const base = subBase + kitBase + busBase
  return { months, kitQty: kitCount(f), subBase, subFinal, kitBase, kitFinal, busBase, busFinal, total, discountGiven: Math.max(0, base - total) }
}
function calcTotal(f) { return subTotals(f).total }

// rebuild the add form from a returned subscription so it can be fixed and sent again
function formFromSub(r, pays) {
  const members = Number(r.members_count) || 1
  const months = Number(r.months) || calcMonths(r.start_date, r.end_date)
  const pl = Array.isArray(r.players) ? r.players.map(p => ({ name: p.name || '', ages: p.ages || [] })) : []
  const fam = r.type === 'family'
  const f = { ...blankPricing, name: r.name, phone: r.guardian_phone || '', type: fam ? 'family' : 'individual', members, months,
    ages: fam ? [] : (pl[0]?.ages || []), players: fam ? syncPlayers(pl, members) : [{ name: '', ages: [] }],
    startDate: r.start_date || TODAY, endDate: r.end_date || calcEnd(r.start_date || TODAY, months),
    isPkg: months === 3 && Number(r.sub_amount) === PKG3_PRICE * members }
  f.subOverride = Number(r.sub_amount) !== subTotals(f).subBase ? String(r.sub_amount) : ''
  if (r.has_kit && r.kit_item) {
    f.includeKit = true; f.kitItem = r.kit_item; f.kitQty = Number(r.kit_qty) || 1
    f.kitOverride = Number(r.kit_amount) !== kitCount(f) * (r.kit_item === 'طقم شتوي' ? 120 : 100) ? String(r.kit_amount) : ''
  }
  if (Number(r.bus_amount) > 0) {
    f.includeBus = true; f.busPrice = Number(r.bus_price_per_month) || 150; f.busMonths = Number(r.bus_months) || 1
    f.busOverride = Number(r.bus_amount) !== f.busPrice * f.busMonths ? String(r.bus_amount) : ''
  }
  const sum = m => (pays || []).filter(p => p.method === m).reduce((a, p) => a + Number(p.amount), 0)
  f.cashAmt = sum('نقدي'); f.networkAmt = sum('شبكة'); f.transferAmt = sum('تحويل')
  f.networkReceipt = (pays || []).find(p => p.method === 'شبكة')?.receipt_url || ''
  f.transferReceipt = (pays || []).find(p => p.method === 'تحويل')?.receipt_url || ''
  return f
}

// newest first: by start date, then by when the record was entered
function newestFirst(a, b) {
  const da = a.start_date || '', db = b.start_date || ''
  if (da !== db) return da < db ? 1 : -1
  return String(b.created_at || '').localeCompare(String(a.created_at || ''))
}
function busNewest(a, b) {
  const da = a.bus_start_date || a.start_date || '', db = b.bus_start_date || b.start_date || ''
  if (da !== db) return da < db ? 1 : -1
  return String(b.created_at || '').localeCompare(String(a.created_at || ''))
}

// ============ INVENTORY (sized) ============
const INV_ORDER = ['طقم صيفي (جيرسي + شورت)', 'طقم شتوي', 'جوارب', 'حقيبة', 'حقيبة + جوارب', 'مياه']
function invUnit(name) { return name === 'جوارب' ? 'زوج' : name === 'مياه' ? 'صندوق' : 'قطعة' }
function groupInventory(items) {
  const map = {}
  items.forEach(i => {
    if (!map[i.name]) map[i.name] = { name: i.name, icon: i.icon, price: i.price, rows: [] }
    map[i.name].rows.push(i)
  })
  const groups = Object.values(map)
  groups.forEach(g => {
    g.rows.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99))
    g.stock = g.rows.reduce((a, r) => a + Number(r.stock || 0), 0)
    g.sold = g.rows.reduce((a, r) => a + Number(r.sold || 0), 0)
    g.sized = g.rows.some(r => r.size)
  })
  // the bag + socks bundle has no stock of its own: it is limited by the bag and the socks
  const bundle = map['حقيبة + جوارب']
  if (bundle) {
    bundle.derived = true
    bundle.bagStock = map['حقيبة']?.stock ?? 0
    bundle.socksStock = map['جوارب']?.stock ?? 0
    bundle.stock = Math.min(bundle.bagStock, bundle.socksStock)
  }
  return groups.sort((a, b) => {
    const ai = INV_ORDER.indexOf(a.name), bi = INV_ORDER.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

function InventoryGrid({ items, onSale, showSold }) {
  const groups = groupInventory(items)
  return (
    <>
      {groups.map(g => (
        <div key={g.name} className="card" style={{ marginBottom: '.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.75rem 1rem' }}>
            <div style={{ fontSize: 28 }}>{g.icon || '📦'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="list-name">{g.name}</div>
              <div className="list-sub">{g.price} ⃁ · <span style={{ color: g.stock <= 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>متبقي {g.stock} {invUnit(g.name)}</span>{showSold ? ` · مباع في الشهر ${g.sold}` : ''}</div>
            {g.derived && <div className="list-sub" style={{ marginTop: 2 }}>حقيبة {g.bagStock} · جوارب {g.socksStock} زوج · يتاح منها {g.stock} باقة</div>}
            </div>
            {onSale && <button onClick={() => onSale(g)} style={{ fontSize: 11, background: 'var(--green-l)', border: '1px solid var(--green)', borderRadius: 6, padding: '5px 12px', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>تسجيل بيع</button>}
          </div>
          {g.sized && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 1rem .75rem' }}>
              {g.rows.map(r => (
                <span key={r.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, border: '1px solid var(--border)',
                  background: r.stock <= 0 ? 'var(--red-l)' : r.stock <= 3 ? 'var(--orange-l)' : 'var(--surface2)',
                  color: r.stock <= 0 ? 'var(--red)' : r.stock <= 3 ? 'var(--orange)' : 'var(--t2)' }}>
                  {r.size}: {r.stock}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ============ LATER PAYMENT (partial payments) ============
function PaymentModal({ target, onClose, toast, onDone, createdBy }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('نقدي')
  const [receipt, setReceipt] = useState('')
  const [busy, setBusy] = useState(false)
  const rec = target?.rec
  const type = target?.type
  const resend = target?.resend            // a returned payment being fixed and sent again
  const balance = Number(rec?.balance || 0)
  const name = type === 'subscriber' ? rec?.name : type === 'booking' ? rec?.booker_name : (rec?.subscriber_name || rec?.item)
  useEffect(() => {
    if (target) {
      setAmount(String(resend ? resend.amount : Number(target.rec.balance || 0)))
      setMethod(resend ? resend.method : 'نقدي'); setReceipt(resend ? (resend.receipt_url || '') : '')
    }
  }, [target])
  async function save() {
    const a = Number(amount)
    if (!(a > 0)) { alert('أدخل مبلغاً صحيحاً'); return }
    if (a > balance) { alert('المبلغ أكبر من المتبقي'); return }
    if (method !== 'نقدي' && !receipt) { alert('يجب رفع الإيصال'); return }
    setBusy(true)
    const isBus = resend?.note === 'باص'
    const split = isBus ? { pass_amount: a, kit_part: 0 } : type === 'subscriber' ? splitPayment(rec, a) : { pass_amount: 0, kit_part: 0 }
    let error = null
    if (resend) {
      const r = await supabase.from('payments').update({ amount: a, method, receipt_url: receipt || null, status: 'pending', return_reason: null, returned_at: null, ...split }).eq('id', resend.id)
      error = r.error
    } else {
      const r = await supabase.from('payments').insert({
        branch: rec.branch, record_type: type, record_id: String(rec.id), amount: a, method,
        receipt_url: receipt || null, paid_at: TODAY, status: 'pending', kind: 'later',
        label: name, created_by: createdBy, ...split
      })
      error = r.error
    }
    if (!error) await bumpPaid(type, rec.id, a)
    setBusy(false)
    if (error) { toast('خطأ في الحفظ', 'error'); console.error(error); return }
    toast(resend ? '✅ أُعيدت الدفعة للمالك' : '✅ تم تسجيل الدفعة وإرسالها للمالك', 'success'); onDone(); onClose()
  }
  return (
    <Modal open={!!target} onClose={onClose} title={`${resend ? 'تعديل الدفعة' : 'تسجيل دفعة'}: ${name || ''}`}>
      {resend?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {resend.return_reason}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: '.75rem' }}>
        <span style={{ color: 'var(--t3)' }}>المدفوع: {fmt(Number(type === 'booking' ? rec?.collected : rec?.paid_amount) || 0)} ⃁</span>
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>المتبقي: {fmt(balance)} ⃁</span>
      </div>
      <div className="form-group"><label className="form-label">مبلغ الدفعة (⃁)</label><input className="form-input" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={method} onChange={v => { setMethod(v); setReceipt('') }} /></div>
      {method !== 'نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="payments" current={receipt} onUploaded={setReceipt} />}
      <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ...' : resend ? 'إعادة الإرسال للمالك' : 'تسجيل الدفعة'}</button>
      <button className="btn-secondary" onClick={onClose}>إلغاء</button>
    </Modal>
  )
}

// ============ SUBSCRIBER HISTORY ============
function SubscriberDetail({ sub, onClose }) {
  const [periods, setPeriods] = useState([])
  const [sales, setSales] = useState([])
  const [pays, setPays] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!sub) return
    let alive = true
    async function load() {
      setLoading(true)
      const mid = sub.member_id || String(sub.id)
      const { data: per } = await supabase.from('subscribers').select('*').eq('member_id', mid).order('start_date', { ascending: false })
      const rows = (per && per.length) ? per : [sub]
      const ids = rows.map(r => String(r.id))
      const [sl, py] = await Promise.all([
        supabase.from('sales').select('*').in('subscriber_id', ids).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('record_type', 'subscriber').in('record_id', ids).neq('status', 'rejected').order('paid_at', { ascending: false }),
      ])
      if (!alive) return
      setPeriods(rows); setSales(sl.data || []); setPays(py.data || []); setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [sub])
  const livePeriods = periods.filter(p => p.status === 'approved' || p.status === 'pending')
  const liveSales = sales.filter(s => s.status === 'approved' || s.status === 'pending')
  const paidTotal = livePeriods.reduce((a, p) => a + Number(p.paid_amount || 0), 0) + liveSales.reduce((a, s) => a + Number(s.paid_amount || 0), 0)
  const balTotal = livePeriods.reduce((a, p) => a + Number(p.balance || 0), 0) + liveSales.reduce((a, s) => a + Number(s.balance || 0), 0)
  return (
    <Modal open={!!sub} onClose={onClose} title={sub?.name || ''}>
      {sub?.guardian_phone && <div className="list-sub" style={{ marginBottom: '.5rem' }}>📞 {sub.guardian_phone}</div>}
      {Array.isArray(sub?.players) && sub.players.some(p => p.name) && (
        <div style={{ marginBottom: '.6rem' }}>
          {sub.players.map((p, i) => <div key={i} className="list-sub">{p.name}{p.ages?.length ? ` · ${p.ages.join('، ')}` : ''}</div>)}
        </div>
      )}
      {loading ? <div className="loading">جاري التحميل...</div> : (
        <>
          <div className="summary-strip">
            <div className="strip-item"><div className="strip-label">إجمالي المدفوع</div><div className="strip-val" style={{ color: 'var(--green)' }}>{fmt(paidTotal)} ⃁</div></div>
            <div className="strip-item"><div className="strip-label">المتبقي</div><div className="strip-val" style={{ color: balTotal > 0 ? 'var(--red)' : 'var(--t1)' }}>{fmt(balTotal)} ⃁</div></div>
            <div className="strip-item"><div className="strip-label">فترات الاشتراك</div><div className="strip-val">{livePeriods.length}</div></div>
          </div>
          <div className="sec">الاشتراكات</div>
          <div className="card">
            {periods.map(p => (
              <div key={p.id} className="list-row">
                <div>
                  <div className="list-name">{p.start_date || '؟'} ← {p.end_date || '؟'}</div>
                  <div className="list-sub">{fmt(p.total_amount)} ⃁{p.has_kit ? (Number(p.kit_qty || 1) > 1 ? ` · طقم × ${p.kit_qty}` : ' · طقم') : ''}{p.has_bus ? ' · باص' : ''}{Number(p.balance) > 0 ? ` · متبقي ${fmt(p.balance)} ⃁` : ''}</div>
                </div>
                <span className={`badge ${p.status === 'approved' ? 'badge-g' : p.status === 'pending' || p.status === 'returned' ? 'badge-o' : 'badge-r'}`} style={{ fontSize: 9 }}>{p.status === 'approved' ? 'معتمد' : p.status === 'pending' ? 'معلق' : p.status === 'returned' ? 'أُعيد للتعديل' : p.status === 'cancelled' ? 'ملغي' : 'مرفوض'}</span>
              </div>
            ))}
          </div>
          <div className="sec">المشتريات</div>
          <div className="card">
            {sales.length === 0 ? <div className="empty" style={{ padding: '1rem' }}>لا توجد مشتريات</div> : sales.map(s => (
              <div key={s.id} className="list-row">
                <div>
                  <div className="list-name">{s.item}{s.size ? ` · مقاس ${s.size}` : ''} × {s.qty}</div>
                  <div className="list-sub">{s.created_at?.slice(0, 10)}{Number(s.balance) > 0 ? ` · متبقي ${fmt(s.balance)} ⃁` : ''}</div>
                </div>
                <span className={`badge ${s.status === 'pending' ? 'badge-o' : 'badge-g'}`}>{fmt(s.total)} ⃁</span>
              </div>
            ))}
          </div>
          <div className="sec">الدفعات</div>
          <div className="card">
            {pays.length === 0 ? <div className="empty" style={{ padding: '1rem' }}>لا توجد دفعات</div> : pays.map(p => (
              <div key={p.id} className="list-row">
                <div>
                  <div className="list-name">{fmt(p.amount)} ⃁ · {p.method}{p.note ? ` · ${p.note}` : ''}</div>
                  <div className="list-sub">{p.paid_at}{p.receipt_url ? '' : ''}</div>
                  {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
                {p.status !== 'approved' && <span className="badge badge-o" style={{ fontSize: 9 }}>{p.status === 'pending' ? 'معلق' : p.status === 'returned' ? 'أُعيد' : p.status === 'cancelled' ? 'ملغي' : p.status}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

// ============ APPROVAL, RETURN AND CANCEL COMPONENTS ============
const MONTH_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
function fmtDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${d.getDate()} ${MONTH_AR[d.getMonth()]}`
}
const methodIcon = m => m === 'نقدي' ? '💵' : m === 'شبكة' ? '💳' : m === 'تحويل' ? '📱' : '💰'
const KIND_LABEL = { subscriber: 'اشتراك', booking: 'حجز', sale: 'بيع' }

// one place that words every record type the same way (pending cards and the archive)
function describeRecord(type, r) {
  if (type === 'subscriber') return {
    _label: r.renewal_of ? 'تجديد اشتراك' : 'اشتراك جديد', _amount: r.total_amount, _paid: r.paid_amount,
    _desc: r.name + (r.type === 'family' ? ` · عائلة ${r.members_count || ''} أفراد` : ''), _by: r.created_by,
    _meta: `${r.start_date || ''} ← ${r.end_date || ''}${r.guardian_phone ? ' · ' + r.guardian_phone : ''}`,
  }
  if (type === 'booking') return {
    _label: 'حجز ملعب', _amount: r.amount, _paid: r.collected, _desc: r.booker_name, _by: r.created_by,
    _meta: `${r.pitch === 'small' ? 'ملعب صغير' : 'ملعب كبير'} · ${r.date} · ${r.time || ''}${r.water ? ' · 💧' : ''}`,
  }
  if (type === 'sale') return {
    _label: 'بيع مستلزمات', _amount: r.total, _paid: r.paid_amount, _desc: r.item + (r.size ? ' · ' + r.size : '') + ` × ${r.qty}`, _by: r.created_by,
    _meta: `${r.subscriber_name ? r.subscriber_name + ' · ' : ''}${r.created_at ? r.created_at.slice(0, 10) : ''}`,
  }
  if (type === 'closing') return {
    _label: 'إقفال يوم', _amount: r.due, _paid: r.entered, _desc: `إقفال ${r.day}`, _by: r.created_by,
    _meta: `${(r.bookings || []).length} حجوزات${Number(r.expected_network) > 0 || Number(r.expected_transfer) > 0 ? ` · المسجّل عند الحجز: شبكة ${fmt(r.expected_network || 0)} ⃁ · تحويل ${fmt(r.expected_transfer || 0)} ⃁` : ''}`,
    _note: (r.bookings || []).map(b => b.name).join(' · '),
  }
  if (type === 'expense') return {
    _label: 'مصروف', _amount: r.amount, _desc: r.description, _by: r.submitted_by, _meta: `${r.category} · ${r.date}`,
  }
  return {
    _label: r.note === 'باص' ? 'دفعة باص' : r.note === 'عربون' ? 'عربون' : r.kind === 'correction' ? 'تصحيح' : 'دفعة', _amount: r.amount, _desc: r.label, _by: r.created_by,
    _meta: `${KIND_LABEL[r.record_type] || ''} · ${r.method} · ${r.paid_at}`,
  }
}

function ReasonModal({ open, title, hint, confirmLabel, tone, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setReason(''); setBusy(false) } }, [open])
  async function go() {
    if (!reason.trim()) { alert('اكتب السبب'); return }
    setBusy(true)
    await onConfirm(reason.trim())
    setBusy(false)
  }
  return (
    <Modal open={!!open} onClose={onClose} title={title}>
      {hint && <div className="info-box info-blue">{hint}</div>}
      <div className="form-group">
        <label className="form-label">السبب</label>
        <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="اكتب السبب هنا" />
      </div>
      <button className="btn-primary" disabled={busy} onClick={go} style={{ background: tone === 'danger' ? 'var(--red)' : 'var(--orange)' }}>{busy ? 'جاري الحفظ...' : confirmLabel}</button>
      <button className="btn-secondary" onClick={onClose}>رجوع</button>
    </Modal>
  )
}

// owner only: fix the total and the paid amount of an approved subscription, with a saved reason
function CorrectionModal({ rec, onClose, onDone, toast }) {
  const [total, setTotal] = useState('')
  const [paid, setPaid] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (rec) { setTotal(String(Number(rec.total_amount || 0))); setPaid(String(Number(rec.paid_amount || 0))); setReason('') } }, [rec])
  async function save() {
    const t = Number(total), p = Number(paid)
    if (isNaN(t) || t < 0 || isNaN(p) || p < 0) { alert('أدخل مبالغ صحيحة'); return }
    if (p > t) { alert('المدفوع أكبر من الإجمالي'); return }
    if (t === Number(rec.total_amount || 0) && p === Number(rec.paid_amount || 0)) { alert('لم تتغير أي قيمة'); return }
    if (!reason.trim()) { alert('اكتب سبب التصحيح'); return }
    setBusy(true)
    await correctSubscription(rec, t, p, reason.trim())
    setBusy(false)
    toast('✅ تم تصحيح المبلغ', 'success'); onDone(); onClose()
  }
  return (
    <Modal open={!!rec} onClose={onClose} title={`تصحيح المبلغ: ${rec?.name || ''}`}>
      <div className="info-box info-blue">يُصحَّح الإجمالي والمدفوع معاً، ويُحسب الفرق في شهر الدفعة الأصلية. يُحفظ السبب في سجل المشترك.</div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">الإجمالي الصحيح (⃁)</label><input className="form-input" type="number" min="0" value={total} onChange={e => setTotal(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">المدفوع الصحيح (⃁)</label><input className="form-input" type="number" min="0" value={paid} onChange={e => setPaid(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">سبب التصحيح</label><textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: الإيصال يظهر 750 والبطاقة 700" /></div>
      <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ...' : 'حفظ التصحيح'}</button>
      <button className="btn-secondary" onClick={onClose}>رجوع</button>
    </Modal>
  )
}

// how a record was paid: each payment with its method, amount and own receipt, then the totals
function PayBreakdown({ hasMoney, total, paid, pays, shortLabel = 'المتبقي' }) {
  const remaining = total - paid
  return (
    <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '.6rem .75rem', marginTop: 8 }}>
      {hasMoney && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--t2)' }}>الإجمالي <b style={{ color: 'var(--t1)' }}>{fmt(total)} ⃁</b></span>
          <span style={{ color: 'var(--t2)' }}>المدفوع <b style={{ color: 'var(--green)' }}>{fmt(paid)} ⃁</b></span>
        </div>
      )}
      {pays.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>لا توجد دفعات مسجلة</div>}
      {pays.map((p, i) => (
        <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: i ? '1px dashed var(--border)' : 'none' }}>
          <span style={{ fontSize: 12, color: 'var(--t1)' }}>{methodIcon(p.method)} {p.method}{p.note && p.note !== 'باص' ? ` (${p.note})` : ''}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <b style={{ fontSize: 13 }}>{fmt(p.amount)} ⃁</b>
            {p.receipt_url
              ? <a href={p.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>
              : p.method !== 'نقدي' ? <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>⚠️ بدون إيصال</span> : null}
          </span>
        </div>
      ))}
      {hasMoney && remaining > 0 && (
        <div style={{ marginTop: 8, background: 'var(--red-l)', border: '1px solid var(--red-m)', color: 'var(--red)', borderRadius: 6, padding: '5px 8px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          {shortLabel} {fmt(remaining)} ⃁
        </div>
      )}
      {hasMoney && remaining < 0 && (
        <div style={{ marginTop: 8, background: 'var(--orange-l)', border: '1px solid #fbbf24', color: 'var(--orange)', borderRadius: 6, padding: '5px 8px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
          زيادة {fmt(-remaining)} ⃁
        </div>
      )}
    </div>
  )
}

// the owner's approval card: how it was paid, the totals, every receipt, then two buttons only
function ApprovalCard({ item, onApprove, onReturn }) {
  const pays = item._pays || []
  const hasMoney = ['subscriber', 'booking', 'sale', 'closing'].includes(item._type)
  const total = Number(item._amount || 0)
  const paid = pays.length ? pays.reduce((a, p) => a + Number(p.amount || 0), 0) : Number(item._paid || 0)
  const remaining = total - paid
  const typeIcon = { subscriber: '👤', booking: '🏟️', sale: '🛍️', expense: '💸', payment: '💰', closing: '🧾' }[item._type]
  return (
    <div style={{ padding: '.9rem 1rem', borderBottom: '1px solid #fde68a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{typeIcon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{item._desc}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{item._meta}</div>
            {item._note && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{item._note}</div>}
            {item._by && <div style={{ fontSize: 10, color: 'var(--t3)' }}>بواسطة: {item._by}</div>}
          </div>
        </div>
        <span className="badge badge-o" style={{ fontSize: 10, flexShrink: 0 }}>{item._label}</span>
      </div>

      {item._flags && item._flags.length > 0 && (
        <div style={{ marginTop: 8, background: 'var(--orange-l)', border: '1px solid #fbbf24', borderRadius: 8, padding: '.4rem .6rem' }}>
          {item._flags.map(t => <div key={t} style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>⚠️ {t}</div>)}
        </div>
      )}

      <PayBreakdown hasMoney={hasMoney} total={total} paid={paid} pays={pays} shortLabel={item._type === 'closing' ? 'النقص' : 'المتبقي'} />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.1rem', paddingTop: '.9rem', borderTop: '1px solid #fcd34d' }}>
        <button onClick={() => onReturn(item)} style={{ flex: 1, padding: '.6rem', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: 'var(--orange)', border: '1.5px solid var(--orange)', borderRadius: 8, fontWeight: 600 }}>↩ إرجاع للتعديل</button>
        <button onClick={() => onApprove(item)} style={{ flex: 1, padding: '.6rem', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--green)', color: '#fff', border: '1.5px solid var(--green)', borderRadius: 8, fontWeight: 600 }}>✓ موافقة</button>
      </div>
    </div>
  )
}

// a collapsed list: only the count shows until it is opened
function ExpiringBox({ rows, onRenew, showSplit }) {
  const [open, setOpen] = useState(false)
  if (!rows.length) return null
  const week1 = rows.filter(s => daysBetween(TODAY, s.end_date) <= 7).length
  return (
    <div className="card" style={{ borderColor: 'var(--orange)', marginBottom: '.75rem' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '.7rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>⚠️ {rows.length} تنتهي اشتراكاتهم قريباً</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {showSplit && <><span className="badge badge-r" style={{ fontSize: 10 }}>هذا الأسبوع {week1}</span><span className="badge badge-o" style={{ fontSize: 10 }}>الأسبوع القادم {rows.length - week1}</span></>}
          <span style={{ color: 'var(--orange)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && rows.map(s => {
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
              <span className={`badge ${days <= 3 ? 'badge-r' : 'badge-o'}`} style={{ fontSize: 10 }}>{days === 0 ? 'اليوم' : `${days} أيام`}</span>
              {onRenew && <button onClick={() => onRenew(s)} style={{ fontSize: 10, background: 'var(--green-l)', border: '1px solid var(--green)', borderRadius: 6, padding: '3px 8px', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 3 }}>تجديد</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReturnedSection({ count, children }) {
  if (!count) return null
  return (
    <div style={{ marginBottom: '.75rem' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)', margin: '0 0 .5rem' }}>↩️ أُعيد للتعديل ({count})</div>
      {children}
    </div>
  )
}

function ReturnedCard({ title, sub, amount, reason, returnedAt, onEdit, onDelete }) {
  return (
    <div style={{ border: '1px solid var(--orange)', background: 'var(--orange-l)', borderRadius: 'var(--r)', padding: '.8rem 1rem', marginBottom: '.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div><div className="list-name">{title}</div><div className="list-sub">{sub}</div></div>
        {amount != null && <b style={{ fontSize: 13, flexShrink: 0 }}>{fmt(amount)} ⃁</b>}
      </div>
      <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '.5rem .65rem', marginTop: 8, fontSize: 12, color: 'var(--t1)' }}>
        <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700, marginBottom: 2 }}>سبب الإرجاع{returnedAt ? ` · ${fmtDay(returnedAt)}` : ''}</div>
        {reason || '—'}
      </div>
      <div style={{ display: 'flex', gap: '.6rem', marginTop: 10 }}>
        <button onClick={onEdit} style={{ flex: 1, padding: '.5rem', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}>تعديل وإعادة الإرسال</button>
        {onDelete && <button onClick={onDelete} style={{ padding: '.5rem .9rem', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: 'var(--red)', border: '1px solid var(--red-m)', borderRadius: 8 }}>حذف</button>}
      </div>
    </div>
  )
}

// returned later payments of one record type (subscriber, booking or sale)
function ReturnedPaymentsBox({ branch, recordType, createdBy, refresh, toast, onDone }) {
  const [rows, setRows] = useState([])
  const [target, setTarget] = useState(null)
  async function load() {
    const { data } = await supabase.from('payments').select('*').eq('branch', branch).eq('record_type', recordType)
      .eq('kind', 'later').eq('status', 'returned').eq('created_by', createdBy)
    setRows(data || [])
  }
  useEffect(() => { load() }, [refresh, branch])
  async function edit(p) {
    const table = p.record_type === 'subscriber' ? 'subscribers' : p.record_type === 'booking' ? 'bookings' : 'sales'
    const { data } = await supabase.from(table).select('*').eq('id', p.record_id).single()
    if (data) setTarget({ type: p.record_type, rec: data, resend: p })
  }
  async function del(p) {
    if (!confirm('حذف هذه الدفعة؟')) return
    await supabase.from('payments').delete().eq('id', p.id)
    load(); if (onDone) onDone()
  }
  if (!rows.length) return null
  return (
    <>
      <ReturnedSection count={rows.length}>
        {rows.map(p => (
          <ReturnedCard key={p.id} title={`دفعة: ${p.label || ''}`} sub={`${p.method} · ${p.paid_at}${p.note === 'باص' ? ' · باص' : ''}`} amount={p.amount}
            reason={p.return_reason} returnedAt={p.returned_at} onEdit={() => edit(p)} onDelete={p.note === 'باص' ? null : () => del(p)} />
        ))}
      </ReturnedSection>
      <PaymentModal target={target} onClose={() => setTarget(null)} toast={toast} onDone={() => { load(); if (onDone) onDone() }} createdBy={createdBy} />
    </>
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
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [stats, setStats] = useState({ pitchRev:0, subRev:0, kitRev:0, otherRev:0, exp:0, bookingCount:0, subsCount:0 })
  const [lastStats, setLastStats] = useState({ pitchRev:0, subRev:0, kitRev:0, exp:0 })
  const [pending, setPending] = useState([])
  const [archive, setArchive] = useState([])
  const [topSubs, setTopSubs] = useState([])
  const [dowData, setDowData] = useState([0,0,0,0,0,0,0])
  const [expiringSoon, setExpiringSoon] = useState([])
  const [flagList, setFlagList] = useState([])
  const [showFlags, setShowFlags] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [pitchUtil, setPitchUtil] = useState({ rate:0, bookedHours:0, availableHours:0 })
  const [loading, setLoading] = useState(true)
  const [archiveFilter, setArchiveFilter] = useState('all')
  const [archiveMonth, setArchiveMonth] = useState(TODAY.slice(0,7))
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [owed, setOwed] = useState({ total:0, items:[] })
  const [reasonFor, setReasonFor] = useState(null)     // { mode: 'return' | 'cancel', item }
  const [corrRec, setCorrRec] = useState(null)

  async function load(m) {
    setLoading(true)
    const start = m+'-01', end = monthEnd(m)
    const [py, pm] = m.split('-').map(Number)
    const prevM = pm === 1 ? `${py-1}-12` : `${py}-${String(pm-1).padStart(2,'0')}`
    const prevStart = prevM+'-01', prevEnd = monthEnd(prevM)

    const [bkRes, expRes, subRes, prevExpRes, subCount, rev, prevRev, owedSubs, owedBks, owedSales] = await Promise.all([
      supabase.from('bookings').select('date,amount,booker_name').eq('branch', branch).eq('status','approved').gte('date', start).lte('date', end),
      supabase.from('expenses').select('amount,category').eq('branch', branch).eq('status','approved').gte('date', start).lte('date', end),
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','approved').eq('is_current', true),
      supabase.from('expenses').select('amount').eq('branch', branch).eq('status','approved').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('subscribers').select('id',{count:'exact',head:true}).eq('branch', branch).eq('status','approved').gte('start_date', start).lte('start_date', end),
      fetchRevenue(branch, m),
      fetchRevenue(branch, prevM),
      supabase.from('subscribers').select('id,name,balance').eq('branch', branch).eq('status','approved').gt('balance', 0),
      supabase.from('bookings').select('id,booker_name,balance').eq('branch', branch).eq('status','approved').gt('balance', 0).lt('date', shiftDay()),
      supabase.from('sales').select('id,item,subscriber_name,balance').eq('branch', branch).eq('status','approved').gt('balance', 0),
    ])

    // water-only rows from the imports are not pitch bookings
    const bks = (bkRes.data||[]).filter(b => b.booker_name !== 'مياه' && b.booker_name !== 'مياه فقط')
    const subs = subRes.data||[]
    const exp = (expRes.data||[]).reduce((a,e) => a+Number(e.amount), 0)
    // revenue is the money actually received in the month (approved payments), not the booked or invoiced value
    setStats({ pitchRev:rev.pitch, subRev:rev.sub, kitRev:rev.kit, otherRev:0, exp, bookingCount:bks.length, subsCount:subCount.count||0 })
    const prevExp = (prevExpRes.data||[]).reduce((a,e) => a+Number(e.amount), 0)
    setLastStats({ pitchRev:prevRev.pitch, subRev:prevRev.sub, kitRev:prevRev.kit, exp:prevExp, month:prevM })

    const owedItems = [
      ...(owedSubs.data||[]).map(r => ({ key:'s'+r.id, name:r.name, kind:'اشتراك', amount:Number(r.balance) })),
      ...(owedBks.data||[]).map(r => ({ key:'b'+r.id, name:r.booker_name, kind:'حجز', amount:Number(r.balance) })),
      ...(owedSales.data||[]).map(r => ({ key:'v'+r.id, name:r.subscriber_name||r.item, kind:'بيع', amount:Number(r.balance) })),
    ].sort((a,b) => b.amount-a.amount)
    setOwed({ total: owedItems.reduce((a,o) => a+o.amount, 0), items: owedItems })

    setTopSubs([...subs].sort((a,b) => Number(b.total_amount||0)-Number(a.total_amount||0)).slice(0,5))

    const dowCount = [0,0,0,0,0,0,0]
    bks.forEach(b => { if (b.date) dowCount[new Date(b.date).getDay()]++ })
    setDowData(dowCount)

    const daysInMonth = new Date(py, pm, 0).getDate()
    const availableSlots = daysInMonth * 4 * 2
    setPitchUtil({ rate: Math.round((bks.length/availableSlots)*100), bookedHours: bks.length*2, availableHours: availableSlots*2 })

    setExpiringSoon(subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d !== null && d >= 0 && d <= 14 }).sort((a,b) => daysBetween(TODAY,a.end_date)-daysBetween(TODAY,b.end_date)))
    setFlagList(subs.map(s => ({ s, items: subscriptionFlagItems(s, subs) })).filter(x => x.items.length))

    // everything waiting for the owner, with the payments entered together with it
    const [pBk, pEx, pSl, pSub, pPay, pClo] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('sales').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('payments').select('*').eq('branch', branch).eq('status','pending'),
      supabase.from('day_closings').select('*').eq('branch', branch).eq('status','pending').order('created_at',{ascending:false}),
    ])
    const payMap = {}
    ;(pPay.data||[]).filter(p => p.kind==='initial').forEach(p => { const k = p.record_type+':'+p.record_id; (payMap[k] = payMap[k] || []).push(p) })
    const card = (type, r) => ({ ...r, _type:type, ...describeRecord(type, r), _pays: payMap[(type==='closing'?'day':type)+':'+r.id] || [], _flags: type==='subscriber' ? subscriptionFlags(r, subs)
      : type==='closing' ? [
          ...(Number(r.network || 0) !== Number(r.expected_network || 0) ? [`الشبكة: المحصّل ${fmt(r.network || 0)} ⃁ والمسجّل عند الحجز ${fmt(r.expected_network || 0)} ⃁`] : []),
          ...(Number(r.transfer || 0) !== Number(r.expected_transfer || 0) ? [`التحويل: المحصّل ${fmt(r.transfer || 0)} ⃁ والمسجّل عند الحجز ${fmt(r.expected_transfer || 0)} ⃁`] : []),
        ] : [] })
    const allPending = [
      ...(pSub.data||[]).map(r => card('subscriber', r)),
      ...(pBk.data||[]).map(r => card('booking', r)),
      ...(pSl.data||[]).map(r => card('sale', r)),
      ...(pClo.data||[]).map(r => card('closing', r)),
      ...(pEx.data||[]).map(r => ({ ...r, _type:'expense', ...describeRecord('expense', r), _pays:[{ id:'e'+r.id, method:r.payment_method, amount:r.amount, receipt_url:r.receipt_url }], _flags:[] })),
      ...(pPay.data||[]).filter(p => p.kind==='later').map(p => ({ ...p, _type:'payment', ...describeRecord('payment', p), _pays:[p], _flags:[] })),
    ].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
    setPending(allPending)
    setLoading(false)
  }

  // the archive of one month, newest approval first
  async function loadArchive(m) {
    setArchiveLoading(true)
    const start = m+'-01', end = monthEnd(m)
    const st = ['approved','cancelled','rejected']
    const [aBk, aEx, aSl, aSub, aPay, aClo] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).in('status', st).gte('date', start).lte('date', end).limit(1000),
      supabase.from('expenses').select('*').eq('branch', branch).in('status', st).gte('date', start).lte('date', end).limit(1000),
      supabase.from('sales').select('*').eq('branch', branch).in('status', st).gte('created_at', start+'T00:00:00').lte('created_at', end+'T23:59:59').limit(1000),
      supabase.from('subscribers').select('*').eq('branch', branch).in('status', st).gte('start_date', start).lte('start_date', end).limit(1000),
      supabase.from('payments').select('*').eq('branch', branch).eq('kind','later').in('status', st).gte('paid_at', start).lte('paid_at', end).limit(1000),
      supabase.from('day_closings').select('*').eq('branch', branch).in('status', st).gte('day', start).lte('day', end).limit(1000),
    ])
    const mk = (type, rows) => (rows||[]).map(r => ({ ...r, _type:type, ...describeRecord(type, r), _when: r.approved_at || r.created_at }))
    setArchive([...mk('subscriber', aSub.data), ...mk('booking', aBk.data), ...mk('sale', aSl.data), ...mk('expense', aEx.data), ...mk('payment', aPay.data), ...mk('closing', aClo.data)]
      .sort((a,b) => new Date(b._when||0) - new Date(a._when||0)))
    setArchiveLoading(false)
  }

  useEffect(() => { load(month) }, [month, refresh, branch])
  useEffect(() => { loadArchive(archiveMonth) }, [archiveMonth, refresh, branch])

  async function approveItem(item) {
    await approveRecord(item._type, item)
    toast('✅ تمت الموافقة','success'); load(month); loadArchive(archiveMonth)
  }
  async function reviewItem(sRow, item) {
    await markFlagsReviewed(sRow, [item])
    toast('✅ تمت المراجعة', 'success'); load(month)
  }
  async function reviewGroup(g) {
    if (!confirm(`تعليم ${g.rows.length} اشتراك كمراجَع؟`)) return
    await Promise.all(g.rows.map(r => markFlagsReviewed(r.s, [r.item])))
    toast(`✅ تمت مراجعة ${g.rows.length}`, 'success'); load(month)
  }
  const flagGroups = FLAG_ORDER.map(code => ({
    code, label: FLAG_LABELS[code],
    rows: flagList.filter(x => x.items.some(i => i.code === code)).map(x => ({ s: x.s, item: x.items.find(i => i.code === code) })),
  })).filter(g => g.rows.length)

  async function confirmReason(reason) {
    const { mode, item } = reasonFor
    if (mode === 'return') await returnRecord(item._type, item, reason)
    else await cancelRecord(item._type, item, reason)
    setReasonFor(null)
    toast(mode === 'return' ? '↩️ أُعيدت البطاقة للتعديل' : 'تم الإلغاء', mode === 'return' ? 'success' : 'error')
    load(month); loadArchive(archiveMonth)
  }

  const totalRev = stats.pitchRev + stats.subRev + stats.kitRev + stats.otherRev
  const profit = totalRev - stats.exp
  const revenueBreakdown = [
    { label:'اشتراكات', val:stats.subRev, color:'#CC1F1F', pct: totalRev>0?Math.round(stats.subRev/totalRev*100):0 },
    { label:'ملاعب', val:stats.pitchRev, color:'#2563eb', pct: totalRev>0?Math.round(stats.pitchRev/totalRev*100):0 },
    { label:'مستلزمات', val:stats.kitRev, color:'#16a34a', pct: totalRev>0?Math.round(stats.kitRev/totalRev*100):0 },
    { label:'أخرى', val:stats.otherRev, color:'#f59e0b', pct: totalRev>0?Math.round(stats.otherRev/totalRev*100):0 },
  ].filter(r => r.val > 0)

  const typeIcon = { subscriber:'👤', booking:'🏟️', sale:'🛍️', expense:'💸', payment:'💰', closing:'🧾' }
  const statusLabel = { approved:'معتمد', cancelled:'ملغي', rejected:'مرفوض' }
  const archiveShown = archiveFilter === 'all' ? archive : archive.filter(i => i._type === archiveFilter || (archiveFilter === 'booking' && i._type === 'closing'))
  const tiny = { fontSize:9, borderRadius:5, padding:'2px 6px', cursor:'pointer', fontFamily:'inherit' }

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
          <div className={`kpi-val ${profit>=0?'kpi-val-g':'kpi-val-r'}`}>{(profit>=0?'+':'')+fmt(profit)} ⃁</div>
          <div className="kpi-sub">إيرادات مستلمة {fmt(totalRev)} · مصاريف {fmt(stats.exp)}</div>
        </div>
        <div className="kpi"><div className="kpi-label">الاشتراكات</div><div className="kpi-val kpi-val-g">{fmt(stats.subRev)} ⃁</div><div className="kpi-sub">{stats.subsCount} اشتراك بدأ هذا الشهر</div></div>
        <div className="kpi"><div className="kpi-label">الملاعب</div><div className="kpi-val kpi-val-g">{fmt(stats.pitchRev)} ⃁</div><div className="kpi-sub">{stats.bookingCount} حجز</div></div>
        <div className="kpi"><div className="kpi-label">المستلزمات</div><div className="kpi-val kpi-val-g">{fmt(stats.kitRev)} ⃁</div></div>
        <div className="kpi"><div className="kpi-label">المصاريف</div><div className="kpi-val kpi-val-r">{fmt(stats.exp)} ⃁</div></div>
      </div>

      {/* PENDING APPROVALS */}
      {pending.length > 0 && (
        <div style={{ background:'var(--orange-l)', border:'1px solid #fbbf24', borderRadius:'var(--r)', marginBottom:'.75rem', overflow:'hidden' }}>
          <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid #fde68a' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--orange)' }}>⏳ بانتظار الموافقة ({pending.length})</span>
          </div>
          {pending.map(item => <ApprovalCard key={item._type+item.id} item={item} onApprove={approveItem} onReturn={it => setReasonFor({ mode:'return', item:it })} />)}
        </div>
      )}

      {/* FLAGS: grouped by reason; a reviewed item disappears until its data changes */}
      {flagList.length > 0 && (
        <div className="card" style={{ borderColor:'var(--orange)', marginBottom:'.75rem' }}>
          <button onClick={() => setShowFlags(o => !o)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.7rem 1rem', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>⚠️ {flagList.length} اشتراك يحتاج مراجعة</span>
            <span style={{ color:'var(--orange)', fontSize:11 }}>{showFlags ? '▲' : '▼'}</span>
          </button>
          {showFlags && flagGroups.map(g => (
            <div key={g.code} style={{ borderTop:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'.5rem 1rem' }}>
                <button onClick={() => setOpenGroups(o => ({ ...o, [g.code]: !o[g.code] }))} style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'center', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--t1)' }}>{g.label} <span className="badge badge-o" style={{ fontSize:10 }}>{g.rows.length}</span></span>
                  <span style={{ color:'var(--t3)', fontSize:11 }}>{openGroups[g.code] ? '▲' : '▼'}</span>
                </button>
                <button onClick={() => reviewGroup(g)} style={{ fontSize:10, background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:6, padding:'3px 8px', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>تمت مراجعة الكل</button>
              </div>
              {openGroups[g.code] && g.rows.map(({ s: sRow, item }) => (
                <div key={sRow.id} className="list-row" style={{ alignItems:'flex-start' }}>
                  <div className="list-left">
                    <div className="list-av list-av-yellow">{sRow.name[0]}</div>
                    <div>
                      <div className="list-name">{sRow.name}</div>
                      <div className="list-sub" style={{ color:'var(--orange)' }}>{item.text}</div>
                    </div>
                  </div>
                  <div className="list-right">
                    <span className="badge badge-grey">{fmt(sRow.sub_amount)} ⃁</span>
                    <button onClick={() => reviewItem(sRow, item)} style={{ fontSize:9, background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:5, padding:'2px 6px', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>تمت المراجعة</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* EXPIRING SOON */}
      <ExpiringBox rows={expiringSoon} showSplit />

      {/* UNPAID BALANCES */}
      {owed.total > 0 && (
        <div className="card" style={{ borderColor:'var(--red)' }}>
          <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--red)' }}>💰 مبالغ مستحقة غير مدفوعة ({owed.items.length})</span>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--red)' }}>{fmt(owed.total)} ⃁</span>
          </div>
          {owed.items.slice(0,8).map(o => (
            <div key={o.key} className="list-row">
              <div className="list-left"><div><div className="list-name">{o.name}</div><div className="list-sub">{o.kind}</div></div></div>
              <span className="badge badge-r">{fmt(o.amount)} ⃁</span>
            </div>
          ))}
          {owed.items.length>8 && <div className="empty" style={{ padding:'.75rem' }}>+{owed.items.length-8} آخرين</div>}
        </div>
      )}

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
                    <span className="donut-val">{fmt(r.val)} ⃁</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                  <span style={{ fontSize:11, color:'var(--t3)' }}>{fmt(r.prev)} ⃁</span>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>←</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{fmt(r.cur)} ⃁</span>
                  {pct !== null && <span style={{ fontSize:10, fontWeight:700, color: diff>=0?'var(--green)':'var(--red)', background: diff>=0?'var(--green-l)':'var(--red-l)', padding:'2px 6px', borderRadius:10 }}>{diff>=0?'+':''}{pct}%</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PITCH UTILIZATION */}
      <div className="card">
        <div style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>إشغال الملاعب</div>
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
        <div className="card" style={{ margin:0 }}>
          <div style={{ padding:'.6rem .875rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>حجوزات/يوم الأسبوع</div>
          <div style={{ padding:'.75rem .5rem' }}>
            <BarChart labels={['أح','إث','ثل','أر','خم','جم','سب']} vals={dowData} color='#2563eb' height={100} />
          </div>
        </div>
        <div className="card" style={{ margin:0 }}>
          <div style={{ padding:'.6rem .875rem', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>أعلى اشتراكات</div>
          {topSubs.length === 0 ? <div className="empty" style={{ padding:'1rem' }}>لا بيانات</div> :
            topSubs.map((s,i) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.5rem .875rem', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--t3)', width:14 }}>{i+1}</span>
                  <span style={{ fontSize:11, color:'var(--t1)', fontWeight:500 }}>{s.name.split(' ').slice(0,2).join(' ')}</span>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--green)' }}>{fmt(s.total_amount)} ⃁</span>
              </div>
            ))}
        </div>
      </div>

      {/* ARCHIVE */}
      <div className="sec">الأرشيف</div>
      <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', marginBottom:'.5rem', scrollbarWidth:'none' }}>
        {[['all','الكل'],['subscriber','اشتراكات'],['booking','حجوزات'],['sale','مبيعات'],['payment','دفعات'],['expense','مصاريف']].map(([v,l]) => (
          <button key={v} onClick={() => setArchiveFilter(v)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid', borderColor:archiveFilter===v?'var(--red)':'var(--border)', background:archiveFilter===v?'var(--red-l)':'var(--surface)', color:archiveFilter===v?'var(--red)':'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:archiveFilter===v?600:400 }}>{l}</button>
        ))}
      </div>
      <div className="month-bar" style={{ marginBottom:'.5rem' }}>
        <select className="month-select" value={archiveMonth} onChange={e => setArchiveMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="card">
        {archiveLoading && archive.length === 0 ? <div className="loading">جاري التحميل...</div> :
          archiveShown.length === 0 ? <div className="empty"><div className="empty-icon">📁</div>لا يوجد سجلات</div> :
            archiveShown.map(item => (
              <div key={item._type+item.id} className="list-row" style={{ alignItems:'flex-start' }}>
                <div className="list-left">
                  <div style={{ fontSize:18, width:36, textAlign:'center', flexShrink:0 }}>{typeIcon[item._type]}</div>
                  <div>
                    <div className="list-name">{item._desc}</div>
                    <div className="list-sub">{item._label} · {item._meta}</div>
                    {item.status==='cancelled' && <div className="list-sub" style={{ color:'var(--red)' }}>ملغي{item.cancelled_at?` · ${fmtDay(item.cancelled_at)}`:''}{item.cancel_reason?` · ${item.cancel_reason}`:''}</div>}
                    {item.status==='approved' && item.approved_at && <div style={{ fontSize:9, color:'var(--t3)', marginTop:1 }}>اعتُمد {fmtDay(item.approved_at)}</div>}
                    {item.receipt_url && <a href={item.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                  </div>
                </div>
                <div className="list-right">
                  <span className={`badge ${item.status==='approved'?'badge-g':item.status==='cancelled'?'badge-grey':'badge-r'}`}>{fmt(item._type==='closing' ? item._paid : item._amount)} ⃁</span>
                  <span style={{ fontSize:9, color:'var(--t3)', marginTop:2 }}>{statusLabel[item.status]||item.status}</span>
                  {item.status==='approved' && (
                    <div style={{ display:'flex', gap:4, marginTop:4 }}>
                      {item._type==='subscriber' && <button onClick={() => setCorrRec(item)} style={{ ...tiny, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--t2)' }}>تصحيح المبلغ</button>}
                      <button onClick={() => setReasonFor({ mode:'cancel', item })} style={{ ...tiny, background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)' }}>إلغاء</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
      </div>

      <ReasonModal open={!!reasonFor} onClose={() => setReasonFor(null)} onConfirm={confirmReason}
        tone={reasonFor?.mode === 'cancel' ? 'danger' : 'warn'}
        title={reasonFor?.mode === 'cancel' ? `إلغاء: ${reasonFor?.item?._desc || ''}` : `إرجاع للتعديل: ${reasonFor?.item?._desc || ''}`}
        hint={reasonFor?.mode === 'cancel'
          ? 'يختفي من القوائم ولا يُحسب في الإيرادات، ويبقى في الأرشيف كملغي مع السبب. وإن كان فيه طقم أو ماء يرجع للمخزون.'
          : 'تعود البطاقة لمن أدخلها مع السبب ليصححها ويعيد إرسالها، ولا تُحسب في الإيرادات حتى تعتمدها.'}
        confirmLabel={reasonFor?.mode === 'cancel' ? 'تأكيد الإلغاء' : 'إرجاع للتعديل'} />
      <CorrectionModal rec={corrRec} onClose={() => setCorrRec(null)} onDone={() => { load(month); loadArchive(archiveMonth) }} toast={toast} />
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
  const [detailSub, setDetailSub] = useState(null)
  const [corrRec, setCorrRec] = useState(null)
  const [cancelRec, setCancelRec] = useState(null)
  const [monthSub, setMonthSub] = useState(0)
  const [monthBus, setMonthBus] = useState(0)

  async function load() {
    const [s, inv] = await Promise.all([
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','approved').eq('is_current', true).order('created_at',{ascending:false}),
      supabase.from('inventory').select('*').order('name'),
    ])
    setSubs((s.data||[]).sort(newestFirst)); setInventory(inv.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [refresh, branch])
  useEffect(() => { fetchRevenue(branch, TODAY.slice(0,7)).then(r => { setMonthSub(r.sub); setMonthBus(r.bus) }) }, [refresh, branch])

  const expiringSoon = subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d>=0 && d<=14 })
  const expired = subs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d<0 })
  let filtered = search ? subs.filter(s => s.name.includes(search)) : subs
  if (filter==='expiring') filtered = filtered.filter(s => expiringSoon.find(e=>e.id===s.id))
  if (filter==='expired') filtered = filtered.filter(s => expired.find(e=>e.id===s.id))
  if (filter==='bus') filtered = filtered.filter(s => s.has_bus)
  if (filter==='kit') filtered = filtered.filter(s => s.has_kit)
  if (filter==='unpaid') filtered = filtered.filter(s => Number(s.balance)>0)

  const owedTotal = subs.reduce((a,s) => a+Number(s.balance||0), 0)
  const busCount = subs.filter(s => s.has_bus).length
  const kitCount = subs.filter(s => s.has_kit).length
  const kitRev = subs.reduce((a,s) => a+Number(s.kit_amount||0), 0)
  const tiny = { fontSize:9, borderRadius:5, padding:'2px 6px', cursor:'pointer', fontFamily:'inherit' }

  async function doCancel(reason) {
    await cancelRecord('subscriber', cancelRec, reason)
    setCancelRec(null); toast('تم إلغاء الاشتراك','error'); load()
  }

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
            <div className="kpi"><div className="kpi-label">إيراد الاشتراكات · {MONTHS.find(m => m.value === TODAY.slice(0,7))?.label.split(' ')[0]}</div><div className="kpi-val kpi-val-g">{fmt(monthSub)} ⃁</div></div>
            {owedTotal>0 && <div className="kpi"><div className="kpi-label">مبالغ مستحقة</div><div className="kpi-val kpi-val-r">{fmt(owedTotal)} ⃁</div></div>}
            {expiringSoon.length>0 && <div className="kpi kpi-full" style={{ borderColor:'var(--orange)', background:'var(--orange-l)' }}><div className="kpi-label" style={{ color:'var(--orange)' }}>ينتهي قريباً</div><div className="kpi-val" style={{ color:'var(--orange)' }}>{expiringSoon.length} مشترك</div><div className="kpi-sub" style={{ color:'var(--orange)' }}>خلال 14 يوماً</div></div>}
          </div>
          <div className="info-box info-blue" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📂</span>
            <span>تصنيف الفئات العمرية سيظهر هنا بعد استلام البيانات من مدير الشؤون</span>
          </div>
          <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', marginBottom:'.75rem', scrollbarWidth:'none' }}>
            {[['all','الكل'],['unpaid','عليه مبلغ'],['expiring','ينتهي قريباً'],['expired','منتهي'],['bus','الباص'],['kit','اشترى طقم']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid', borderColor:filter===v?'var(--red)':'var(--border)', background:filter===v?'var(--red-l)':'var(--surface)', color:filter===v?'var(--red)':'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:filter===v?600:400 }}>{l}</button>
            ))}
          </div>
          <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
            <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
            {loading ? <div className="loading">جاري التحميل...</div> : filtered.length===0 ? <div className="empty"><div className="empty-icon">👥</div>لا يوجد مشتركون</div> :
              filtered.map((s,i) => {
                const st = subStatus(s.end_date)
                const flags = subscriptionFlags(s, subs)
                return (
                  <div key={s.id} className="list-row" style={{ alignItems:'flex-start' }}>
                    <div className="list-left" style={{ cursor:'pointer' }} onClick={() => setDetailSub(s)}>
                      <div className={`list-av ${avColors[i%4]}`}>{s.name[0]}</div>
                      <div style={{ minWidth:0 }}>
                        <div className="list-name">{s.name}</div>
                        <div className="list-sub">{s.sub_amount>0?`${fmt(s.sub_amount)} ⃁`:''}{s.type==='family'?` · عائلة ${s.members_count||''} أفراد`:''}{s.has_bus?' · باص':''}{s.has_kit?' · طقم':''}{s.end_date?` · حتى ${s.end_date}`:''}{s.guardian_phone?` · ${s.guardian_phone}`:''}</div>
                        {flags.map(t => <div key={t} className="list-sub" style={{ color:'var(--orange)' }}>⚠️ {t}</div>)}
                      </div>
                    </div>
                    <div className="list-right">
                      <div className="list-amt">{fmt(s.total_amount||s.sub_amount)} ⃁</div>
                      {Number(s.balance)>0 && <div style={{ fontSize:10, color:'var(--red)', fontWeight:600 }}>متبقي {fmt(s.balance)} ⃁</div>}
                      <span className={`badge ${st.cls}`} style={{ fontSize:9, marginTop:3 }}>{st.label}</span>
                      <div style={{ display:'flex', gap:4, marginTop:4 }}>
                        <button onClick={() => setCorrRec(s)} style={{ ...tiny, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--t2)' }}>تصحيح المبلغ</button>
                        <button onClick={() => setCancelRec(s)} style={{ ...tiny, background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)' }}>إلغاء</button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {tab==='other' && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><div className="kpi-label">مستخدمو الباص</div><div className="kpi-val">{busCount}</div><div className="kpi-sub">من {subs.length} مشترك</div></div>
            <div className="kpi"><div className="kpi-label">رسوم الباص المحصّلة · {MONTHS.find(m => m.value === TODAY.slice(0,7))?.label.split(' ')[0]}</div><div className="kpi-val">{fmt(monthBus)} ⃁</div><div className="kpi-sub" style={{ color:'var(--orange)', fontSize:10 }}>يُحوَّل لأصحاب الباص</div></div>
            <div className="kpi"><div className="kpi-label">اشتروا طقم</div><div className="kpi-val">{kitCount} مشترك</div></div>
            <div className="kpi"><div className="kpi-label">إيراد الطقم</div><div className="kpi-val kpi-val-g">{fmt(kitRev)} ⃁</div></div>
          </div>
          <div className="sec">المخزون</div>
          <InventoryGrid items={inventory} />
        </>
      )}

      <SubscriberDetail sub={detailSub} onClose={() => setDetailSub(null)}/>
      <CorrectionModal rec={corrRec} onClose={() => setCorrRec(null)} onDone={load} toast={toast} />
      <ReasonModal open={!!cancelRec} onClose={() => setCancelRec(null)} onConfirm={doCancel} tone="danger"
        title={`إلغاء اشتراك: ${cancelRec?.name || ''}`}
        hint="يختفي من القوائم ولا تُحسب دفعاته في الإيرادات، ويبقى في الأرشيف كملغي مع السبب. إن كان تجديداً يعود الاشتراك السابق حالياً، وإن كان فيه طقم يرجع للمخزون."
        confirmLabel="تأكيد الإلغاء" />
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
  const [month, setMonth] = useState(TODAY.slice(0,7))

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
              <div className="kpi-val">{fmt(smallRev+bigRev+waterCount*20)} ⃁</div>
              <div className="kpi-sub">{monthBks.length} حجز · {waterCount} صندوق مياه</div>
            </div>
          </div>
          <div className="field-card">
            <div className="field-name">ملعب صغير · 250 ⃁ / 2 ساعات</div>
            <div className="field-status">8 مساءً – 4 صباحاً</div>
            <div className="field-stats">
              <div><div className="fs-label">الإيراد</div><div className="fs-val">{fmt(smallRev)} ⃁</div></div>
              <div><div className="fs-label">الحجوزات</div><div className="fs-val">{smallCount}</div></div>
              <div><div className="fs-label">متوسط/حجز</div><div className="fs-val">{smallCount>0?fmt(Math.round(smallRev/smallCount)):0} ⃁</div></div>
            </div>
          </div>
          <div className="field-card">
            <div className="field-name">ملعب كبير · 300 ⃁ / 2 ساعات</div>
            <div className="field-status">8 مساءً – 4 صباحاً</div>
            <div className="field-stats">
              <div><div className="fs-label">الإيراد</div><div className="fs-val">{fmt(bigRev)} ⃁</div></div>
              <div><div className="fs-label">الحجوزات</div><div className="fs-val">{bigCount}</div></div>
              <div><div className="fs-label">متوسط/حجز</div><div className="fs-val">{bigCount>0?fmt(Math.round(bigRev/bigCount)):0} ⃁</div></div>
            </div>
          </div>
        </>
      )}

      {tab==='cal' && (
        <>
          <div className="summary-strip">
            <div className="strip-item"><div className="strip-label">اليوم المحدد</div><div className="strip-val">{selectedDate||'—'}</div></div>
            <div className="strip-item"><div className="strip-label">الحجوزات</div><div className="strip-val">{selectedBks.length}</div></div>
            <div className="strip-item"><div className="strip-label">الإيراد</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(selectedRev)} ⃁</div></div>
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
                    <div className="list-right">
                      <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ⃁</span>
                      {b.status==='pending' && <button onClick={async () => { if(confirm('هل تريد حذف هذا الحجز؟')) { await supabase.from('bookings').delete().eq('id',b.id); const {data} = await supabase.from('bookings').select('*').eq('branch', branch).eq('status','approved').order('date',{ascending:false}); setBookings(data||[]) } }}
                        style={{ fontSize:9, background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:5, padding:'2px 6px', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', marginTop:3 }}>حذف</button>}
                    </div>
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
                <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ⃁</span>
              </div>
            ))}
      </div>
    </>
  )
}

// ============ OWNER EXPENSES ============
function OwnerExpenses({ toast, refresh, branch }) {
  const [tab, setTab] = useState('monthly')
  const [month, setMonth] = useState(TODAY.slice(0,7))
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
    const dataMonths = MONTHS.map(m => m.value).filter(v => v <= TODAY.slice(0,7)).reverse()
    const rows = await Promise.all(dataMonths.map(async m => {
      const start = m+'-01', end = monthEnd(m)
      const [exRes, rev] = await Promise.all([
        supabase.from('expenses').select('amount,category').eq('branch',branch).eq('status','approved').gte('date',start).lte('date',end),
        fetchRevenue(branch, m),
      ])
      // revenue is the money actually received in the month
      const pitchRev = rev.pitch, subRev = rev.sub, kitRev = rev.kit
      const allExp = (exRes.data||[])
      const operExp = allExp.filter(e=>e.category!=='قرض').reduce((a,e)=>a+Number(e.amount),0)
      const loanExp = allExp.filter(e=>e.category==='قرض').reduce((a,e)=>a+Number(e.amount),0)
      const totalRev = pitchRev+subRev+kitRev
      return { month:m, pitchRev, subRev, kitRev, operExp, loanExp, totalRev, net:totalRev-operExp-loanExp, netExLoan:totalRev-operExp }
    }))
    setPnlRows(rows.filter(r => r.totalRev || r.operExp || r.loanExp)); setLoading(false)
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
            <div className="kpi kpi-full"><div className="kpi-label">إجمالي المصاريف المعتمدة</div><div className="kpi-val kpi-val-r">{fmt(total)} ⃁</div></div>
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
                      <span className="donut-val">{fmt(vals[i])} ⃁</span>
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
                  <span className="badge badge-r">{fmt(e.amount)} ⃁</span>
                </div>
              ))}
          </div>
        </>
      )}

      {tab==='pnl' && (
        <>
          <div className="info-box info-blue">الإيرادات هي المبالغ المستلمة فعلياً في كل شهر (الدفعات المعتمدة). القرض مفصول عن المصاريف التشغيلية.</div>
          {loading ? <div className="loading">جاري التحميل...</div> :
            pnlRows.map(r => {
              const mLabel = MONTHS.find(m=>m.value===r.month)?.label||r.month
              return (
                <div key={r.month} className="card" style={{ marginBottom:'.75rem' }}>
                  <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{mLabel}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <span className={`badge ${r.netExLoan>=0?'badge-g':'badge-r'}`} style={{ fontSize:10 }}>بدون قرض: {r.netExLoan>=0?'+':''}{fmt(r.netExLoan)} ⃁</span>
                      <span className={`badge ${r.net>=0?'badge-g':'badge-r'}`} style={{ fontSize:10 }}>الصافي: {r.net>=0?'+':''}{fmt(r.net)} ⃁</span>
                    </div>
                  </div>
                  <div className="pnl-row"><span className="pnl-label">إيراد الملاعب</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.pitchRev)} ⃁</span></div>
                  <div className="pnl-row"><span className="pnl-label">إيراد الاشتراكات</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.subRev)} ⃁</span></div>
                  <div className="pnl-row"><span className="pnl-label">المستلزمات</span><span className="pnl-val" style={{ color:'var(--green)' }}>{fmt(r.kitRev)} ⃁</span></div>
                  <div className="pnl-row" style={{ background:'var(--surface2)' }}><span className="pnl-label" style={{ fontWeight:600 }}>إجمالي الإيرادات</span><span className="pnl-val" style={{ color:'var(--green)', fontWeight:700 }}>{fmt(r.totalRev)} ⃁</span></div>
                  <div className="pnl-row"><span className="pnl-label">المصاريف التشغيلية</span><span className="pnl-val" style={{ color:'var(--red)' }}>{fmt(r.operExp)} ⃁</span></div>
                  {r.loanExp > 0 && <div className="pnl-row"><span className="pnl-label">القرض</span><span className="pnl-val" style={{ color:'var(--orange)' }}>{fmt(r.loanExp)} ⃁</span></div>}
                  <div className="pnl-row" style={{ background:'var(--black)' }}>
                    <span style={{ color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600 }}>صافي الربح</span>
                    <span style={{ color: r.net>=0?'var(--green)':'var(--red)', fontSize:15, fontWeight:700 }}>{r.net>=0?'+':''}{fmt(r.net)} ⃁</span>
                  </div>
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}

// ============ SUB PRICING FORM ============
// manual final price for the subscription, kit and bus lines (empty = normal price)
function LineAmount({ f, setF, ovKey, base, finalVal, color }) {
  return (
    <>
      <div className="form-group" style={{ marginBottom: 4 }}>
        <label className="form-label">السعر النهائي (⃁)</label>
        <input className="form-input" type="number" min="0" placeholder={String(base)} value={f[ovKey] ?? ''} onChange={e => setF(ff => ({ ...ff, [ovKey]: e.target.value }))} />
      </div>
      <div style={{ textAlign: 'left', fontSize: 14, fontWeight: 700, color }}>
        {fmt(finalVal)} ⃁ {base !== finalVal && <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400 }}>(بدلاً من {fmt(base)} ⃁)</span>}
      </div>
    </>
  )
}

// age groups: a player can be in more than one
function AgeChips({ value, onChange }) {
  const v = value || []
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {AGE_GROUPS.map(g => {
        const on = v.includes(g)
        return <button key={g} type="button" onClick={() => onChange(on ? v.filter(x => x !== g) : [...v, g])}
          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid ' + (on ? 'var(--green)' : 'var(--border)'), background: on ? 'var(--green-l)' : '#fff', color: on ? 'var(--green)' : 'var(--t2)', fontWeight: on ? 600 : 400 }}>{g}</button>
      })}
    </div>
  )
}

// a family: one collapsible section per player, opened one at a time
function PlayerSections({ f, setF }) {
  const [open, setOpen] = useState(0)
  const list = f.players || []
  const set = (i, patch) => setF(ff => ({ ...ff, players: (ff.players || []).map((p, j) => j === i ? { ...p, ...patch } : p) }))
  return (
    <div style={{ marginBottom: '.75rem' }}>
      {list.map((p, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
          <button type="button" onClick={() => setOpen(o => o === i ? -1 : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '.6rem .75rem', background: open === i ? 'var(--surface2)' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>لاعب {i + 1}{p.name ? ` · ${p.name}` : ''}</span>
            <span style={{ fontSize: 11, color: p.name ? 'var(--green)' : 'var(--t3)' }}>{p.name ? `${(p.ages || []).length ? p.ages.join('، ') : 'بدون فئة'} ✓` : 'غير مكتمل'} {open === i ? '▲' : '▼'}</span>
          </button>
          {open === i && (
            <div style={{ padding: '.75rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-group">
                <label className="form-label">اسم اللاعب</label>
                <input className="form-input" value={p.name} placeholder="اسم اللاعب" onChange={e => set(i, { name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">الفئة العمرية</label>
                <AgeChips value={p.ages} onChange={v => set(i, { ages: v })} />
              </div>
              <button type="button" onClick={() => setOpen(i + 1 < list.length ? i + 1 : -1)} style={{ fontSize: 12, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{i + 1 < list.length ? 'تم، التالي' : 'تم'}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SubPricingForm({ f, setF, BUS_PRICES, inventory }) {
  const t = subTotals(f)
  const kitStock = (inventory || []).find(r => r.name === f.kitItem)?.stock
  const months = t.months
  const members = famCount(f)
  const totalPaid = Number(f.cashAmt || 0) + Number(f.networkAmt || 0) + Number(f.transferAmt || 0)
  const remaining = t.total - totalPaid
  const box = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '.75rem', marginBottom: '.5rem' }
  const quick = { flex: 1, fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 0', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit' }
  const baseLabel = f.isPkg && months === 3
    ? `باقة ${PKG3_PRICE} ⃁${members > 1 ? ` × ${members} أفراد` : ''}`
    : `300 ⃁ × ${months} ${months === 1 ? 'شهر' : 'أشهر'}${members > 1 ? ` × ${members} أفراد` : ''} = ${fmt(t.subBase)} ⃁`

  return (
    <>
      {f.type === 'family' ? (
        <>
          <div className="form-group">
            <label className="form-label">عدد أفراد العائلة</label>
            <input className="form-input" type="number" min="2" max="12" value={f.members}
              onChange={e => { const v = e.target.value; setF(ff => ({ ...ff, members: v, players: syncPlayers(ff.players, clampMembers(v)), subOverride: '' })) }} />
          </div>
          <PlayerSections f={f} setF={setF} />
        </>
      ) : (
        <div className="form-group">
          <label className="form-label">الفئة العمرية</label>
          <AgeChips value={f.ages} onChange={v => setF(ff => ({ ...ff, ages: v }))} />
        </div>
      )}

      {/* START DATE + NUMBER OF MONTHS (the end date fills in and can still be changed) */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">تاريخ البداية</label>
          <input className="form-input" type="date" value={f.startDate} onChange={e => setF(ff => ({ ...ff, startDate: e.target.value, endDate: calcEnd(e.target.value, ff.months) }))} />
        </div>
        <div className="form-group">
          <label className="form-label">عدد الأشهر</label>
          <select className="form-select" value={f.months} onChange={e => { const m = Number(e.target.value); setF(ff => ({ ...ff, months: m, isPkg: m === 3 ? ff.isPkg : false, subOverride: '', endDate: calcEnd(ff.startDate, m) })) }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">تاريخ الانتهاء (يمكن تعديله)</label>
        <input className="form-input" type="date" value={f.endDate} onChange={e => setF(ff => ({ ...ff, endDate: e.target.value }))} />
      </div>

      {/* 3 MONTH PACKAGE: only when 3 months is chosen */}
      {months === 3 && (
        <div className="form-group">
          <div className="water-toggle" onClick={() => setF(ff => ({ ...ff, isPkg: !ff.isPkg, subOverride: '' }))}>
            <div className="water-toggle-left"><span style={{ fontSize: 18 }}>⭐</span><div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>باقة {PKG3_PRICE} ⃁ (3 أشهر)</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>بدونها سعر 3 أشهر كاملاً {fmt(900 * members)} ⃁</div></div></div>
            <div className={`toggle-switch ${f.isPkg ? 'toggle-on' : ''}`} />
          </div>
        </div>
      )}

      {/* SUBSCRIPTION LINE */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>الاشتراك</span>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{baseLabel}</span>
        </div>
        <LineAmount f={f} setF={setF} ovKey="subOverride" base={t.subBase} finalVal={t.subFinal} color="var(--red)" />
      </div>

      {/* KIT LINE */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: f.includeKit ? 8 : 0 }}>
          <div className="water-toggle-left" onClick={() => setF(ff => ({ ...ff, includeKit: !ff.includeKit, kitQty: ff.type === 'family' ? famCount(ff) : 1, kitOverride: '' }))} style={{ cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>👕</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>طقم</span>
          </div>
          <div className={`toggle-switch ${f.includeKit ? 'toggle-on' : ''}`} onClick={() => setF(ff => ({ ...ff, includeKit: !ff.includeKit, kitQty: ff.type === 'family' ? famCount(ff) : 1, kitOverride: '' }))} />
        </div>
        {f.includeKit && (
          <>
            <div className="form-row" style={{ marginBottom: 6 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">نوع الطقم</label>
                <select className="form-select" value={f.kitItem} onChange={e => setF(ff => ({ ...ff, kitItem: e.target.value, kitOverride: '' }))}>
                  <option value="طقم صيفي (جيرسي + شورت)">صيفي · 100 ⃁</option>
                  <option value="طقم شتوي">شتوي · 120 ⃁</option>
                </select>
                {kitStock != null && <div className="list-sub" style={{ marginTop: 3 }}>المتوفر في المخزون: {kitStock}</div>}
              </div>
              {f.type === 'family' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">عدد الأطقم</label>
                  <input className="form-input" type="number" min="1" max={famCount(f)} value={f.kitQty} onChange={e => setF(ff => ({ ...ff, kitQty: e.target.value, kitOverride: '' }))} />
                </div>
              )}
            </div>
            <LineAmount f={f} setF={setF} ovKey="kitOverride" base={t.kitBase} finalVal={t.kitFinal} color="var(--green)" />
          </>
        )}
      </div>

      {/* BUS LINE */}
      <div style={{ ...box, marginBottom: '.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: f.includeBus ? 8 : 0 }}>
          <div className="water-toggle-left" onClick={() => setF(ff => ({ ...ff, includeBus: !ff.includeBus }))} style={{ cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>🚌</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>باص</span>
          </div>
          <div className={`toggle-switch ${f.includeBus ? 'toggle-on' : ''}`} onClick={() => setF(ff => ({ ...ff, includeBus: !ff.includeBus }))} />
        </div>
        {f.includeBus && (
          <>
            <div className="form-row" style={{ marginBottom: 6, marginTop: 6 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">سعر الباص/شهر</label>
                <select className="form-select" value={f.busPrice} onChange={e => setF(ff => ({ ...ff, busPrice: Number(e.target.value), busOverride: '' }))}>
                  {BUS_PRICES.map(p => <option key={p} value={p}>{p} ر</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">عدد أشهر الباص</label>
                <input className="form-input" type="number" min="1" max="12" value={f.busMonths} onChange={e => setF(ff => ({ ...ff, busMonths: parseInt(e.target.value) || 1, busOverride: '' }))} />
              </div>
            </div>
            <LineAmount f={f} setF={setF} ovKey="busOverride" base={t.busBase} finalVal={t.busFinal} color="#0369a1" />
          </>
        )}
      </div>

      {/* TOTAL + PAYMENT */}
      <div style={{ ...box, marginBottom: '.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: 'var(--t1)' }}>الإجمالي</span>
          <span style={{ color: 'var(--red)' }}>{fmt(t.total)} ⃁</span>
        </div>
        {t.discountGiven > 0 && <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 6 }}>خصم ممنوح: {fmt(t.discountGiven)} ⃁</div>}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', margin: '8px 0 6px' }}>تفصيل الدفع</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {[['نقدي كاملاً', 'cashAmt'], ['شبكة كاملاً', 'networkAmt'], ['تحويل كاملاً', 'transferAmt']].map(([l, k]) => (
            <button key={k} onClick={() => setF(ff => ({ ...ff, cashAmt: 0, networkAmt: 0, transferAmt: 0, [k]: t.total }))} style={quick}>{l}</button>
          ))}
        </div>
        <div className="form-row" style={{ marginBottom: 6, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">💵 نقدي</label><input className="form-input" type="number" min="0" value={f.cashAmt || ''} placeholder="0" onChange={e => setF(ff => ({ ...ff, cashAmt: e.target.value }))} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">💳 شبكة</label><input className="form-input" type="number" min="0" value={f.networkAmt || ''} placeholder="0" onChange={e => setF(ff => ({ ...ff, networkAmt: e.target.value }))} /></div>
          <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">📱 تحويل</label><input className="form-input" type="number" min="0" value={f.transferAmt || ''} placeholder="0" onChange={e => setF(ff => ({ ...ff, transferAmt: e.target.value }))} /></div>
        </div>
        {Number(f.networkAmt) > 0 && <ReceiptUpload label="إيصال الشبكة" folder="subscribers" current={f.networkReceipt} onUploaded={url => setF(ff => ({ ...ff, networkReceipt: url }))} />}
        {Number(f.transferAmt) > 0 && <ReceiptUpload label="إيصال التحويل" folder="subscribers" current={f.transferReceipt} onUploaded={url => setF(ff => ({ ...ff, transferReceipt: url }))} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--t3)' }}>المدفوع: {fmt(totalPaid)} ⃁</span>
          <span style={{ color: remaining <= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {remaining === 0 ? '✅ مكتمل' : remaining < 0 ? `المدفوع أكبر بـ ${fmt(-remaining)} ⃁` : `متبقي: ${fmt(remaining)} ⃁`}
          </span>
        </div>
        {/* the subscriber cannot pay the full price: what he paid becomes the final price, nothing is owed */}
        {remaining > 0 && totalPaid > 0 && totalPaid >= t.kitFinal + t.busFinal && (
          <button type="button" onClick={() => setF(ff => ({ ...ff, subOverride: String(totalPaid - t.kitFinal - t.busFinal) }))}
            style={{ width: '100%', marginTop: 8, padding: '.5rem', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--green-l)', color: 'var(--green)', border: '1.5px solid var(--green)', borderRadius: 8, fontWeight: 600 }}>
            اعتبر هذا المبلغ هو السعر النهائي
          </button>
        )}
        {remaining > 0 && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>أو اتركه مستحقاً ويمكن تسجيل دفعة عليه لاحقاً.</div>}
      </div>
    </>
  )
}

// ============ STAFF SUBS ============
function StaffSubs({ toast, refresh, branch }) {
  const BUS_PRICES = [150,200,250,300,350,400,450,500,550,600,650,700,750]
  const createdBy = ROLES[branch==='jazan'?'admin_jazan':'admin_riyadh']?.label
  const emptyForm = () => ({ ...blankPricing, name:'', phone:'', startDate:TODAY, endDate:calcEnd(TODAY,1) })
  const [subs, setSubs] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [resendRec, setResendRec] = useState(null)        // a returned subscription being fixed
  const [renewModal, setRenewModal] = useState(false)
  const [renewSub, setRenewSub] = useState(null)
  const [renewForm, setRenewForm] = useState(emptyForm())
  const [editModal, setEditModal] = useState(false)
  const [editSub, setEditSub] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', phone:'', startDate:'', endDate:'' })
  const [detailSub, setDetailSub] = useState(null)
  const [payTarget, setPayTarget] = useState(null)
  const [inventory, setInventory] = useState([])
  const [pendPays, setPendPays] = useState({})
  const [freezeModal, setFreezeModal] = useState(false)
  const [freezeSub, setFreezeSub] = useState(null)
  const [freezeDays, setFreezeDays] = useState(7)
  const [subsTab, setSubsTab] = useState('subs')
  const [breaks, setBreaks] = useState([])
  const [breakForm, setBreakForm] = useState({ reason:'', lastDay:'', resumeDay:'' })
  const [breakPreview, setBreakPreview] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [addingBreak, setAddingBreak] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [monthSub, setMonthSub] = useState(0)
  const errBox = formError ? <div style={{ background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)', borderRadius:8, padding:'.5rem .75rem', fontSize:12, fontWeight:600, marginBottom:'.75rem' }}>{formError}</div> : null

  async function load() {
    const [s, br, inv, pp] = await Promise.all([
      supabase.from('subscribers').select('*').eq('branch', branch).order('created_at',{ascending:false}),
      supabase.from('academy_breaks').select('*').eq('branch', branch).order('created_at',{ascending:false}),
      supabase.from('inventory').select('*').in('name',['طقم صيفي (جيرسي + شورت)','طقم شتوي']),
      supabase.from('payments').select('*').eq('branch', branch).eq('record_type','subscriber').eq('kind','initial').eq('status','pending'),
    ])
    const pm = {}; (pp.data||[]).forEach(p => { (pm[p.record_id] = pm[p.record_id] || []).push(p) }); setPendPays(pm)
    setSubs((s.data||[]).filter(x=>x.is_current!==false).sort(newestFirst)); setBreaks(br.data||[]); setInventory(inv.data||[]); setLoading(false)
  }
  useEffect(() => { load() }, [refresh, branch])
  // the same figure the owner sees under الاشتراكات: money received in the month and approved
  useEffect(() => { fetchRevenue(branch, month).then(r => setMonthSub(r.sub)) }, [month, refresh, branch])

  const approvedSubs = subs.filter(s => s.status==='approved')
  const pendingSubs = subs.filter(s => s.status==='pending')
  const returnedSubs = subs.filter(s => s.status==='returned' && s.created_by===createdBy)

  // ---------- academy break: last operating day and first day back ----------
  const closedDays = breakForm.lastDay && breakForm.resumeDay
    ? Math.round((new Date(breakForm.resumeDay) - new Date(breakForm.lastDay)) / 86400000) - 1 : 0

  function previewBreak() {
    if (!breakForm.reason) { alert('اختر سبب الإجازة'); return }
    if (!breakForm.lastDay || !breakForm.resumeDay) { alert('أدخل آخر يوم عمل وأول يوم عمل بعد الإجازة'); return }
    if (closedDays < 1) { alert('أول يوم عمل بعد الإجازة يجب أن يكون بعد آخر يوم عمل بيومين على الأقل'); return }
    // a subscription that had not ended on the last operating day gets the closed days back
    const affected = approvedSubs.filter(s => s.end_date && s.end_date > breakForm.lastDay)
      .map(s => ({ id:s.id, name:s.name, old_end:s.end_date, new_end:addDaysStr(s.end_date, closedDays) }))
    setBreakPreview({ ...breakForm, closedDays, affected }); setPreviewOpen(false)
  }

  async function confirmBreak() {
    const pv = breakPreview
    setAddingBreak(true)
    const { error } = await supabase.from('academy_breaks').insert({
      branch, reason:pv.reason, last_day:pv.lastDay, resume_day:pv.resumeDay, closed_days:pv.closedDays,
      start_date:addDaysStr(pv.lastDay,1), end_date:addDaysStr(pv.resumeDay,-1), changes:pv.affected, created_by:createdBy
    })
    if (error) { setAddingBreak(false); toast('خطأ في الحفظ','error'); console.error(error); return }
    await Promise.all(pv.affected.map(a => supabase.from('subscribers').update({ end_date:a.new_end }).eq('id', a.id)))
    setAddingBreak(false)
    toast(`✅ تم تمديد ${pv.affected.length} اشتراك بمقدار ${pv.closedDays} أيام`,'success')
    setBreakForm({ reason:'', lastDay:'', resumeDay:'' }); setBreakPreview(null); load()
  }

  // deleting a break puts every subscriber back to the end date he had before it
  async function deleteBreak(b) {
    if (!confirm('سيعود تاريخ انتهاء المشتركين الذين مُدّدوا في هذه الإجازة كما كان. متابعة؟')) return
    const ch = Array.isArray(b.changes) ? b.changes : []
    await Promise.all(ch.map(a => supabase.from('subscribers').update({ end_date:a.old_end }).eq('id', a.id).eq('end_date', a.new_end)))
    await supabase.from('academy_breaks').delete().eq('id', b.id)
    toast('تم حذف الإجازة وإرجاع التواريخ','error'); load()
  }

  // ---------- adding, renewing and fixing a subscription ----------
  function validatePayment(f) {
    const fail = msg => { setFormError(msg); return null }
    const t = subTotals(f)
    const cash = Number(f.cashAmt || 0), net = Number(f.networkAmt || 0), tr = Number(f.transferAmt || 0)
    if (f.type === 'family') {
      if (famCount(f) < 2) return fail('أدخل عدد أفراد العائلة')
      const list = f.players || []
      const empty = list.findIndex(p => !(p.name || '').trim())
      if (empty >= 0) return fail(`أدخل اسم اللاعب ${empty + 1}`)
      if (list.length < famCount(f)) return fail(`أدخل اسم اللاعب ${list.length + 1}`)
    }
    if (cash + net + tr > t.total) return fail('المدفوع أكبر من الإجمالي')
    if (net > 0 && !f.networkReceipt) return fail('يجب رفع إيصال الشبكة')
    if (tr > 0 && !f.transferReceipt) return fail('يجب رفع إيصال التحويل')
    if (f.includeKit) {
      const row = inventory.find(r => r.name === f.kitItem)
      if (row && Number(row.stock) < kitCount(f)) return fail(`المتوفر من هذا الطقم ${row.stock} فقط`)
    }
    return { t, cash, net, tr, paid: cash + net + tr }
  }

  function subRow(f, v, extra) {
    const { t, cash, net, tr, paid } = v
    const methods = [cash > 0 && 'نقدي', net > 0 && 'شبكة', tr > 0 && 'تحويل'].filter(Boolean)
    return {
      type: f.type, members_count: famCount(f),
      package: t.subFinal, sub_amount: t.subFinal, bus_amount: t.busFinal, kit_amount: t.kitFinal, other_amount: 0,
      total_amount: t.total, months: t.months,
      discount_given: t.discountGiven,
      payment_method: methods.length === 0 ? 'غير مدفوع' : methods.length === 1 ? methods[0] : 'مختلط',
      payment_cash: cash, payment_network: net, payment_transfer: tr,
      has_receipt: (net > 0 || tr > 0), receipt_url: f.networkReceipt || f.transferReceipt || null,
      has_bus: f.includeBus, has_kit: f.includeKit,
      kit_item: f.includeKit ? f.kitItem : null, kit_size: null, kit_qty: kitCount(f), players: playersOf(f),
      bus_price_per_month: f.includeBus ? f.busPrice : 0, bus_months: f.includeBus ? f.busMonths : 0,
      bus_start_date: f.includeBus ? f.startDate : null, bus_end_date: f.includeBus ? calcEnd(f.startDate, f.busMonths) : null,
      start_date: f.startDate, end_date: f.endDate,
      paid_amount: paid, balance: t.total - paid,
      created_by: createdBy, branch, status: 'pending',
      ...extra
    }
  }
  const paymentParts = (f, v) => [
    { method: 'نقدي', amount: v.cash },
    { method: 'شبكة', amount: v.net, receipt: f.networkReceipt },
    { method: 'تحويل', amount: v.tr, receipt: f.transferReceipt },
  ]

  // every subscription period is its own record; payments are stored separately
  async function savePeriod(f, v, extra) {
    const id = crypto.randomUUID()
    const { data, error } = await supabase.from('subscribers').insert(subRow(f, v, { id, member_id: id, ...extra })).select().single()
    if (error) return { error }
    if (f.includeKit) await supabase.rpc('adjust_inventory', { p_name: f.kitItem, p_size: '', p_qty: -kitCount(f) })
    const res = await insertInitialPayments({ branch, type: 'subscriber', rec: data, label: data.name, createdBy, parts: paymentParts(f, v) })
    return { error: res.error }
  }

  function openAdd() { setFormError(''); setResendRec(null); setForm(emptyForm()); setModal(true) }
  function closeAdd() { setModal(false); setResendRec(null) }

  async function submit() {
    setFormError('')
    if (form.type !== 'family' && !form.name.trim()) { setFormError('أدخل الاسم'); return }
    if (!form.startDate || !form.endDate) { setFormError('أدخل تاريخ البداية والانتهاء'); return }
    const v = validatePayment(form); if (!v) return
    setSubmitting(true)
    const { error } = await savePeriod(form, v, { name: subName(form), guardian_phone: form.phone || null })
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); console.error(error); return }
    toast('✅ تم الحفظ بنجاح', 'success')
    closeAdd(); setForm(emptyForm()); load()
  }

  // the owner returned it: open the same form, already filled in
  async function openResend(rec) {
    const { data: pays } = await supabase.from('payments').select('*').eq('record_type','subscriber').eq('record_id', String(rec.id)).eq('kind','initial')
    setFormError(''); setResendRec(rec); setForm(formFromSub(rec, pays || [])); setModal(true)
  }

  async function resend() {
    setFormError('')
    if (form.type !== 'family' && !form.name.trim()) { setFormError('أدخل الاسم'); return }
    if (!form.startDate || !form.endDate) { setFormError('أدخل تاريخ البداية والانتهاء'); return }
    const v = validatePayment(form); if (!v) return
    setSubmitting(true)
    const { error } = await supabase.from('subscribers').update(
      subRow(form, v, { name: subName(form), guardian_phone: form.phone || null, return_reason: null, returned_at: null })
    ).eq('id', resendRec.id)
    if (!error) {
      await supabase.from('payments').delete().eq('record_type','subscriber').eq('record_id', String(resendRec.id)).eq('kind','initial')
      if (form.includeKit) await supabase.rpc('adjust_inventory', { p_name: form.kitItem, p_size: '', p_qty: -kitCount(form) })
      await insertInitialPayments({ branch, type: 'subscriber', rec: { id: resendRec.id, total_amount: v.t.total, bus_amount: v.t.busFinal, kit_amount: v.t.kitFinal },
        label: subName(form), createdBy, parts: paymentParts(form, v) })
    }
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ', 'error'); console.error(error); return }
    toast('✅ أُعيد الإرسال للمالك', 'success')
    closeAdd(); setForm(emptyForm()); load()
  }

  async function freezeSubscriber() {
    if (!freezeSub || !freezeDays) return
    await supabase.from('subscribers').update({
      is_frozen: true, freeze_days: Number(freezeDays),
      freeze_start: TODAY, end_date: addDaysStr(freezeSub.end_date, Number(freezeDays))
    }).eq('id', freezeSub.id)
    toast('✅ تم تجميد الاشتراك وتمديد التاريخ', 'success')
    setFreezeModal(false); setFreezeSub(null); load()
  }

  // a renewal is a new period linked to the same subscriber, so history and past months stay intact
  function openRenew(s) {
    const start = s.end_date && s.end_date >= TODAY ? s.end_date : TODAY
    setFormError(''); setRenewSub(s)
    const pl = Array.isArray(s.players) ? s.players.map(p => ({ name: p.name || '', ages: p.ages || [] })) : []
    const fam = s.type === 'family'
    setRenewForm({ ...blankPricing, startDate: start, endDate: calcEnd(start, 1), type: fam ? 'family' : 'individual', members: s.members_count || 1,
      name: s.name, ages: fam ? [] : (pl[0]?.ages || []), players: fam ? syncPlayers(pl, s.members_count || 2) : [{ name: '', ages: [] }] })
    setRenewModal(true)
  }

  async function renew() {
    setFormError('')
    if (!renewSub) return
    if (!renewForm.startDate || !renewForm.endDate) { setFormError('أدخل التواريخ'); return }
    const v = validatePayment(renewForm); if (!v) return
    setSubmitting(true)
    const { error } = await savePeriod(renewForm, v, {
      name: renewSub.name, guardian_phone: renewSub.guardian_phone || null,
      member_id: renewSub.member_id || String(renewSub.id), renewal_of: String(renewSub.id)
    })
    setSubmitting(false)
    if (error) { toast('خطأ في التجديد', 'error'); console.error(error); return }
    toast('✅ تم تسجيل التجديد', 'success')
    setRenewModal(false); setRenewSub(null); load()
  }

  async function saveEdit() {
    if (!editSub) return
    setSubmitting(true)
    await supabase.from('subscribers').update({
      name: editForm.name, guardian_phone: editForm.phone||null,
      start_date: editForm.startDate||null, end_date: editForm.endDate||null,
    }).eq('id', editSub.id)
    setSubmitting(false)
    toast('✅ تم التعديل بنجاح','success')
    setEditModal(false); setEditSub(null); load()
  }

  // only a card that has not been approved can be deleted
  async function deleteSub(s) {
    if (!confirm(`هل تريد حذف "${s.name}"؟`)) return
    // a returned card already gave its kit back to the stock
    if (s.status==='pending' && s.has_kit && s.kit_item) await supabase.rpc('adjust_inventory', { p_name: s.kit_item, p_size: '', p_qty: Number(s.kit_qty || 1) })
    await supabase.from('payments').delete().eq('record_type','subscriber').eq('record_id', String(s.id))
    await supabase.from('subscribers').delete().eq('id', s.id)
    toast('تم الحذف','error'); load()
  }

  const expiringSoon = approvedSubs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d>=0 && d<=14 })
  const expired = approvedSubs.filter(s => { const d = daysBetween(TODAY, s.end_date); return d!==null && d<0 })
  let filtered = search ? approvedSubs.filter(s => s.name.includes(search)) : approvedSubs
  if (filter==='expiring') filtered = filtered.filter(s => expiringSoon.find(e=>e.id===s.id))
  if (filter==='expired') filtered = filtered.filter(s => expired.find(e=>e.id===s.id))
  if (filter==='bus') filtered = filtered.filter(s => s.has_bus)
  if (filter==='kit') filtered = filtered.filter(s => s.has_kit)

  const owedTotal = approvedSubs.reduce((a,s) => a+Number(s.balance||0), 0)
  if (filter==='unpaid') filtered = filtered.filter(s => Number(s.balance)>0)
  const btn = (bg, bd, c) => ({ fontSize:9, background:bg, border:`1px solid ${bd}`, borderRadius:5, padding:'2px 6px', color:c, cursor:'pointer', fontFamily:'inherit' })

  return (
    <div className="page">
      <div className="summary-strip">
        <div className="strip-item"><div className="strip-label">المشتركون</div><div className="strip-val">{approvedSubs.length}</div></div>
        <div className="strip-item">
          <div className="strip-label">إيراد الاشتراكات</div>
          <div className="strip-val" style={{ color:'var(--green)' }}>{fmt(monthSub)} ⃁</div>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ border:'none', background:'transparent', fontSize:10, color:'var(--t3)', fontFamily:'inherit', maxWidth:'100%', marginTop:2 }}>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {owedTotal>0 && <div className="strip-item"><div className="strip-label">مستحقات</div><div className="strip-val" style={{ color:'var(--red)' }}>{fmt(owedTotal)} ⃁</div></div>}
        {pendingSubs.length>0 && <div className="strip-item"><div className="strip-label">معلق</div><div className="strip-val" style={{ color:'var(--orange)' }}>{pendingSubs.length}</div></div>}
        {returnedSubs.length>0 && <div className="strip-item"><div className="strip-label">أُعيد</div><div className="strip-val" style={{ color:'var(--orange)' }}>{returnedSubs.length}</div></div>}
      </div>

      <div className="inner-tabs">
        <button className={`inner-tab ${subsTab==='subs'?'inner-tab-active':''}`} onClick={() => setSubsTab('subs')}>المشتركون</button>
        <button className={`inner-tab ${subsTab==='breaks'?'inner-tab-active':''}`} onClick={() => setSubsTab('breaks')}>إجازات الأكاديمية</button>
      </div>

      {subsTab==='breaks' && (
        <>
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <div style={{ padding:'.875rem 1rem' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--red)', marginBottom:'.875rem' }}>تسجيل إجازة جديدة</div>
              <div className="form-group">
                <label className="form-label">سبب الإجازة</label>
                <select className="form-select" value={breakForm.reason} onChange={e => { setBreakForm(f=>({...f,reason:e.target.value})); setBreakPreview(null) }}>
                  <option value="">اختر السبب</option>
                  <option>اختبارات مدرسية</option><option>عيد الفطر</option><option>عيد الأضحى</option>
                  <option>اليوم الوطني</option><option>إجازة رسمية</option><option>صيانة</option><option>أخرى</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">آخر يوم عمل</label><input className="form-input" type="date" value={breakForm.lastDay} onChange={e => { setBreakForm(f=>({...f,lastDay:e.target.value})); setBreakPreview(null) }}/></div>
                <div className="form-group"><label className="form-label">أول يوم عمل بعد الإجازة</label><input className="form-input" type="date" value={breakForm.resumeDay} onChange={e => { setBreakForm(f=>({...f,resumeDay:e.target.value})); setBreakPreview(null) }}/></div>
              </div>
              {closedDays>0 && <div style={{ fontSize:12, color:'var(--orange)', fontWeight:600, marginBottom:'.5rem' }}>أيام الإغلاق: {closedDays} (من {addDaysStr(breakForm.lastDay,1)} إلى {addDaysStr(breakForm.resumeDay,-1)})</div>}
              {!breakPreview && <button className="btn-primary" onClick={previewBreak}>معاينة التمديد</button>}
              {breakPreview && (
                <div style={{ background:'var(--orange-l)', border:'1px solid #fbbf24', borderRadius:8, padding:'.75rem', marginTop:'.5rem' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>سيتم تمديد {breakPreview.affected.length} اشتراك بمقدار {breakPreview.closedDays} أيام</div>
                  <div style={{ fontSize:11, color:'var(--t3)', margin:'3px 0 8px' }}>الأكاديمية تعود للعمل يوم {breakPreview.resumeDay}. لم يُحفظ شيء بعد.</div>
                  <button onClick={() => setPreviewOpen(o=>!o)} style={{ width:'100%', display:'flex', justifyContent:'space-between', background:'#fff', border:'1px solid #fde68a', borderRadius:6, padding:'.45rem .65rem', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'var(--t1)' }}>
                    <span>عرض المشتركين وتواريخهم الجديدة</span><span>{previewOpen?'▲':'▼'}</span>
                  </button>
                  {previewOpen && (
                    <div style={{ maxHeight:240, overflowY:'auto', background:'#fff', border:'1px solid #fde68a', borderTop:'none', borderRadius:'0 0 6px 6px' }}>
                      {breakPreview.affected.map(a => (
                        <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'.4rem .65rem', borderBottom:'1px solid var(--border)', fontSize:11 }}>
                          <span style={{ color:'var(--t1)' }}>{a.name}</span>
                          <span style={{ color:'var(--t3)' }}>{a.old_end} ← <b style={{ color:'var(--green)' }}>{a.new_end}</b></span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'.6rem', marginTop:10 }}>
                    <button className="btn-primary" disabled={addingBreak} onClick={confirmBreak} style={{ flex:2, background:'var(--green)' }}>{addingBreak?'جاري الحفظ...':'تأكيد وتمديد'}</button>
                    <button className="btn-secondary" onClick={() => setBreakPreview(null)} style={{ flex:1 }}>رجوع</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="sec">سجل الإجازات</div>
          <div className="card">
            {breaks.length===0?<div className="empty"><div className="empty-icon">📅</div>لا يوجد إجازات مسجلة</div>:
              breaks.map(b => {
                const n = Array.isArray(b.changes) ? b.changes.length : null
                return (
                  <div key={b.id} className="list-row">
                    <div className="list-left">
                      <div className="list-av list-av-yellow">🏖</div>
                      <div>
                        <div className="list-name">{b.reason}</div>
                        <div className="list-sub">{b.last_day ? `آخر يوم عمل ${b.last_day} · العودة ${b.resume_day} · ${b.closed_days} أيام` : `${b.start_date} → ${b.end_date}`}{n!=null?` · ${n} اشتراك`:''}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteBreak(b)} style={{ fontSize:10, background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:6, padding:'3px 8px', color:'var(--red)', cursor:'pointer', fontFamily:'inherit' }}>حذف</button>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {subsTab==='subs' && <>
      {/* RETURNED BY THE OWNER */}
      <ReturnedSection count={returnedSubs.length}>
        {returnedSubs.map(s => (
          <ReturnedCard key={s.id} title={`${s.name}${s.renewal_of?' (تجديد)':''}`} sub={`${s.start_date||''} ← ${s.end_date||''}`} amount={s.total_amount}
            reason={s.return_reason} returnedAt={s.returned_at} onEdit={() => openResend(s)} onDelete={() => deleteSub(s)} />
        ))}
      </ReturnedSection>
      <ReturnedPaymentsBox branch={branch} recordType="subscriber" createdBy={createdBy} refresh={refresh} toast={toast} onDone={load} />

      {/* EXPIRING SOON: collapsed until opened */}
      <ExpiringBox rows={expiringSoon} onRenew={openRenew} />

      {/* PENDING: the same detail the owner sees */}
      {pendingSubs.length>0 && (
        <>
          <div className="sec">معلق - بانتظار موافقة المالك</div>
          {pendingSubs.map(s => {
            const pays = pendPays[String(s.id)] || []
            const paid = pays.length ? pays.reduce((a,p) => a+Number(p.amount||0), 0) : Number(s.paid_amount||0)
            const m = Number(s.months) || 1
            const tags = [
              `${m} ${m===1?'شهر':'أشهر'}`,
              s.type==='family' ? `عائلة · ${s.members_count||'?'} أفراد` : null,
              s.has_kit ? `طقم ${s.kit_item==='طقم شتوي'?'شتوي':'صيفي'}${Number(s.kit_qty||1)>1?` × ${s.kit_qty}`:''}` : null,
              s.type!=='family' && Array.isArray(s.players) && s.players[0]?.ages?.length ? s.players[0].ages.join('، ') : null,
              s.has_bus ? `باص · ${s.bus_months||1} ${(s.bus_months||1)===1?'شهر':'أشهر'}` : null,
            ].filter(Boolean)
            return (
              <div key={s.id} className="card" style={{ marginBottom:'.6rem', padding:'.85rem 1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div>
                    <div className="list-name">{s.name}{s.renewal_of?' (تجديد)':''}</div>
                    <div className="list-sub">{s.start_date||''} ← {s.end_date||''}{s.guardian_phone?` · 📞 ${s.guardian_phone}`:''}</div>
                  </div>
                  <span className="badge badge-o" style={{ fontSize:10, flexShrink:0 }}>معلق</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:8 }}>
                  {tags.map(t => <span key={t} style={{ fontSize:10, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'2px 8px', color:'var(--t2)' }}>{t}</span>)}
                </div>
                {s.type==='family' && Array.isArray(s.players) && s.players.length>0 && (
                  <div style={{ fontSize:11, color:'var(--t2)', marginTop:6 }}>{s.players.map(p => `${p.name}${p.ages?.length?` (${p.ages.join('، ')})`:''}`).join(' · ')}</div>
                )}
                <PayBreakdown hasMoney total={Number(s.total_amount||0)} paid={paid} pays={pays} />
                <div style={{ marginTop:'.8rem', paddingTop:'.7rem', borderTop:'1px solid var(--border)' }}>
                  <button onClick={() => deleteSub(s)} style={{ ...btn('var(--red-l)','var(--red-m)','var(--red)'), fontSize:11, padding:'4px 12px' }}>حذف</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      <div style={{ display:'flex', gap:'.4rem', overflowX:'auto', marginBottom:'.75rem', scrollbarWidth:'none' }}>
        {[['all','الكل'],['unpaid','عليه مبلغ'],['expiring','ينتهي قريباً'],['expired','منتهي'],['bus','الباص'],['kit','اشترى طقم']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, border:'1.5px solid', borderColor:filter===v?'var(--red)':'var(--border)', background:filter===v?'var(--red-l)':'var(--surface)', color:filter===v?'var(--red)':'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:filter===v?600:400 }}>{l}</button>
        ))}
      </div>
      <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
        <input className="search-input" placeholder="ابحث باسم المشترك..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
        {loading ? <div className="loading">جاري التحميل...</div> : filtered.length===0 ? <div className="empty"><div className="empty-icon">👥</div>لا يوجد مشتركون</div> :
          filtered.map((s,i) => {
            const st = subStatus(s.end_date)
            return (
              <div key={s.id} className="list-row">
                <div className="list-left" style={{ cursor:'pointer' }} onClick={() => setDetailSub(s)}>
                  <div className={`list-av ${avColors[i%4]}`}>{s.name[0]}</div>
                  <div style={{ minWidth:0 }}>
                    <div className="list-name">{s.name}</div>
                    <div className="list-sub">{s.sub_amount>0?`${fmt(s.sub_amount)} ⃁`:''}{s.type==='family'?` · عائلة ${s.members_count||''} أفراد`:''}{s.has_bus?' · باص':''}{s.has_kit?' · طقم':''}{s.guardian_phone?` · 📞 ${s.guardian_phone}`:''}</div>
                    <div className="list-sub">{s.end_date?`حتى ${s.end_date}`:''}</div>
                  </div>
                </div>
                <div className="list-right">
                  <div className="list-amt">{fmt(s.total_amount||s.sub_amount)} ⃁</div>
                  {Number(s.balance)>0 && <div style={{ fontSize:10, color:'var(--red)', fontWeight:600 }}>متبقي {fmt(s.balance)} ⃁</div>}
                  <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    <span className={`badge ${st.cls}`} style={{ fontSize:9 }}>{st.label}</span>
                    {Number(s.balance)>0 && <button onClick={() => setPayTarget({ type:'subscriber', rec:s })} style={btn('var(--red-l)','var(--red-m)','var(--red)')}>دفعة</button>}
                    <button onClick={() => openRenew(s)} style={btn('var(--green-l)','var(--green)','var(--green)')}>تجديد</button>
                    {!s.is_frozen && <button onClick={() => { setFreezeSub(s); setFreezeDays(7); setFreezeModal(true) }} style={btn('#e0f2fe','#38bdf8','#0369a1')}>تجميد</button>}
                    {s.is_frozen && <button onClick={async () => { await supabase.from('subscribers').update({is_frozen:false}).eq('id',s.id); toast('✅ تم إلغاء التجميد','success'); load() }} style={btn('#e0f2fe','#38bdf8','#0369a1')}>إلغاء تجميد ❄️</button>}
                    <button onClick={() => { setEditSub(s); setEditForm({ name:s.name, phone:s.guardian_phone||'', startDate:s.start_date||'', endDate:s.end_date||'' }); setEditModal(true) }} style={btn('var(--surface2)','var(--border)','var(--t2)')}>تعديل</button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      <button className="fab" onClick={openAdd}>👤</button>
      </>}

      {/* RENEW MODAL */}
      <Modal open={renewModal} onClose={() => setRenewModal(false)} title={`تجديد: ${renewSub?.name||''}`}>
        {renewSub?.end_date && <div className="info-box info-blue">الاشتراك الحالي ينتهي في {renewSub.end_date}{renewSub.end_date<TODAY?' (منتهي). التجديد يبدأ من اليوم.':'. التجديد يبدأ من تاريخ انتهائه.'}</div>}
        <SubPricingForm f={renewForm} setF={setRenewForm} BUS_PRICES={BUS_PRICES} inventory={inventory}/>
        {errBox}
        <button className="btn-primary" disabled={submitting} onClick={renew} style={{ background:'var(--green)' }}>{submitting?'جاري الحفظ...':'تجديد الاشتراك ✓'}</button>
        <button className="btn-secondary" onClick={() => setRenewModal(false)}>إلغاء</button>
      </Modal>

      {/* FREEZE MODAL */}
      <Modal open={freezeModal} onClose={() => setFreezeModal(false)} title={`تجميد اشتراك: ${freezeSub?.name||''}`}>
        <div className="info-box info-blue">سيتم تمديد تاريخ الانتهاء بعدد الأيام المحددة تلقائياً.</div>
        <div className="form-group">
          <label className="form-label">عدد أيام التجميد</label>
          <input className="form-input" type="number" min="1" max="90" value={freezeDays} onChange={e => setFreezeDays(e.target.value)}/>
          <div className="list-sub" style={{ marginTop:4 }}>تاريخ الانتهاء الجديد: {freezeSub?.end_date ? addDaysStr(freezeSub.end_date, Number(freezeDays)) : ''}</div>
        </div>
        <button className="btn-primary" onClick={freezeSubscriber}>تجميد الاشتراك ❄️</button>
        <button className="btn-secondary" onClick={() => setFreezeModal(false)}>إلغاء</button>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`تعديل: ${editSub?.name||''}`}>
        <div className="form-group"><label className="form-label">الاسم</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">رقم ولي الأمر</label><input className="form-input" type="tel" value={editForm.phone} onChange={e => setEditForm(f=>({...f,phone:e.target.value}))} placeholder="05XXXXXXXX"/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">تاريخ البداية</label><input className="form-input" type="date" value={editForm.startDate} onChange={e => setEditForm(f=>({...f,startDate:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">تاريخ الانتهاء</label><input className="form-input" type="date" value={editForm.endDate} onChange={e => setEditForm(f=>({...f,endDate:e.target.value}))}/></div>
        </div>
        <div className="form-group">
          <label className="form-label">إجمالي الاشتراك (⃁)</label>
          <input className="form-input" readOnly value={fmt(editSub?.total_amount||0)+' ⃁'} style={{ color:'var(--t3)', background:'var(--surface2)' }}/>
          <div className="list-sub" style={{ marginTop:4 }}>المبلغ لا يُعدَّل بعد الاعتماد. إن كان فيه خطأ يصححه المالك، وللمبلغ المتبقي استخدم تسجيل دفعة.</div>
        </div>
        <button className="btn-primary" disabled={submitting} onClick={saveEdit}>{submitting?'جاري الحفظ...':'حفظ التعديلات'}</button>
        <button className="btn-secondary" onClick={() => setEditModal(false)}>إلغاء</button>
      </Modal>

      {/* ADD / FIX A RETURNED SUBSCRIPTION */}
      <Modal open={modal} onClose={closeAdd} title={resendRec ? `تعديل وإعادة إرسال: ${resendRec.name}` : 'إضافة مشترك جديد'}>
        {resendRec?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {resendRec.return_reason}</div>}
        <div className="form-row">
          {form.type !== 'family' && <div className="form-group"><label className="form-label">الاسم</label><input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="اسم المشترك"/></div>}
          <div className="form-group"><label className="form-label">رقم ولي الأمر</label><input className="form-input" type="tel" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="05XXXXXXXX"/></div>
        </div>
        <div className="form-group">
          <label className="form-label">النوع</label>
          <select className="form-select" value={form.type} onChange={e => { const t = e.target.value; setForm(f => { const n = t==='family' ? Math.max(2, Number(f.members)||2) : 1; return { ...f, type:t, members:n, players: syncPlayers(f.players, n), subOverride:'' } }) }}>
            <option value="individual">فردي</option><option value="family">عائلي</option>
          </select>
        </div>
        <SubPricingForm f={form} setF={setForm} BUS_PRICES={BUS_PRICES} inventory={inventory}/>
        {errBox}
        <button className="btn-primary" disabled={submitting} onClick={resendRec ? resend : submit}>{submitting?'جاري الحفظ...':resendRec?'إعادة الإرسال للمالك':'إضافة المشترك'}</button>
        <button className="btn-secondary" onClick={closeAdd}>إلغاء</button>
      </Modal>

      <SubscriberDetail sub={detailSub} onClose={() => setDetailSub(null)}/>
      <PaymentModal target={payTarget} onClose={() => setPayTarget(null)} toast={toast} onDone={load} createdBy={createdBy}/>
    </div>
  )
}

// ============ STAFF BUS ============
function StaffBus({ refresh, branch, toast }) {
  const [subs, setSubs] = useState([])
  const emptyBus = { months:1, price:150, override:'', payment:'نقدي', receiptUrl:'' }
  const [extModal, setExtModal] = useState(false)
  const [extSub, setExtSub] = useState(null)
  const [extForm, setExtForm] = useState(emptyBus)
  const [addBusModal, setAddBusModal] = useState(false)
  const [allSubs, setAllSubs] = useState([])
  const [busSearch, setBusSearch] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [busMonth, setBusMonth] = useState(0)
  const [selectedForBus, setSelectedForBus] = useState(null)
  const [addBusForm, setAddBusForm] = useState(emptyBus)
  const BUS_PRICES = [150,200,250,300,350,400,450,500,550,600,650,700,750]
  const createdBy = ROLES[branch==='jazan'?'admin_jazan':'admin_riyadh']?.label
  const extAmount = finalAmount(extForm.price*extForm.months, extForm.override)
  const addAmount = finalAmount(addBusForm.price*addBusForm.months, addBusForm.override)

  async function load() {
    const [bus, all] = await Promise.all([
      supabase.from('subscribers').select('*').eq('branch', branch).eq('has_bus', true).eq('status','approved').eq('is_current', true).order('created_at',{ascending:false}),
      supabase.from('subscribers').select('*').eq('branch', branch).eq('status','approved').eq('is_current', true).eq('has_bus', false).order('name'),
    ])
    setSubs((bus.data||[]).sort(busNewest)); setAllSubs((all.data||[]).sort(newestFirst))
  }
  useEffect(() => { load() }, [refresh, branch])
  // bus fees received in the month and approved (they are passed on to the bus owners)
  useEffect(() => { fetchRevenue(branch, month).then(r => setBusMonth(r.bus)) }, [month, refresh, branch])

  // the bus amount is passed through to the bus owners: it is a payment on the subscriber, but not academy revenue
  async function busPayment(rec, amount, form) {
    if (!(amount > 0)) return { error: null }
    return supabase.from('payments').insert({
      branch, record_type:'subscriber', record_id:String(rec.id), amount, method:form.payment,
      receipt_url:form.receiptUrl||null, paid_at:TODAY, status:'pending', kind:'later',
      label:rec.name, note:'باص', pass_amount:amount, kit_part:0, created_by:createdBy
    })
  }

  async function addToBus() {
    if (!selectedForBus) { alert('اختر مشتركاً'); return }
    if (addBusForm.payment!=='نقدي'&&!addBusForm.receiptUrl) { alert('يجب رفع الإيصال'); return }
    const amount = addAmount
    const busEnd = new Date(TODAY)
    busEnd.setMonth(busEnd.getMonth()+Number(addBusForm.months))
    const { error } = await supabase.from('subscribers').update({
      has_bus: true,
      bus_amount: Number(selectedForBus.bus_amount||0)+amount,
      bus_price_per_month: addBusForm.price,
      bus_months: addBusForm.months,
      bus_start_date: TODAY,
      bus_end_date: busEnd.toISOString().slice(0,10),
      total_amount: Number(selectedForBus.total_amount||0)+amount,
      paid_amount: Number(selectedForBus.paid_amount||0)+amount,
    }).eq('id', selectedForBus.id)
    if (error) { toast('خطأ في الحفظ','error'); console.error(error); return }
    await busPayment(selectedForBus, amount, addBusForm)
    toast('✅ تم إضافة المشترك للباص','success')
    setAddBusModal(false)
    setSelectedForBus(null)
    setBusSearch('')
    setAddBusForm(emptyBus)
    load()
  }

  async function extendBus() {
    if (!extSub) return
    if (extForm.payment!=='نقدي'&&!extForm.receiptUrl) { alert('يجب رفع الإيصال'); return }
    const amount = extAmount
    const newBusEnd = new Date(extSub.bus_end_date||TODAY)
    newBusEnd.setMonth(newBusEnd.getMonth()+Number(extForm.months))
    const { error } = await supabase.from('subscribers').update({
      bus_amount: Number(extSub.bus_amount||0)+amount,
      bus_months: Number(extSub.bus_months||0)+Number(extForm.months),
      bus_end_date: newBusEnd.toISOString().slice(0,10),
      total_amount: Number(extSub.total_amount||0)+amount,
      paid_amount: Number(extSub.paid_amount||0)+amount,
    }).eq('id', extSub.id)
    if (error) { toast('خطأ في الحفظ','error'); console.error(error); return }
    await busPayment(extSub, amount, extForm)
    toast('✅ تم تمديد اشتراك الباص','success')
    setExtModal(false); setExtForm(emptyBus); load()
  }


  const q = listSearch.trim()
  const shownSubs = q ? subs.filter(s => (s.name || '').includes(q) || (s.guardian_phone || '').includes(q)) : subs

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">مستخدمو الباص</div>
          <div className="kpi-val">{subs.length} مشترك</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">رسوم الباص المحصّلة · {MONTHS.find(m => m.value === month)?.label.split(' ')[0]}</div>
          <div className="kpi-val">{fmt(busMonth)} ⃁</div>
        </div>
      </div>
      <div style={{ background:'var(--orange-l)', border:'1px solid #fbbf24', borderRadius:8, padding:'.6rem .875rem', fontSize:12, color:'var(--orange)', marginBottom:'.75rem' }}>
        ⚠️ رسوم الباص تُحوَّل لأصحاب الباص ولا تدخل في حسابات الأكاديمية
      </div>
      <div className="sec">قائمة الباص ({q ? `${shownSubs.length} من ${subs.length}` : subs.length} مشترك)</div>
      <div className="search-wrap" style={{ borderRadius:'var(--r) var(--r) 0 0', border:'1px solid var(--border)' }}>
        <input className="search-input" placeholder="ابحث باسم المشترك أو رقمه..." value={listSearch} onChange={e => setListSearch(e.target.value)}/>
      </div>
      <div className="card" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
        {shownSubs.length===0 ? <div className="empty"><div className="empty-icon">🚌</div>{subs.length===0 ? 'لا يوجد مشتركون بالباص' : 'لا توجد نتائج'}</div> :
          shownSubs.map((s,i) => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-blue">{s.name[0]}</div>
                <div>
                  <div className="list-name">{s.name}</div>
                  <div className="list-sub">{s.guardian_phone?`📞 ${s.guardian_phone} · `:''}حتى: {s.bus_end_date||'غير محدد'}</div>
                </div>
              </div>
              <div className="list-right">
                <span className="badge badge-b">{fmt(s.bus_amount||150)} ⃁</span>
                <button onClick={() => { setExtSub(s); setExtForm({...emptyBus,price:s.bus_price_per_month||150}); setExtModal(true) }}
                  style={{ fontSize:9, background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:5, padding:'2px 6px', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', marginTop:3 }}>تمديد</button>
              </div>
            </div>
          ))}
      </div>

      <button className="fab" onClick={() => setAddBusModal(true)}>🚌</button>

      {/* ADD TO BUS MODAL */}
      <Modal open={addBusModal} onClose={() => { setAddBusModal(false); setSelectedForBus(null); setBusSearch('') }} title="إضافة مشترك للباص">
        {!selectedForBus ? (
          <>
            <div className="form-group">
              <label className="form-label">ابحث عن مشترك</label>
              <input className="form-input" placeholder="اكتب الاسم..." value={busSearch} onChange={e => setBusSearch(e.target.value)} autoFocus/>
            </div>
            <div className="card" style={{ maxHeight:250, overflowY:'auto', margin:0 }}>
              {allSubs.filter(s => !busSearch || s.name.includes(busSearch)).length === 0
                ? <div className="empty" style={{ padding:'1rem' }}>لا يوجد مشتركون بدون باص</div>
                : allSubs.filter(s => !busSearch || s.name.includes(busSearch)).map(s => (
                  <div key={s.id} className="list-row" style={{ cursor:'pointer' }} onClick={() => setSelectedForBus(s)}>
                    <div className="list-left">
                      <div className="list-av list-av-blue">{s.name[0]}</div>
                      <div>
                        <div className="list-name">{s.name}</div>
                        {s.guardian_phone && <div className="list-sub">📞 {s.guardian_phone}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize:11, color:'var(--red)' }}>اختيار ←</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:8, padding:'.75rem', marginBottom:'.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{selectedForBus.name}</div>
                {selectedForBus.guardian_phone && <div style={{ fontSize:11, color:'var(--t3)' }}>📞 {selectedForBus.guardian_phone}</div>}
              </div>
              <button onClick={() => setSelectedForBus(null)} style={{ fontSize:11, background:'transparent', border:'none', color:'var(--t3)', cursor:'pointer' }}>تغيير</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">سعر الباص/شهر</label>
                <select className="form-select" value={addBusForm.price} onChange={e => setAddBusForm(f=>({...f,price:Number(e.target.value),override:''}))}>
                  {BUS_PRICES.map(p=><option key={p} value={p}>{p} ر</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">عدد الأشهر</label>
                <input className="form-input" type="number" min="1" max="12" value={addBusForm.months} onChange={e => setAddBusForm(f=>({...f,months:parseInt(e.target.value)||1,override:''}))}/>
              </div>
            </div>
            <div className="form-group">
            <label className="form-label">السعر النهائي (⃁)</label>
            <input className="form-input" type="number" min="0" placeholder={String(addBusForm.price*addBusForm.months)} value={addBusForm.override} onChange={e => setAddBusForm(f=>({...f,override:e.target.value}))}/>
          </div>
            <div className="form-group">
              <label className="form-label">الإجمالي</label>
              <input className="form-input" readOnly value={fmt(addAmount)+' ⃁'} style={{ fontWeight:700, color:'var(--green)' }}/>
            </div>
            <div className="list-sub" style={{ marginBottom:'.75rem' }}>
              تاريخ انتهاء الباص: {(() => { const d=new Date(TODAY); d.setMonth(d.getMonth()+addBusForm.months); return d.toISOString().slice(0,10) })()}
            </div>
            <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={addBusForm.payment} onChange={v => setAddBusForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
            {addBusForm.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="subscribers" onUploaded={url => setAddBusForm(f=>({...f,receiptUrl:url}))}/>}
            <button className="btn-primary" onClick={addToBus}>إضافة للباص</button>
            <button className="btn-secondary" onClick={() => { setAddBusModal(false); setSelectedForBus(null); setBusSearch('') }}>إلغاء</button>
          </>
        )}
      </Modal>

      <Modal open={extModal} onClose={() => setExtModal(false)} title={`تمديد باص: ${extSub?.name||''}`}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">عدد الأشهر</label>
            <input className="form-input" type="number" min="1" max="12" value={extForm.months} onChange={e => setExtForm(f=>({...f,months:parseInt(e.target.value)||1,override:''}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">سعر الباص/شهر</label>
            <select className="form-select" value={extForm.price} onChange={e => setExtForm(f=>({...f,price:Number(e.target.value),override:''}))}>
              {BUS_PRICES.map(p=><option key={p} value={p}>{p} ر</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
            <label className="form-label">السعر النهائي (⃁)</label>
            <input className="form-input" type="number" min="0" placeholder={String(extForm.price*extForm.months)} value={extForm.override} onChange={e => setExtForm(f=>({...f,override:e.target.value}))}/>
          </div>
        <div className="form-group">
          <label className="form-label">الإجمالي</label>
          <input className="form-input" readOnly value={fmt(extAmount)+' ⃁'} style={{ fontWeight:700, color:'var(--green)' }}/>
        </div>
        <div className="list-sub" style={{ marginBottom:'.75rem' }}>
          تاريخ انتهاء الباص الجديد: {(() => { const d=new Date(extSub?.bus_end_date||TODAY); d.setMonth(d.getMonth()+extForm.months); return d.toISOString().slice(0,10) })()}
        </div>
        <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={extForm.payment} onChange={v => setExtForm(f=>({...f,payment:v,receiptUrl:''}))}/></div>
        {extForm.payment!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="subscribers" onUploaded={url => setExtForm(f=>({...f,receiptUrl:url}))}/>}
        <button className="btn-primary" onClick={extendBus}>تمديد اشتراك الباص</button>
        <button className="btn-secondary" onClick={() => setExtModal(false)}>إلغاء</button>
      </Modal>
    </div>
  )
}

// ============ STAFF INVENTORY ============
function StaffInventory({ toast, refresh, branch }) {
  const [inventory, setInventory] = useState([])
  const [sales, setSales] = useState([])
  const [subsList, setSubsList] = useState([])
  const [monthKits, setMonthKits] = useState([])
  const [monthWater, setMonthWater] = useState(0)
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [modal, setModal] = useState(false)
  const [group, setGroup] = useState(null)
  const [size, setSize] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [chosenSub, setChosenSub] = useState(null)
  const blankSale = { qty:1, override:'', paid:'', method:'نقدي', receiptUrl:'' }
  const [form, setForm] = useState(blankSale)
  const [submitting, setSubmitting] = useState(false)
  const [resendSale, setResendSale] = useState(null)      // a returned sale being fixed
  const [payTarget, setPayTarget] = useState(null)
  const createdBy = ROLES[branch==='jazan'?'admin_jazan':'admin_riyadh']?.label

  async function load() {
    const start = month+'-01', end = monthEnd(month)
    const [inv, s, subs, kits, water] = await Promise.all([
      supabase.from('inventory').select('*').order('name'),
      supabase.from('sales').select('*').eq('branch', branch).in('status',['approved','pending','returned']).order('created_at',{ascending:false}).limit(500),
      supabase.from('subscribers').select('id,name,guardian_phone,start_date,created_at').eq('branch', branch).eq('status','approved').eq('is_current', true),
      // kits handed out with subscriptions entered in the month
      supabase.from('subscribers').select('kit_item,kit_qty').eq('branch', branch).in('status',['approved','pending']).eq('has_kit', true).gte('created_at', start+'T00:00:00').lte('created_at', end+'T23:59:59'),
      // water boxes taken with the pitch bookings of the month
      supabase.from('bookings').select('id',{count:'exact',head:true}).eq('branch', branch).eq('water', true).in('status',['approved','pending']).gte('date', start).lte('date', end),
    ])
    setInventory(inv.data||[]); setSales(s.data||[]); setSubsList((subs.data||[]).sort(newestFirst)); setMonthKits(kits.data||[]); setMonthWater(water.count||0)
  }
  useEffect(() => { load() }, [refresh, branch, month])

  const groups = groupInventory(inventory)
  const monthLive = sales.filter(s => (s.status==='approved' || s.status==='pending') && s.created_at?.startsWith(month))
  const visibleSales = monthLive
  const returnedSales = sales.filter(s => s.status==='returned' && s.created_by===createdBy)
  const pendingSales = sales.filter(s => s.status==='pending')
  const monthSales = sales.filter(s => s.status==='approved' && s.created_at?.startsWith(month))
  const monthCollected = monthSales.reduce((a,s) => a+Number(s.paid_amount||0), 0)
  // pieces sold in the month, item by item: store sales + kits given with subscriptions + water boxes with bookings.
  // The top number is the sum of the numbers on the cards, so they always agree.
  const soldMap = {}
  monthLive.forEach(s => { soldMap[s.item] = (soldMap[s.item] || 0) + Number(s.qty || 1) })
  monthKits.forEach(k => { soldMap[k.kit_item] = (soldMap[k.kit_item] || 0) + Number(k.kit_qty || 1) })
  soldMap['مياه'] = (soldMap['مياه'] || 0) + monthWater
  const seenName = {}
  const gridItems = inventory.map(r => { if (seenName[r.name]) return { ...r, sold: 0 }; seenName[r.name] = true; return { ...r, sold: soldMap[r.name] || 0 } })
  const monthUnits = groupInventory(gridItems).reduce((a, g) => a + Number(g.sold || 0), 0)

  function openSale(g) {
    setResendSale(null); setGroup(g); setSize(''); setChosenSub(null); setSubSearch(''); setForm(blankSale); setModal(true)
  }
  function closeSale() { setModal(false); setGroup(null); setChosenSub(null); setResendSale(null) }

  // the owner returned it: open the same form, already filled in
  async function openResend(s) {
    const g = groups.find(x => x.name === s.item)
    if (!g) { alert('الصنف غير موجود في المخزون'); return }
    const { data: pays } = await supabase.from('payments').select('*').eq('record_type','sale').eq('record_id', String(s.id)).eq('kind','initial')
    const pay = (pays||[])[0]
    setResendSale(s); setGroup(g); setSize(s.size||''); setSubSearch('')
    setChosenSub(s.subscriber_id ? { id:s.subscriber_id, name:s.subscriber_name } : null)
    const baseT = Number(g.price) * Number(s.qty)
    setForm({ qty:s.qty, override: Number(s.total) !== baseT ? String(s.total) : '', paid: String(Number(s.paid_amount||0)), method: pay?.method || 'نقدي', receiptUrl: pay?.receipt_url || '' })
    setModal(true)
  }

  async function deleteReturned(s) {
    if (!confirm('هل تريد حذف هذا البيع؟')) return
    await supabase.from('payments').delete().eq('record_type','sale').eq('record_id', String(s.id))
    await supabase.from('sales').delete().eq('id', s.id)
    toast('تم الحذف','error'); load()
  }

  // live figures for the sale form
  const sizeRow = group && group.sized ? group.rows.find(r => r.size === size) : null
  const qty = Math.max(1, Number(form.qty) || 1)
  const baseTotal = Number(group?.price || 0) * qty
  const total = finalAmount(baseTotal, form.override)
  const paidNow = form.paid === '' ? total : Number(form.paid)
  const remaining = total - paidNow
  const avail = group ? (group.derived ? group.stock : sizeRow ? sizeRow.stock : group.stock) : 0
  const needsSub = !!group && group.name !== 'مياه'

  async function submit() {
    if (!group) return
    if (group.sized && !sizeRow) { alert('اختر المقاس'); return }
    if (needsSub && !chosenSub) { alert('اختر المشترك'); return }
    if (qty > avail) { alert(`المتاح في المخزون ${avail} فقط`); return }
    if (isNaN(paidNow) || paidNow < 0 || paidNow > total) { alert('المبلغ المدفوع غير صحيح'); return }
    if (paidNow > 0 && form.method !== 'نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const fields = {
      item: group.name, size: sizeRow?.size || null, qty, price: Math.round(total/qty), total,
      discount_amount: Math.max(0, baseTotal-total),
      payment_method: paidNow>0 ? form.method : 'غير مدفوع',
      has_receipt: paidNow>0 && form.method!=='نقدي', receipt_url: form.receiptUrl || null,
      created_by: createdBy, branch, status: 'pending',
      subscriber_id: chosenSub ? String(chosenSub.id) : null, subscriber_name: chosenSub?.name || null,
      paid_amount: paidNow, balance: total-paidNow
    }
    const parts = [{ method: form.method, amount: paidNow, receipt: form.receiptUrl }]
    if (resendSale) {
      const { error } = await supabase.from('sales').update({ ...fields, return_reason: null, returned_at: null }).eq('id', resendSale.id)
      if (error) { setSubmitting(false); toast('خطأ في الحفظ','error'); console.error(error); return }
      await supabase.from('payments').delete().eq('record_type','sale').eq('record_id', String(resendSale.id)).eq('kind','initial')
      // the stock went back when it was returned; it goes out again now
      await supabase.rpc('adjust_inventory', { p_name: group.name, p_size: sizeRow?.size || '', p_qty: -qty })
      await insertInitialPayments({ branch, type:'sale', rec:{ ...resendSale, ...fields }, label: chosenSub?.name || group.name, createdBy, parts })
      toast('✅ أُعيد الإرسال للمالك','success')
    } else {
      const { data, error } = await supabase.from('sales').insert(fields).select().single()
      if (error) { setSubmitting(false); toast('خطأ في الحفظ','error'); console.error(error); return }
      await insertInitialPayments({ branch, type:'sale', rec:data, label: chosenSub?.name || group.name, createdBy, parts })
      toast('✅ تم الحفظ بنجاح','success')
    }
    setSubmitting(false)
    closeSale(); load()
  }

  const subMatches = subsList.filter(s => !subSearch || s.name.includes(subSearch)).slice(0, 30)

  return (
    <div className="page">
      <div className="month-bar">
        <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">المحصّل من المبيعات · {MONTHS.find(m => m.value === month)?.label.split(' ')[0]}</div><div className="kpi-val kpi-val-g">{fmt(monthCollected)} ⃁</div></div>
        <div className="kpi"><div className="kpi-label">قطع مباعة · {MONTHS.find(m => m.value === month)?.label.split(' ')[0]}</div><div className="kpi-val">{monthUnits} قطعة</div></div>
      </div>

      <ReturnedSection count={returnedSales.length}>
        {returnedSales.map(s => (
          <ReturnedCard key={s.id} title={`${s.item}${s.size ? ' · '+s.size : ''} × ${s.qty}`} sub={`${s.subscriber_name || ''} · ${s.created_at?.slice(0,10)}`} amount={s.total}
            reason={s.return_reason} returnedAt={s.returned_at} onEdit={() => openResend(s)} onDelete={() => deleteReturned(s)} />
        ))}
      </ReturnedSection>
      <ReturnedPaymentsBox branch={branch} recordType="sale" createdBy={createdBy} refresh={refresh} toast={toast} onDone={load} />

      {pendingSales.length>0 && (
        <div className="info-box info-yellow">{pendingSales.length} مبيعات بانتظار موافقة المالك</div>
      )}

      <InventoryGrid items={gridItems} onSale={openSale} showSold />

      <div className="sec">سجل المبيعات · {MONTHS.find(m => m.value === month)?.label}</div>
      <div className="card">
        {visibleSales.length===0 ? <div className="empty"><div className="empty-icon">🛍️</div>لا يوجد مبيعات في هذا الشهر</div> :
          visibleSales.map(s => (
            <div key={s.id} className="list-row">
              <div className="list-left">
                <div className="list-av list-av-green">🛍</div>
                <div>
                  <div className="list-name">{s.item}{s.size ? ` · ${s.size}` : ''} × {s.qty}</div>
                  <div className="list-sub">{s.subscriber_name ? `${s.subscriber_name} · ` : ''}{s.created_at?.slice(0,10)}</div>
                  {s.receipt_url && <a href={s.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                </div>
              </div>
              <div className="list-right">
                <span className="badge badge-g">{fmt(s.total)} ⃁</span>
                {Number(s.balance)>0 && <span style={{ fontSize:10, color:'var(--red)', fontWeight:600 }}>متبقي {fmt(s.balance)} ⃁</span>}
                {s.status==='pending' && <span className="badge badge-o" style={{ fontSize:9, marginTop:3 }}>معلق</span>}
                {s.status==='approved' && Number(s.balance)>0 && <button onClick={() => setPayTarget({ type:'sale', rec:s })}
                  style={{ fontSize:9, background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:5, padding:'2px 6px', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', marginTop:3 }}>دفعة</button>}
              </div>
            </div>
          ))}
      </div>

      <button className="fab" onClick={() => groups.length>0 && openSale(groups[0])}>🛍️</button>

      <Modal open={modal} onClose={closeSale} title={resendSale ? 'تعديل بيع وإعادة إرساله' : 'تسجيل بيع'}>
        {resendSale?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {resendSale.return_reason}</div>}
        <div className="form-group">
          <label className="form-label">الصنف</label>
          <select className="form-select" value={group?.name||''} onChange={e => { setGroup(groups.find(g => g.name===e.target.value)); setSize('') }}>
            {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
        </div>
        {group?.sized && (
          <div className="form-group">
            <label className="form-label">المقاس</label>
            <select className="form-select" value={size} onChange={e => setSize(e.target.value)}>
              <option value="">اختر المقاس</option>
              {group.rows.map(r => <option key={r.id} value={r.size} disabled={r.stock<=0}>{r.size} (متبقي {r.stock})</option>)}
            </select>
          </div>
        )}
        {needsSub && (
          <div className="form-group">
            <label className="form-label">المشترك</label>
            {chosenSub ? (
              <div style={{ background:'var(--green-l)', border:'1px solid var(--green)', borderRadius:8, padding:'.6rem .75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{chosenSub.name}</div>
                <button onClick={() => setChosenSub(null)} style={{ fontSize:11, background:'transparent', border:'none', color:'var(--t3)', cursor:'pointer' }}>تغيير</button>
              </div>
            ) : (
              <>
                <input className="form-input" placeholder="ابحث باسم المشترك..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
                <div className="card" style={{ maxHeight:180, overflowY:'auto', margin:'6px 0 0' }}>
                  {subMatches.length===0 ? <div className="empty" style={{ padding:'.75rem' }}>لا توجد نتائج</div> : subMatches.map(s => (
                    <div key={s.id} className="list-row" style={{ cursor:'pointer' }} onClick={() => setChosenSub(s)}>
                      <div className="list-name">{s.name}</div>
                      <span style={{ fontSize:11, color:'var(--green)' }}>اختيار ←</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="form-row">
          <div className="form-group"><label className="form-label">الكمية ({group?invUnit(group.name):''})</label><input className="form-input" type="number" min="1" value={form.qty} onChange={e => setForm(f=>({...f,qty:e.target.value,override:''}))}/></div>
          <div className="form-group"><label className="form-label">سعر الوحدة</label><input className="form-input" readOnly value={fmt(group?.price||0)+' ⃁'}/></div>
        </div>
        <div className="form-group">
          <label className="form-label">السعر النهائي (⃁)</label>
          <input className="form-input" type="number" min="0" placeholder={String(baseTotal)} value={form.override} onChange={e => setForm(f=>({...f,override:e.target.value}))}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700, marginBottom:'.75rem' }}>
          <span style={{ color:'var(--t1)' }}>الإجمالي</span>
          <span style={{ color:'var(--green)' }}>{fmt(total)} ⃁</span>
        </div>
        <div className="form-group">
          <label className="form-label">المدفوع الآن (اتركه فارغاً للدفع كاملاً)</label>
          <input className="form-input" type="number" min="0" placeholder={String(total)} value={form.paid} onChange={e => setForm(f=>({...f,paid:e.target.value}))}/>
          {remaining>0 && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>سيبقى {fmt(remaining)} ⃁ مستحقاً على المشترك</div>}
        </div>
        {paidNow>0 && <div className="form-group"><label className="form-label">طريقة الدفع</label><PaymentBtns value={form.method} onChange={v => setForm(f=>({...f,method:v,receiptUrl:''}))}/></div>}
        {paidNow>0 && form.method!=='نقدي' && <ReceiptUpload label="إرفاق الإيصال" folder="sales" current={form.receiptUrl} onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/>}
        <button className="btn-primary" disabled={submitting} onClick={submit} style={{ background:'var(--green)' }}>{submitting?'جاري الحفظ...':resendSale?'إعادة الإرسال للمالك':'تسجيل البيع'}</button>
        <button className="btn-secondary" onClick={closeSale}>إلغاء</button>
      </Modal>

      <PaymentModal target={payTarget} onClose={() => setPayTarget(null)} toast={toast} onDone={load} createdBy={createdBy}/>
    </div>
  )
}

// ============ MY EXPENSES ============
function MyExpenses({ role, toast, refresh, branch }) {
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [pending, setPending] = useState([])
  const [returned, setReturned] = useState([])
  const [approved, setApproved] = useState([])
  const blank = { cat:'', desc:'', amount:'', date:TODAY, payment:'نقدي', receiptUrl:'' }
  const [form, setForm] = useState(blank)
  const [resendExp, setResendExp] = useState(null)       // a returned expense being fixed
  const [submitting, setSubmitting] = useState(false)
  const by = ROLES[role]?.label

  async function load(m) {
    const [p, r, a] = await Promise.all([
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','pending').eq('submitted_by', by).order('created_at',{ascending:false}),
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','returned').eq('submitted_by', by).order('returned_at',{ascending:false}),
      supabase.from('expenses').select('*').eq('branch', branch).eq('status','approved').eq('submitted_by', by).gte('date', m+'-01').lte('date', monthEnd(m)).order('date',{ascending:false}),
    ])
    setPending(p.data||[]); setReturned(r.data||[]); setApproved(a.data||[])
  }
  useEffect(() => { load(month) }, [month, refresh])

  function openResend(e) {
    setResendExp(e)
    setForm({ cat:e.category, desc:e.description, amount:String(e.amount), date:e.date, payment:e.payment_method||'نقدي', receiptUrl:e.receipt_url||'' })
    if (typeof window !== 'undefined') window.scrollTo({ top:0, behavior:'smooth' })
  }
  function cancelResend() { setResendExp(null); setForm(blank) }

  async function deleteExpense(e) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return
    await supabase.from('expenses').delete().eq('id', e.id)
    load(month)
  }

  async function submit() {
    if (!form.cat||!form.desc||!form.amount) { alert('أكمل جميع الحقول واختر التصنيف'); return }
    if (form.payment!=='نقدي' && !form.receiptUrl) { alert('يجب رفع الإيصال'); return }
    setSubmitting(true)
    const fields = {
      category:form.cat, description:form.desc, amount:parseFloat(form.amount),
      date:form.date, payment_method:form.payment, has_receipt:form.payment!=='نقدي',
      receipt_url:form.receiptUrl||null, status:'pending', submitted_by:by, branch
    }
    const { error } = resendExp
      ? await supabase.from('expenses').update({ ...fields, return_reason:null, returned_at:null }).eq('id', resendExp.id)
      : await supabase.from('expenses').insert(fields)
    setSubmitting(false)
    if (error) { toast('خطأ في الحفظ','error'); return }
    toast(resendExp ? '✅ أُعيد الإرسال للمالك' : '✅ تم تسجيل المصروف بنجاح','success')
    setResendExp(null); setForm(blank); load(month)
  }

  return (
    <div className="page">
      <ReturnedSection count={returned.length}>
        {returned.map(e => (
          <ReturnedCard key={e.id} title={e.description} sub={`${e.category} · ${e.date}`} amount={e.amount}
            reason={e.return_reason} returnedAt={e.returned_at} onEdit={() => openResend(e)} onDelete={() => deleteExpense(e)} />
        ))}
      </ReturnedSection>

      {/* EXPENSE FORM - on top */}
      <div className="card" style={{ marginBottom:'.75rem' }}>
        <div style={{ padding:'.875rem 1rem' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--red)', marginBottom:'.875rem' }}>{resendExp ? 'تعديل مصروف وإعادة إرساله' : 'تسجيل مصروف جديد'}</div>
          {resendExp?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {resendExp.return_reason}</div>}
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
            <input className="form-input" type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="المبلغ (⃁)"/>
            <input className="form-input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <PaymentBtns value={form.payment} onChange={v => setForm(f=>({...f,payment:v,receiptUrl:''}))}/>
          {form.payment!=='نقدي' && <div style={{ marginTop:'.75rem' }}><ReceiptUpload label="إرفاق الإيصال" folder="expenses" current={form.receiptUrl} onUploaded={url => setForm(f=>({...f,receiptUrl:url}))}/></div>}
          <button className="btn-primary" style={{ marginTop:'.75rem' }} disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':resendExp?'إعادة الإرسال للمالك ⟶':'تسجيل المصروف ⟶'}</button>
          {resendExp && <button className="btn-secondary" onClick={cancelResend}>إلغاء التعديل</button>}
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
        <div className="strip-item"><div className="strip-label">إجمالي معتمد</div><div className="strip-val">{fmt(approved.reduce((a,e)=>a+Number(e.amount),0))} ⃁</div></div>
      </div>

      {pending.length>0 && (
        <>
          <div className="sec">بانتظار الموافقة</div>
          {pending.map(a => (
            <div key={a.id} className="approval-card">
              <div className="approval-head"><span style={{ fontSize:11, fontWeight:600, color:'var(--t3)' }}>{a.category}</span><span className="badge badge-o">معلق</span></div>
              <div className="approval-body">
                <div className="approval-desc">{a.description}</div>
                <div className="approval-meta">{a.date} · {fmt(a.amount)} ⃁ · {a.payment_method}</div>
                {a.receipt_url && <a href={a.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                <button onClick={() => deleteExpense(a)}
                  style={{ fontSize:10, background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:6, padding:'3px 10px', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', marginTop:6, display:'inline-block' }}>حذف</button>
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
              <span className="badge badge-g">{fmt(e.amount)} ⃁</span>
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
  const label = ROLES[role]?.label
  const blankBooking = { name:'', phone:'', date:TODAY, time:'', depCash:'', depNet:'', depTr:'' }
  const [form, setForm] = useState(blankBooking)
  const [resendBk, setResendBk] = useState(null)      // a returned booking being fixed
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [returnedClosings, setReturnedClosings] = useState([])
  const [closing, setClosing] = useState(null)        // the daily closing form: { day, ticks, cash, network, transfer, proofUrl, resend }
  const [closeError, setCloseError] = useState('')

  async function load() {
    const [b, c] = await Promise.all([
      supabase.from('bookings').select('*').eq('branch', branch).order('date',{ascending:false}).limit(1000),
      supabase.from('day_closings').select('*').eq('branch', branch).eq('status','returned').eq('created_by', label),
    ])
    setBookings(b.data||[]); setReturnedClosings(c.data||[])
  }
  useEffect(() => { load() }, [refresh, branch])

  // a booking can be deleted by the person who entered it only while no money is attached to it
  const canDelete = b => b.created_by === label && Number(b.collected || 0) === 0 && ['approved','pending','returned'].includes(b.status)
  async function deleteBooking(b) {
    if (!confirm('هل تريد حذف هذا الحجز؟')) return
    // a returned booking already gave its water box back
    if (b.water && ['pending','approved'].includes(b.status)) await supabase.rpc('adjust_inventory', { p_name: 'مياه', p_size: '', p_qty: 1 })
    await supabase.from('payments').delete().eq('record_type', 'booking').eq('record_id', String(b.id))
    await supabase.from('bookings').delete().eq('id', b.id)
    load()
  }

  // a booking carries no payment from the players: only an optional deposit. The money is collected in the daily closing.
  async function submit() {
    setFormError('')
    if (!form.name.trim()) { setFormError('أدخل اسم الحاجز'); return }
    // only the cash is received now. Network and transfer are noted, and checked in the end of day closing.
    const depCash = Number(form.depCash || 0), depNet = Number(form.depNet || 0), depTr = Number(form.depTr || 0)
    const dep = depCash
    const base = pitch==='small'?250:300
    const amount = base+(water?20:0)
    if (depCash + depNet + depTr > amount) { setFormError('المبلغ المدخل أكبر من قيمة الحجز'); return }

    // Conflict check
    if (form.date && form.time) {
      const conflict = bookings.find(b =>
        b.date === form.date &&
        b.pitch === pitch &&
        b.time === form.time &&
        !['rejected','cancelled','returned'].includes(b.status) &&
        (!resendBk || b.id !== resendBk.id)
      )
      if (conflict) {
        setFormError(`تعارض في الحجز: ${pitch==='small'?'الملعب الصغير':'الملعب الكبير'} محجوز في ${form.date} الساعة ${form.time} باسم "${conflict.booker_name}". اختر وقتاً آخر.`)
        return
      }
    }

    setSubmitting(true)
    const fields = {
      pitch, booker_name: form.name.trim(), booker_phone: form.phone || null,
      date: form.date, time: form.time, water, amount,
      payment_method: dep > 0 ? 'نقدي' : 'غير مدفوع', has_receipt: false, receipt_url: null,
      deposit: dep, deposit_method: 'نقدي', collected: dep, balance: amount - dep,
      claimed_network: depNet, claimed_transfer: depTr,
      payment_splits: [], payment_status: dep >= amount ? 'مكتمل' : dep > 0 ? 'جزئي' : 'غير مدفوع',
      created_by: label, branch, status: 'approved'
    }
    const depositRows = id => depCash > 0 ? [{
      branch, record_type: 'booking', record_id: String(id), amount: depCash, method: 'نقدي', paid_at: TODAY,
      status: 'pending', kind: 'later', note: 'عربون', label: form.name.trim(), created_by: label }] : []
    if (resendBk) {
      const { error } = await supabase.from('bookings').update({ ...fields, return_reason: null, returned_at: null }).eq('id', resendBk.id)
      if (error) { setSubmitting(false); toast('خطأ في الحفظ', 'error'); console.error(error); return }
      await supabase.from('payments').delete().eq('record_type', 'booking').eq('record_id', String(resendBk.id)).eq('status', 'pending')
      // the water box went back to the stock when it was returned; it goes out again now
      if (water) await supabase.rpc('adjust_inventory', { p_name: 'مياه', p_size: '', p_qty: -1 })
      if (dep > 0) await supabase.from('payments').insert(depositRows(resendBk.id))
      toast('✅ تم الحفظ بنجاح', 'success')
    } else {
      const { data, error } = await supabase.from('bookings').insert(fields).select().single()
      if (error) { setSubmitting(false); toast('خطأ في الحفظ', 'error'); console.error(error); return }
      if (dep > 0) await supabase.from('payments').insert(depositRows(data.id))
      toast('✅ تم الحفظ بنجاح', 'success')
    }
    setSubmitting(false)
    setModal(false); setResendBk(null)
    setForm(blankBooking); setWater(false); load()
  }

  // a legacy returned booking: open the same form, already filled in
  async function openResendBk(b) {
    setFormError('')
    const { data: pays } = await supabase.from('payments').select('method,amount').eq('record_type', 'booking').eq('record_id', String(b.id)).eq('status', 'pending')
    const sum = m => (pays || []).filter(p => p.method === m).reduce((a, p) => a + Number(p.amount), 0)
    setResendBk(b); setPitch(b.pitch || 'small'); setWater(!!b.water)
    setForm({ name: b.booker_name || '', phone: b.booker_phone || '', date: b.date, time: b.time || '',
      depCash: sum('نقدي') ? String(sum('نقدي')) : '', depNet: sum('شبكة') ? String(sum('شبكة')) : '', depTr: sum('تحويل') ? String(sum('تحويل')) : '' })
    setModal(true)
  }
  function openNewBooking() { setFormError(''); setResendBk(null); setForm(blankBooking); setPitch('small'); setWater(false); setModal(true) }
  function closeBooking() { setModal(false); setResendBk(null) }

  // ---------- the end of the day ----------
  const sd = shiftDay()
  const openBks = bookings.filter(b => ['approved','pending'].includes(b.status) && Number(b.balance) > 0 && b.date <= sd)
  const openDays = Object.entries(openBks.reduce((m, b) => { (m[b.date] = m[b.date] || []).push(b); return m }, {}))
    .map(([day, list]) => ({ day, list, due: list.reduce((a, b) => a + Number(b.balance), 0) })).sort((a, b) => b.day.localeCompare(a.day))

  function openClosing(day, resend) {
    setCloseError('')
    const ids = resend ? (resend.bookings || []).map(x => x.id) : null
    const list = bookings.filter(b => b.date === day && ['approved','pending'].includes(b.status) && Number(b.balance) > 0)
    const ticks = {}; list.forEach(b => { ticks[b.id] = ids ? ids.includes(b.id) : true })
    setClosing({ day, ticks, auto: !resend, cash: resend ? String(resend.cash || '') : '', network: resend ? String(resend.network || '') : '', transfer: resend ? String(resend.transfer || '') : '', proofUrl: resend?.proof_url || '', resend: resend || null })
  }
  const closingBks = closing ? bookings.filter(b => b.date === closing.day && ['approved','pending'].includes(b.status) && Number(b.balance) > 0) : []
  const tickedBks = closingBks.filter(b => closing?.ticks[b.id])
  const closeDue = tickedBks.reduce((a, b) => a + Number(b.balance), 0)
  // what was noted at booking, for the ticked bookings: network and transfer are expected, the rest of the balance is cash
  const claimNet = tickedBks.reduce((a, b) => a + Number(b.claimed_network || 0), 0)
  const claimTr = tickedBks.reduce((a, b) => a + Number(b.claimed_transfer || 0), 0)
  const autoVals = { cash: Math.max(0, closeDue - claimNet - claimTr), network: claimNet, transfer: claimTr }
  const shown = k => closing?.auto ? autoVals[k] : Number(closing?.[k] || 0)
  const closeCash = shown('cash'), closeNet = shown('network'), closeTr = shown('transfer')
  const closeEntered = closeCash + closeNet + closeTr
  // typing in any box takes over from the automatic amounts
  const typeAmount = (k, v) => setClosing(c => c.auto ? { ...c, auto: false, cash: String(autoVals.cash || ''), network: String(autoVals.network || ''), transfer: String(autoVals.transfer || ''), [k]: v } : { ...c, [k]: v })
  const closeDiff = closeEntered - closeDue

  async function submitClosing() {
    setCloseError('')
    if (!tickedBks.length) { setCloseError('حدد حجزاً واحداً على الأقل'); return }
    if (!(closeEntered > 0)) { setCloseError('أدخل المبلغ المحصّل'); return }
    if ((closeNet > 0 || closeTr > 0) && !closing.proofUrl) { setCloseError('أرفق موازنة اليوم'); return }
    setSubmitting(true)
    const list = tickedBks.map(b => ({ id: b.id, name: b.booker_name, applied: Number(b.balance) }))
    const row = { branch, day: closing.day, bookings: list, due: closeDue, cash: closeCash, network: closeNet, transfer: closeTr,
      entered: closeEntered, difference: closeDiff, expected_network: claimNet, expected_transfer: claimTr, proof_url: closing.proofUrl || null, status: 'pending', created_by: label,
      return_reason: null, returned_at: null }
    const id = closing.resend ? closing.resend.id : crypto.randomUUID()
    const { error } = closing.resend
      ? await supabase.from('day_closings').update(row).eq('id', id)
      : await supabase.from('day_closings').insert({ id, ...row })
    if (error) { setSubmitting(false); toast('خطأ في الحفظ', 'error'); console.error(error); return }
    if (closing.resend) await supabase.from('payments').delete().eq('record_type', 'day').eq('record_id', String(id))
    await applyClosing(list)
    const pays = [['نقدي', closeCash], ['شبكة', closeNet], ['تحويل', closeTr]].filter(([, a]) => a > 0).map(([method, amount]) => ({
      branch, record_type: 'day', record_id: String(id), amount, method, receipt_url: method === 'نقدي' ? null : closing.proofUrl,
      paid_at: TODAY, status: 'pending', kind: 'initial', label: `إقفال ${closing.day}`, created_by: label }))
    await supabase.from('payments').insert(pays)
    setSubmitting(false)
    toast('✅ أُرسل الإقفال للمالك', 'success')
    setClosing(null); load()
  }
  async function deleteClosing(c) {
    if (!confirm('هل تريد حذف هذا الإقفال؟')) return
    await supabase.from('payments').delete().eq('record_type', 'day').eq('record_id', String(c.id))
    await supabase.from('day_closings').delete().eq('id', c.id)
    load()
  }

  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const dayNames = ['ح','ن','ث','ر','خ','ج','س']
  const approvedBookings = bookings.filter(b => b.status==='approved')
  const pendingBookings = bookings.filter(b => b.status==='pending')
  const returnedBks = bookings.filter(b => b.status==='returned' && b.created_by===ROLES[role]?.label)
  const todayBks = approvedBookings.filter(b => b.date===TODAY)
  const todayRev = todayBks.reduce((a,b) => a+Number(b.amount), 0)
  // Show revenue for whichever month is currently displayed in the calendar
  const calMonthStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}`
  const monthBks = approvedBookings.filter(b => b.date?.startsWith(calMonthStr))
  const monthRev = monthBks.reduce((a,b) => a+Number(b.amount), 0)
  const selectedBks = selectedDate ? bookings.filter(b => b.date===selectedDate && (b.status==='approved' || b.status==='pending')) : []
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
        <div className="strip-item"><div className="strip-label">{selectedDate?'إيراد اليوم المحدد':'إيراد اليوم'}</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(selectedDate?selectedRev:todayRev)} ⃁</div></div>
        <div className="strip-item"><div className="strip-label">{selectedDate?'حجوزات اليوم المحدد':'حجوزات اليوم'}</div><div className="strip-val">{selectedDate?selectedBks.length:todayBks.length}</div></div>
        <div className="strip-item"><div className="strip-label">إيراد {monthNames[calMonth]}</div><div className="strip-val" style={{ color:'var(--green)' }}>{fmt(monthRev)} ⃁</div></div>
      </div>

      {pendingBookings.length>0 && (
        <div className="info-box info-yellow">{pendingBookings.length} حجوزات بانتظار موافقة المالك</div>
      )}

      {/* THE END OF THE DAY */}
      {openDays.length > 0 && (
        <div className="card" style={{ borderColor:'var(--orange)', marginBottom:'.75rem' }}>
          <div style={{ padding:'.65rem 1rem', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, color:'var(--orange)' }}>إقفال اليوم</div>
          {openDays.map(d => (
            <div key={d.day} className="list-row">
              <div className="list-left">
                <div>
                  <div className="list-name">{d.day === sd ? 'اليوم' : d.day}{d.day !== sd && <span style={{ color:'var(--red)', fontSize:11, fontWeight:600 }}> · لم يُقفل</span>}</div>
                  <div className="list-sub">{d.list.length} حجوزات · المفروض {fmt(d.due)} ⃁</div>
                </div>
              </div>
              <button onClick={() => openClosing(d.day)} style={{ fontSize:12, background:'var(--green)', border:'none', borderRadius:8, padding:'6px 16px', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>إقفال</button>
            </div>
          ))}
        </div>
      )}

      <ReturnedSection count={returnedBks.length + returnedClosings.length}>
        {returnedClosings.map(c => (
          <ReturnedCard key={c.id} title={`إقفال ${c.day}`} sub={`${(c.bookings||[]).length} حجوزات · المفروض ${fmt(c.due)} ⃁`} amount={c.entered}
            reason={c.return_reason} returnedAt={c.returned_at} onEdit={() => openClosing(c.day, c)} onDelete={() => deleteClosing(c)} />
        ))}
        {returnedBks.map(b => (
          <ReturnedCard key={b.id} title={b.booker_name} sub={`${b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · ${b.date} · ${b.time||''}`} amount={b.amount}
            reason={b.return_reason} returnedAt={b.returned_at} onEdit={() => openResendBk(b)} onDelete={() => deleteBooking(b)} />
        ))}
      </ReturnedSection>
      <ReturnedPaymentsBox branch={branch} recordType="booking" createdBy={label} refresh={refresh} toast={toast} onDone={load} />

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
                    <div className="list-name">{b.booker_name}{b.booker_phone?` · 📞 ${b.booker_phone}`:''}</div>
                    <div className="list-sub">{b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · {b.time}{b.water?' · 💧':''}{Number(b.collected)>0?` · استلم نقداً ${fmt(b.collected)} ⃁`:''}{Number(b.claimed_network)>0?` · شبكة ${fmt(b.claimed_network)} ⃁`:''}{Number(b.claimed_transfer)>0?` · تحويل ${fmt(b.claimed_transfer)} ⃁`:''}</div>
                    {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">📎 إيصال</a>}
                  </div>
                </div>
                <div className="list-right">
                  <span className={`badge ${b.pitch==='small'?'badge-b':'badge-r'}`}>{fmt(b.amount)} ⃁</span>
                  {b.status==='pending' && <span className="badge badge-o" style={{ fontSize:9, marginTop:3 }}>معلق</span>}
                  {canDelete(b) && <button onClick={() => deleteBooking(b)}
                    style={{ fontSize:9, background:'var(--red-l)', border:'1px solid var(--red-m)', borderRadius:5, padding:'2px 6px', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', marginTop:3 }}>حذف</button>}
                </div>
              </div>
            ))}
      </div>

      <div className="sec">بحث في الحجوزات</div>
      <BookingSearch bookings={bookings}/>

      <button className="fab" onClick={openNewBooking}>📅</button>

      <Modal open={modal} onClose={closeBooking} title={resendBk ? `تعديل وإعادة إرسال: ${resendBk.booker_name}` : 'حجز ملعب جديد'}>
        {resendBk?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {resendBk.return_reason}</div>}
        <div className="form-group">
          <label className="form-label">اختر الملعب</label>
          <div className="pitch-grid">
            <div className={`pitch-card ${pitch==='small'?'pitch-selected':''}`} onClick={() => setPitch('small')}><div className="pitch-name">ملعب صغير</div><div className="pitch-price">250 ⃁</div><div className="pitch-sub">2 ساعات</div></div>
            <div className={`pitch-card ${pitch==='big'?'pitch-selected':''}`} onClick={() => setPitch('big')}><div className="pitch-name">ملعب كبير</div><div className="pitch-price">300 ⃁</div><div className="pitch-sub">2 ساعات</div></div>
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
            <div className="water-toggle-left"><span style={{ fontSize:20 }}>💧</span><div><div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>صندوق مياه</div><div style={{ fontSize:12, color:'var(--t3)' }}>+20 ⃁ · <WaterStock branch={branch}/></div></div></div>
            <div className={`toggle-switch ${water?'toggle-on':''}`}/>
          </div>
        </div>
        {/* WHAT WAS RECEIVED WITH THE BOOKING: an amount for each method */}
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'.75rem',marginBottom:'.75rem'}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--t1)',marginBottom:8}}>ما استلمته عند الحجز (اختياري)</div>
          <div className="form-row" style={{marginBottom:0, gridTemplateColumns:'repeat(3, 1fr)'}}>
            <div className="form-group" style={{marginBottom:0}}><label className="form-label">💵 نقدي</label><input className="form-input" type="number" min="0" value={form.depCash} placeholder="0" onChange={e => setForm(f=>({...f,depCash:e.target.value}))}/></div>
            <div className="form-group" style={{marginBottom:0}}><label className="form-label">💳 شبكة</label><input className="form-input" type="number" min="0" value={form.depNet} placeholder="0" onChange={e => setForm(f=>({...f,depNet:e.target.value}))}/></div>
            <div className="form-group" style={{marginBottom:0}}><label className="form-label">📱 تحويل</label><input className="form-input" type="number" min="0" value={form.depTr} placeholder="0" onChange={e => setForm(f=>({...f,depTr:e.target.value}))}/></div>
          </div>
          <div style={{fontSize:10,color:'var(--t3)',marginTop:6}}>النقدي يُحسب مستلماً الآن. الشبكة والتحويل يُراجعان في إقفال اليوم.</div>
        </div>
        {formError && <div style={{ background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)', borderRadius:8, padding:'.5rem .75rem', fontSize:12, fontWeight:600, marginBottom:'.75rem' }}>{formError}</div>}
        <button className="btn-primary" disabled={submitting} onClick={submit}>{submitting?'جاري الحفظ...':'تسجيل الحجز'}</button>
        <button className="btn-secondary" onClick={closeBooking}>إلغاء</button>
      </Modal>

      {/* THE DAILY CLOSING */}
      <Modal open={!!closing} onClose={() => setClosing(null)} title={closing ? `إقفال ${closing.day === sd ? 'اليوم' : closing.day}` : ''}>
        {closing?.resend?.return_reason && <div className="info-box info-yellow">سبب الإرجاع: {closing.resend.return_reason}</div>}
        <div style={{ fontSize:12, fontWeight:600, color:'var(--t1)', marginBottom:6 }}>الحجوزات التي تحصّل مبلغها</div>
        <div className="card" style={{ marginBottom:'.75rem' }}>
          {closingBks.map(b => (
            <div key={b.id} className="list-row" style={{ cursor:'pointer' }} onClick={() => setClosing(c => ({ ...c, ticks: { ...c.ticks, [b.id]: !c.ticks[b.id] } }))}>
              <div className="list-left">
                <div style={{ width:22, height:22, borderRadius:6, border:'2px solid '+(closing.ticks[b.id]?'var(--green)':'var(--border2)'), background:closing.ticks[b.id]?'var(--green)':'#fff', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{closing.ticks[b.id]?'✓':''}</div>
                <div>
                  <div className="list-name">{b.booker_name}</div>
                  <div className="list-sub">{b.pitch==='small'?'ملعب صغير':'ملعب كبير'} · {b.time}{Number(b.collected)>0?` · استلم نقداً ${fmt(b.collected)} ⃁`:''}{Number(b.claimed_network)>0?` · شبكة ${fmt(b.claimed_network)} ⃁`:''}{Number(b.claimed_transfer)>0?` · تحويل ${fmt(b.claimed_transfer)} ⃁`:''}</div>
                </div>
              </div>
              <span className="badge badge-g">{fmt(b.balance)} ⃁</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700, marginBottom:'.75rem' }}>
          <span style={{ color:'var(--t1)' }}>المفروض تحصيله</span><span style={{ color:'var(--green)' }}>{fmt(closeDue)} ⃁</span>
        </div>
        {(claimNet > 0 || claimTr > 0) && <div className="info-box info-blue" style={{ marginBottom:'.5rem' }}>المسجّل عند الحجز: شبكة {fmt(claimNet)} ⃁ · تحويل {fmt(claimTr)} ⃁. صحّح الأرقام إن اختلفت.</div>}
        <div style={{ fontSize:12, fontWeight:600, color:'var(--t1)', marginBottom:6 }}>المبلغ المحصّل</div>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          {[['نقدي كاملاً','cash'],['شبكة كاملاً','network'],['تحويل كاملاً','transfer']].map(([l,k]) => (
            <button key={k} onClick={() => setClosing(c => ({ ...c, auto:false, cash:'', network:'', transfer:'', [k]: String(closeDue) }))} style={{ flex:1, fontSize:11, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 0', color:'var(--t2)', cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
        <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group"><label className="form-label">💵 نقدي</label><input className="form-input" type="number" min="0" value={closeCash||''} placeholder="0" onChange={e => typeAmount('cash', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">💳 شبكة</label><input className="form-input" type="number" min="0" value={closeNet||''} placeholder="0" onChange={e => typeAmount('network', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">📱 تحويل</label><input className="form-input" type="number" min="0" value={closeTr||''} placeholder="0" onChange={e => typeAmount('transfer', e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, marginBottom:'.75rem', padding:'.5rem .75rem', borderRadius:8,
          background: closeEntered === 0 ? 'var(--surface2)' : closeDiff === 0 ? 'var(--green-l)' : closeDiff < 0 ? 'var(--red-l)' : 'var(--orange-l)',
          color: closeEntered === 0 ? 'var(--t3)' : closeDiff === 0 ? 'var(--green)' : closeDiff < 0 ? 'var(--red)' : 'var(--orange)' }}>
          <span>المحصّل {fmt(closeEntered)} ⃁</span>
          <span>{closeEntered === 0 ? '' : closeDiff === 0 ? '✅ مطابق' : closeDiff < 0 ? `نقص ${fmt(-closeDiff)} ⃁` : `زيادة ${fmt(closeDiff)} ⃁`}</span>
        </div>
        {(closeNet > 0 || closeTr > 0) && <ReceiptUpload label="موازنة اليوم (صورة)" folder="closings" current={closing?.proofUrl} onUploaded={url => setClosing(c => ({ ...c, proofUrl:url }))}/>}
        {closeError && <div style={{ background:'var(--red-l)', border:'1px solid var(--red-m)', color:'var(--red)', borderRadius:8, padding:'.5rem .75rem', fontSize:12, fontWeight:600, marginBottom:'.75rem' }}>{closeError}</div>}
        <button className="btn-primary" disabled={submitting} onClick={submitClosing} style={{ background:'var(--green)' }}>{submitting?'جاري الحفظ...':'إرسال الإقفال للمالك'}</button>
        <button className="btn-secondary" onClick={() => setClosing(null)}>إلغاء</button>
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
  const [badges, setBadges] = useState({})

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
        supabase.from('payments').select('id',{count:'exact'}).eq('branch', branch).eq('status','pending').eq('kind','later'),
      ]).then(results => {
        const total = results.reduce((a,r) => a+(r.count||0), 0)
        setPendingCount(total)
      })
    }
  }, [role, activeTab, refreshKey, branch])

  // how many returned cards wait for this person, shown on the tab where they are fixed
  useEffect(() => {
    if (!role || role==='owner') { setBadges({}); return }
    const label = ROLES[role]?.label, br = ROLES[role]?.branch || branch
    const cnt = (table, col) => supabase.from(table).select('id',{count:'exact',head:true}).eq('branch', br).eq('status','returned').eq(col, label)
    Promise.all([
      cnt('subscribers','created_by'), cnt('sales','created_by'), cnt('bookings','created_by'), cnt('expenses','submitted_by'), cnt('day_closings','created_by'),
      supabase.from('payments').select('record_type').eq('branch', br).eq('status','returned').eq('kind','later').eq('created_by', label),
    ]).then(([sb, sl, bk, ex, dc, py]) => {
      const pc = {}; (py.data||[]).forEach(p => { pc[p.record_type] = (pc[p.record_type]||0)+1 })
      setBadges(role.startsWith('admin')
        ? { subs:(sb.count||0)+(pc.subscriber||0), inventory:(sl.count||0)+(pc.sale||0), 'my-expenses':ex.count||0 }
        : { cal:(bk.count||0)+(dc.count||0)+(pc.booking||0), 'my-expenses':ex.count||0 })
    })
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
      if (activeTab==='bus')         return <StaffBus toast={showToast}        refresh={refreshKey} branch={userBranch}/>
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
      <BottomNav role={role} active={activeTab} setActive={setActiveTab} pendingCount={pendingCount} badges={badges}/>
      <Toast msg={toastMsg} type={toastType}/>
    </>
  )
}
