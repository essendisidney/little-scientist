/**
 * One-off: create demo staff users in Supabase Auth.
 * Usage: node scripts/create-demo-staff.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (.env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const DEMO_PASSWORD = 'LittleScientist2026!'

const USERS = [
  { email: 'admin@demo.littlescientist.ke', role: 'admin', name: 'Demo Admin' },
  { email: 'gate@demo.littlescientist.ke', role: 'gate', name: 'Demo Gate' },
  { email: 'counter@demo.littlescientist.ke', role: 'counter', name: 'Demo Counter' },
  { email: 'accounting@demo.littlescientist.ke', role: 'accounting', name: 'Demo Accounting' },
]

async function upsertUser({ email, role, name }) {
  const { data: listed } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = listed?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { name },
    })
    if (error) throw error
    return { email, role, action: 'updated', id: data.user.id }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name },
  })
  if (error) throw error
  return { email, role, action: 'created', id: data.user.id }
}

const results = []
for (const u of USERS) {
  try {
    results.push(await upsertUser(u))
    console.log(`OK ${u.email} (${u.role})`)
  } catch (err) {
    console.error(`FAIL ${u.email}:`, err.message || err)
    results.push({ email: u.email, error: String(err.message || err) })
  }
}

console.log('\nDemo password for all:', DEMO_PASSWORD)
console.log('Login: https://littlescientist.ke/admin/login')
console.log(JSON.stringify(results, null, 2))
