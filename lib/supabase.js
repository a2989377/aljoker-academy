import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cgwzhbdfbnnshxskwwxz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnd3poYmRmYm5uc2h4c2t3d3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDM1ODgsImV4cCI6MjEwNzkxOTU4OH0.CCk9DuooEarlm9dunOoDvrds-SGYbqpOhqYo-lfQVcQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const PINS = {
  owner: '1411',
  admin: '2847',
  fields: '6391',
}

export const ROLES = {
  owner: { label: 'المالك', avatar: 'م' },
  admin: { label: 'مدير الشؤون الإدارية', avatar: 'ش' },
  fields: { label: 'مسؤول الملاعب', avatar: 'م' },
}

export const EXP_CATS = ['رواتب','كهرباء','إنترنت','ماء فاتورة','مياه مخزون','صيانة','محامي','تأمينات','باص','أخرى']
export const EXP_COLORS = ['#CC1F1F','#f59e0b','#2563eb','#06b6d4','#0ea5e9','#16a34a','#7c3aed','#ec4899','#ea580c','#6b7280']

export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export function fmt(n) {
  return Number(n).toLocaleString('ar-SA')
}

export async function uploadReceipt(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
  return publicUrl
}
