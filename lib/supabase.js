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
  owner:         { label: 'المالك',                      avatar: 'م', branch: null },
  admin_riyadh:  { label: 'مدير الشؤون الإدارية',        avatar: 'ش', branch: 'riyadh' },
  fields_riyadh: { label: 'مسؤول الملاعب',               avatar: 'م', branch: 'riyadh' },
  admin_jazan:   { label: 'مدير الشؤون الإدارية - جازان', avatar: 'ش', branch: 'jazan' },
  fields_jazan:  { label: 'مسؤول الملاعب - جازان',        avatar: 'م', branch: 'jazan' },
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
  if (days < 0)  return { label: 'منتهي',                   cls: 'badge-r' }
  if (days <= 7) return { label: `ينتهي بعد ${days} أيام`,  cls: 'badge-o' }
  if (days <= 30) return { label: `حتى ${endDate}`,          cls: 'badge-y' }
  return { label: 'نشط', cls: 'badge-g' }
}
