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
