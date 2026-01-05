'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isShopOpen } from '@/utils/storeHours'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(isShopOpen())

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) router.push('/lobby')
        else router.push('/onboarding')
      }
    }
    checkUser()
  }, [router, supabase])

  const handleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative border-b-8 border-gold/20">
        <div className="absolute top-16 left-6 text-gold-dim text-xs tracking-[0.3em] font-serif opacity-60">EST. 2025 // MEMBERS ONLY</div>
        
        <div className="max-w-md w-full text-center space-y-12 mt-12">
            <div>
                <h1 className="text-8xl italic font-serif font-bold text-white mb-2 tracking-tight">dim.</h1>
                <p className="text-gold-dim tracking-[0.2em] text-[10px] uppercase mt-4">The Private Club for Conversation</p>
            </div>

            <div className="border border-border p-10 bg-surface relative mx-4">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gold"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gold"></div>

                <p className="font-serif text-3xl text-gold mb-6 italic">"Eyes wide shut."</p>
                <div className="h-px w-16 bg-border mx-auto mb-6"></div>
                <div className="text-gray-500 font-light text-sm leading-relaxed space-y-1">
                    <p>Doors open strictly at <span className="text-white">8:00 PM</span>.</p>
                    <p>Quality conversations!</p>
                </div>
            </div>

            <div className="px-4">
                <button 
                  onClick={handleLogin}
                  disabled={loading}
                  className="group relative w-full px-8 py-4 bg-transparent border border-gold text-gold hover:text-black transition-all duration-500 ease-out overflow-hidden"
                >
                    <span className="absolute inset-0 w-full h-full bg-gold transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out"></span>
                    <span className="relative z-10 font-serif tracking-widest text-sm uppercase">
                      {loading ? 'Verifying...' : 'Enter the Lobby'}
                    </span>
                </button>
                
                {/* DISCREET LEGAL FOOTER */}
                <p className="text-[10px] text-zinc-600 mt-6 max-w-xs mx-auto leading-relaxed">
                  By entering, you agree to our <span className="underline hover:text-gold cursor-pointer">Terms of Service</span>, <span className="underline hover:text-gold cursor-pointer">Privacy Policy</span>, and <span className="underline hover:text-gold cursor-pointer">Code of Conduct</span>.
                </p>
            </div>
        </div>
    </div>
  )
}