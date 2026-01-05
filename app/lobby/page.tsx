'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { isShopOpen } from '@/utils/storeHours'
import { LogOut, User, Tag, X, Plus } from 'lucide-react'

export default function Lobby() {
  const supabase = createClient()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)
  const [status, setStatus] = useState<'idle' | 'searching' | 'found'>('idle')
  const [myId, setMyId] = useState<string | null>(null)
  const [myTags, setMyTags] = useState<string[]>([])
  
  // Tags Modal State
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const SUGGESTED_TAGS = ['Gaming', 'Gym', 'Foodie', 'Music', 'Tech', 'Art', 'Nightlife', 'Travel']
  
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsOpen(isShopOpen())

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/') 
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, interests')
        .eq('id', user.id)
        .single()
      
      if (!profile) {
        router.push('/onboarding')
        return
      }
      setMyId(user.id)
      setMyTags(profile.interests || [])

      await supabase.from('queue').delete().eq('user_id', user.id)
    }
    init()

    return () => {
      stopHeartbeat()
    }
  }, [router, supabase])

  // --- TAG LOGIC ---
  const toggleTag = (tag: string) => {
    if (myTags.includes(tag)) setMyTags(myTags.filter(t => t !== tag))
    else if (myTags.length < 5) setMyTags([...myTags, tag])
  }

  const addCustomTag = (e: React.FormEvent) => {
    e.preventDefault()
    if (customTag && !myTags.includes(customTag) && myTags.length < 5) {
      setMyTags([...myTags, customTag])
      setCustomTag('')
    }
  }

  const saveTags = async () => {
    if (myId) {
      await supabase.from('profiles').update({ interests: myTags }).eq('id', myId)
      setShowTagsModal(false)
    }
  }

  // --- QUEUE LOGIC ---
  const startHeartbeat = (userId: string) => {
    heartbeatInterval.current = setInterval(async () => {
      await supabase
        .from('queue')
        .update({ created_at: new Date().toISOString() })
        .eq('user_id', userId)
    }, 45000)
  }

  const stopHeartbeat = () => {
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current)
  }

  const handleLogout = async () => {
    if (myId) await supabase.from('queue').delete().eq('user_id', myId)
    await supabase.auth.signOut()
    router.push('/')
  }

  const findMatch = async () => {
    if (!myId) return
    setStatus('searching')

    try {
      await supabase.from('queue').insert({ user_id: myId })
      startHeartbeat(myId)

      const channel = supabase
        .channel('lobby')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_sessions', filter: `user_b_id=eq.${myId}` },
          (payload) => {
            stopHeartbeat()
            router.push(`/chat/${payload.new.id}`)
          }
        )
        .subscribe()

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

      const { data: potentialMatches } = await supabase
        .from('queue')
        .select(`
          user_id, 
          created_at,
          profiles ( interests )
        `)
        .neq('user_id', myId)
        .gt('created_at', twoMinutesAgo)
        .limit(20)

      if (potentialMatches && potentialMatches.length > 0) {
        let matchedUserId = null
        let commonTag = null

        // A. Look for Tag Overlap
        const tagMatch = potentialMatches.find((match: any) => {
          const theirTags = match.profiles?.interests || []
          const intersection = theirTags.find((t: string) => myTags.includes(t))
          if (intersection) {
            commonTag = intersection
            return true
          }
          return false
        })

        if (tagMatch) {
          matchedUserId = tagMatch.user_id
        } else {
          // B. Fallback: FIFO
          const sorted = potentialMatches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          matchedUserId = sorted[0].user_id
        }

        if (matchedUserId) {
          const { data: session, error } = await supabase
            .from('chat_sessions')
            .insert({
              user_a_id: myId,
              user_b_id: matchedUserId,
              status: 'active',
              matched_tag: commonTag,
              expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString()
            })
            .select()
            .single()

          if (session && !error) {
            stopHeartbeat()
            await supabase.from('queue').delete().in('user_id', [myId, matchedUserId])
            router.push(`/chat/${session.id}`)
          }
        }
      }
      
    } catch (e) {
      console.error(e)
    }
  }

  const cancelSearch = async () => {
    if (!myId) return
    stopHeartbeat()
    await supabase.from('queue').delete().eq('user_id', myId)
    setStatus('idle')
  }

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6 border-b-8 border-border">
        <h1 className="text-gold font-serif text-5xl italic">Closed.</h1>
        <p className="text-gray-500 tracking-widest text-xs uppercase">
          Come back between 20:00 and 03:00.
        </p>
        <button onClick={handleLogout} className="text-xs text-red-500 underline">Sign Out</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 relative flex flex-col items-center justify-center border-t-4 border-gold">
      
      {/* --- TAGS MODAL --- */}
      {showTagsModal && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-surface border border-gold p-6 rounded-lg w-full max-w-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-gold font-serif italic text-xl">Quick Edit Interests</h3>
                    <button onClick={() => setShowTagsModal(false)}><X /></button>
                </div>
                <div className="flex gap-2">
                    <input value={customTag} onChange={e => setCustomTag(e.target.value)} className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-gold outline-none" placeholder="Add custom..." />
                    <button onClick={addCustomTag} className="text-gold"><Plus /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {myTags.map(tag => (
                      <span key={tag} onClick={() => toggleTag(tag)} className="px-3 py-1 bg-gold text-black text-xs font-bold uppercase cursor-pointer flex items-center gap-1">{tag} <X size={10}/></span>
                    ))}
                    {SUGGESTED_TAGS.filter(t => !myTags.includes(t)).slice(0, 3).map(tag => (
                      <span key={tag} onClick={() => toggleTag(tag)} className="px-3 py-1 border border-border text-gray-500 text-xs uppercase cursor-pointer hover:border-gold">{tag}</span>
                    ))}
                </div>
                <button onClick={saveTags} className="w-full bg-gold text-black font-bold py-3 uppercase tracking-widest">Save & Close</button>
            </div>
        </div>
      )}

      {/* Top Left: Dashboard */}
      <button 
        onClick={() => router.push('/profile')}
        className="absolute top-6 left-6 text-gray-400 hover:text-gold transition-colors flex items-center gap-2 group"
      >
        <div className="w-10 h-10 rounded-full border border-gray-600 group-hover:border-gold flex items-center justify-center transition-colors">
           <User size={18} />
        </div>
      </button>

      {/* Top Right: Logout */}
      <button 
        onClick={handleLogout}
        className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors"
      >
        <LogOut size={20} />
      </button>

      <div className="z-10 text-center space-y-12 max-w-lg w-full">
        <div>
          <p className="text-gold-dim text-xs tracking-[0.4em] uppercase mb-4">The Lounge</p>
          <h1 className="text-6xl font-serif text-white tracking-tight italic">
            {status === 'idle' ? 'Ready?' : 'Scanning...'}
          </h1>
        </div>

        {status === 'idle' ? (
          <div className="space-y-6">
            {/* UPDATED BUTTON: MATCHING THE LOGIN BUTTON STYLE */}
            <button
              onClick={findMatch}
              className="group relative w-full py-8 bg-transparent border border-gold text-gold hover:text-black transition-all duration-500 ease-out overflow-hidden"
            >
              <span className="absolute inset-0 w-full h-full bg-gold transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out"></span>
              <span className="relative z-10 font-serif italic text-3xl">Enter the Pool</span>
            </button>

            {/* NEW: QUICK TAGS EDIT BUTTON */}
            <button 
              onClick={() => setShowTagsModal(true)}
              className="text-xs text-gray-500 hover:text-gold uppercase tracking-widest flex items-center justify-center gap-2 w-full"
            >
              <Tag size={14} /> Edit Interests ({myTags.length})
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-center gap-3">
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce delay-75"></div>
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce delay-150"></div>
              <div className="w-3 h-3 bg-gold rounded-full animate-bounce delay-300"></div>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Searching for a connection...
            </p>
            <button onClick={cancelSearch} className="text-xs text-red-500 hover:text-red-400 underline uppercase tracking-widest">
              Cancel Search
            </button>
          </div>
        )}

        <div className="pt-12 border-t border-border mt-12">
           <p className="text-[10px] text-gray-700 uppercase tracking-widest">
             Status: <span className="text-gold">Online</span>
           </p>
        </div>
      </div>
    </div>
  )
}