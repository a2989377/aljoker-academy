import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cgwzhbdfbnnshxskwwxz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnd3poYmRmYm5uc2h4c2t3d3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDM1ODgsImV4cCI6MjEwNzkxOTU4OH0.CCk9DuooEarlm9dunOoDvrds-SGYbqpOhqYo-lfQVcQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const PINS = {
  owner: '1411',
  admin_riyadh: '4747',
  fields_riyadh: '8787',
  admin_jazan: '1212',
  fields_jazan: '3434',
}

export const ROLES = {
  owner:         { label: 'المالك',           avatar: 'م', branch: null },
  admin_riyadh:  { label: 'الإدارة - الرياض', avatar: 'إ', branch: 'riyadh' },
  fields_riyadh: { label: 'الملاعب - الرياض', avatar: 'م', branch: 'riyadh' },
  admin_jazan:   { label: 'الإدارة - جازان',  avatar: 'إ', branch: 'jazan' },
  fields_jazan:  { label: 'الملاعب - جازان',  avatar: 'م', branch: 'jazan' },
}

export const EXP_CATS = ['رواتب','كهرباء','إنترنت','ماء فاتورة','مياه مخزون','صيانة','محامي','تأمينات','قرض','أخرى']
export const EXP_COLORS = ['#CC1F1F','#f59e0b','#2563eb','#06b6d4','#0ea5e9','#16a34a','#7c3aed','#ec4899','#dc2626','#6b7280']

export const BRANCHES = [
  { id: 'riyadh', label: 'الرياض' },
  { id: 'jazan',  label: 'جازان'  },
]

export const MONTHS = [
  { value: '2026-06', label: 'يونيو 2026'  },
  { value: '2026-07', label: 'يوليو 2026'  },
  { value: '2026-08', label: 'أغسطس 2026' },
  { value: '2026-09', label: 'سبتمبر 2026' },
  { value: '2026-10', label: 'أكتوبر 2026' },
  { value: '2026-11', label: 'نوفمبر 2026' },
  { value: '2026-12', label: 'ديسمبر 2026' },
  { value: '2027-01', label: 'يناير 2027'  },
  { value: '2027-02', label: 'فبراير 2027' },
]

export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('ar-SA')
}

export async function uploadReceipt(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
  return publicUrl
}

export function daysBetween(d1, d2) {
  if (!d1 || !d2) return null
  return Math.ceil((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24))
}

export function subStatus(endDate) {
  const today = new Date().toISOString().slice(0, 10)
  if (!endDate) return { label: 'غير محدد', cls: 'badge-grey' }
  const days = daysBetween(today, endDate)
  if (days < 0)   return { label: 'منتهي',                  cls: 'badge-r' }
  if (days === 0) return { label: 'ينتهي اليوم',            cls: 'badge-r' }
  if (days <= 14) return { label: `ينتهي بعد ${days} أيام`, cls: 'badge-o' }
  return { label: 'نشط', cls: 'badge-g' }
}

// ============ PAYMENTS (revenue = money actually received) ============
export const PKG3_PRICE = 750

const REC = {
  subscriber: { table: 'subscribers', paid: 'paid_amount' },
  booking:    { table: 'bookings',    paid: 'collected' },
  sale:       { table: 'sales',       paid: 'paid_amount' },
}

// add (or remove, with a negative delta) an amount from a record's paid total and balance
export async function bumpPaid(type, id, delta) {
  const t = REC[type]
  if (!t) return
  const { data } = await supabase.from(t.table).select(`${t.paid},balance`).eq('id', id).single()
  if (!data) return
  await supabase.from(t.table).update({
    [t.paid]: Number(data[t.paid] || 0) + delta,
    balance: Math.max(0, Number(data.balance || 0) - delta),
  }).eq('id', id)
}

// split a payment into its bus (passed through to bus owners) and kit parts,
// proportional to the subscription record it belongs to
export function splitPayment(rec, amount) {
  const total = Number(rec?.total_amount || 0)
  if (!total) return { pass_amount: 0, kit_part: 0 }
  const ratio = Number(amount) / total
  return {
    pass_amount: Math.round(Number(rec.bus_amount || 0) * ratio),
    kit_part: Math.round(Number(rec.kit_amount || 0) * ratio),
  }
}

// parts: [{ method, amount, receipt }]
export async function insertInitialPayments({ branch, type, rec, label, createdBy, parts }) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = (parts || []).filter(p => Number(p.amount) > 0).map(p => ({
    branch, record_type: type, record_id: String(rec.id),
    amount: Number(p.amount), method: p.method, receipt_url: p.receipt || null,
    paid_at: today, status: 'pending', kind: 'initial', label, created_by: createdBy,
    ...splitPayment(rec, p.amount),
  }))
  if (!rows.length) return { error: null }
  return supabase.from('payments').insert(rows)
}

// revenue for a month = approved payments received in that month
export async function fetchRevenue(branch, month) {
  const { data } = await supabase.from('payments')
    .select('record_type,amount,pass_amount,kit_part')
    .eq('branch', branch).eq('status', 'approved')
    .gte('paid_at', month + '-01').lte('paid_at', monthEnd(month)).limit(1000)
  let pitch = 0, sub = 0, kit = 0, bus = 0
  ;(data || []).forEach(p => {
    const a = Number(p.amount || 0), pass = Number(p.pass_amount || 0), k = Number(p.kit_part || 0)
    if (p.record_type === 'booking') pitch += a
    else if (p.record_type === 'sale') kit += a
    else { sub += a - pass - k; kit += k; bus += pass }
  })
  return { pitch, sub, kit, bus, total: pitch + sub + kit }
}

// ============ APPROVE, RETURN FOR EDIT, CANCEL, CORRECT ============
const TABLES = { subscriber: 'subscribers', booking: 'bookings', sale: 'sales', expense: 'expenses', payment: 'payments' }

export function addDaysStr(date, n) {
  if (!date) return ''
  const d = new Date(date)
  d.setDate(d.getDate() + Number(n || 0))
  return d.toISOString().slice(0, 10)
}

// stock goes back (+1) or out again (-1) for the things a record holds
async function stockMove(type, rec, sign) {
  if (type === 'sale') await supabase.rpc('adjust_inventory', { p_name: rec.item, p_size: rec.size || '', p_qty: sign * Number(rec.qty || 1) })
  if (type === 'booking' && rec.water) await supabase.rpc('adjust_inventory', { p_name: 'مياه', p_size: '', p_qty: sign })
  if (type === 'subscriber' && rec.has_kit && rec.kit_item) await supabase.rpc('adjust_inventory', { p_name: rec.kit_item, p_size: rec.kit_size || '', p_qty: sign })
}

export async function approveRecord(type, rec) {
  const now = new Date().toISOString()
  if (type === 'payment') {
    await supabase.from('payments').update({ status: 'approved', approved_at: now }).eq('id', rec.id)
    return
  }
  const upd = type === 'expense' ? { status: 'approved', approved_by: 'المالك', approved_at: now } : { status: 'approved', approved_at: now }
  await supabase.from(TABLES[type]).update(upd).eq('id', rec.id)
  if (type !== 'expense') {
    // the payments entered together with the record are approved with it
    await supabase.from('payments').update({ status: 'approved', approved_at: now })
      .eq('record_type', type).eq('record_id', String(rec.id)).eq('kind', 'initial').eq('status', 'pending')
    // an approved renewal closes the previous period of the same subscriber
    if (type === 'subscriber' && rec.renewal_of) await supabase.from('subscribers').update({ is_current: false }).eq('id', rec.renewal_of)
  }
}

// the owner sends a card back to the person who entered it, with the reason
export async function returnRecord(type, rec, reason) {
  const upd = { status: 'returned', return_reason: reason, returned_at: new Date().toISOString() }
  if (type === 'payment') {
    await supabase.from('payments').update(upd).eq('id', rec.id)
    await bumpPaid(rec.record_type, rec.record_id, -Number(rec.amount))
    return
  }
  await supabase.from(TABLES[type]).update(upd).eq('id', rec.id)
  if (type !== 'expense') await stockMove(type, rec, +1)
}

// an approved record is cancelled, never erased: it stays in the archive with the reason
export async function cancelRecord(type, rec, reason) {
  const now = new Date().toISOString()
  const upd = { status: 'cancelled', cancel_reason: reason, cancelled_at: now }
  if (type === 'payment') {
    await supabase.from('payments').update(upd).eq('id', rec.id)
    await bumpPaid(rec.record_type, rec.record_id, -Number(rec.amount))
    return
  }
  await supabase.from(TABLES[type]).update(upd).eq('id', rec.id)
  if (type !== 'expense') {
    await supabase.from('payments').update({ status: 'cancelled', cancel_reason: reason, cancelled_at: now })
      .eq('record_type', type).eq('record_id', String(rec.id)).in('status', ['approved', 'pending'])
    await stockMove(type, rec, +1)
    // a cancelled renewal makes the previous period current again
    if (type === 'subscriber' && rec.renewal_of) await supabase.from('subscribers').update({ is_current: true }).eq('id', rec.renewal_of)
  }
}

// owner only: fix the total and the paid amount of an approved subscription.
// The correction is dated on the original payment, so that month's revenue is corrected too.
export async function correctSubscription(rec, newTotal, newPaid, reason) {
  const now = new Date().toISOString()
  const dTotal = Number(newTotal) - Number(rec.total_amount || 0)
  const dPaid = Number(newPaid) - Number(rec.paid_amount || 0)
  const { data: first } = await supabase.from('payments').select('paid_at')
    .eq('record_type', 'subscriber').eq('record_id', String(rec.id)).eq('status', 'approved')
    .order('paid_at', { ascending: true }).limit(1)
  const when = first?.[0]?.paid_at || rec.start_date || now.slice(0, 10)
  const sub = Number(rec.sub_amount || 0) + dTotal
  await supabase.from('subscribers').update({
    sub_amount: sub, package: sub, total_amount: Number(newTotal), paid_amount: Number(newPaid), balance: Number(newTotal) - Number(newPaid),
  }).eq('id', rec.id)
  await supabase.from('payments').insert({
    branch: rec.branch, record_type: 'subscriber', record_id: String(rec.id), amount: dPaid, method: 'تصحيح',
    kind: 'correction', status: 'approved', label: rec.name, note: reason, paid_at: when,
    created_by: 'المالك', approved_at: now, pass_amount: 0, kit_part: 0,
  })
}

// ============ FLAGS ============
function monthsApart(a, b) {
  if (!a || !b) return 0
  const s = new Date(a), e = new Date(b)
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

// things worth a second look on a subscription (3 months is valid at 750 or 900)
export function subscriptionFlags(r, all = []) {
  const f = []
  const sub = Number(r.sub_amount || 0)
  const months = Number(r.months) || monthsApart(r.start_date, r.end_date)
  if (r.start_date && r.end_date && r.start_date === r.end_date) f.push('تاريخ البداية والنهاية متطابقان')
  if (months === 3 && Number(r.members_count || 1) <= 1 && sub > 0 && ![750, 900].includes(sub)) f.push(`باقة 3 أشهر بسعر ${sub} (المعتمد 750 أو 900)`)
  else if (sub > 0 && sub % 50 !== 0) f.push(`مبلغ اشتراك غير معتاد: ${sub}`)
  const name = (r.name || '').trim()
  if (name && all.some(x => x.id !== r.id && (x.name || '').trim() === name)) f.push('الاسم مكرر بين المشتركين الحاليين')
  return f
}
