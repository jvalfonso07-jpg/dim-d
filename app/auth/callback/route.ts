import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/lobby'

  if (code) {
    // FIX FOR NEXT.JS 15: We must 'await' the cookies() function
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      // Your Hardcoded Keys
      'https://zjzzzywgkspdkusxkeaa.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqenp6eXdna3NwZGt1c3hrZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjI1NjEsImV4cCI6MjA4MjU5ODU2MX0.yanXUYc_mo4oQgG9laZ0uL8MqNZnf5iAe9N230YfwBY',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('Auth Error:', error)
    }
  }

  // If something fails, redirect to home with an error
  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}