import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    'https://zjzzzywgkspdkusxkeaa.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqenp6eXdna3NwZGt1c3hrZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjI1NjEsImV4cCI6MjA4MjU5ODU2MX0.yanXUYc_mo4oQgG9laZ0uL8MqNZnf5iAe9N230YfwBY'
  )