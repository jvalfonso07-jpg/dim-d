'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Send, Heart, X, Square, AlertCircle, Plus, Loader2, ArrowLeft, Tag } from 'lucide-react'

type Message = {
  id: string
  user_id: string
  content: string
  created_at: string
}

export default function ChatRoom() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [status, setStatus] = useState('active') 
  const [partner, setPartner] = useState<any>(null) 
  const [myVote, setMyVote] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionData, setSessionData] = useState<any>(null)
  
  const [isSearching, setIsSearching] = useState(false)
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [myTags, setMyTags] = useState<string[]>([])
  const [commonTags, setCommonTags] = useState<string[]>([]) 
  const [customTag, setCustomTag] = useState('')
  const SUGGESTED_TAGS = ['Gaming', 'Gym', 'Foodie', 'Music', 'Tech', 'Art', 'Nightlife', 'Travel']

  const [dragX, setDragX] = useState(0)
  const [startX, setStartX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const checkMatchStatus = useCallback((data: any) => {
    const { user_a_vote, user_b_vote } = data
    if (user_a_vote === 'yes' && user_b_vote === 'yes') {
        setStatus('revealed')
    } else if (user_a_vote === 'no' || user_b_vote === 'no') {
        setStatus('ended')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      setUser(user)

      const { data: myProfile } = await supabase.from('profiles').select('interests').eq('id', user.id).single()
      const myInterests = myProfile?.interests || []
      setMyTags(myInterests)

      const { data: session } = await supabase.from('chat_sessions').select('*').eq('id', id).single()
      
      if (!session || session.status === 'ended') {
        return router.push('/lobby')
      }
      
      setSessionData(session)

      const partnerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id
      const { data: partnerProfile } = await supabase.from('profiles').select('*').eq('id', partnerId).single()
      setPartner(partnerProfile)

      // CALCULATE COMMON TAGS
      const partnerInterests = partnerProfile?.interests || []
      const clean = (str: string) => str?.toLowerCase().trim() || ''
      const overlap = myInterests.filter((myTag: string) => 
        partnerInterests.some((theirTag: string) => clean(theirTag) === clean(myTag))
      )
      // Check matched_tag
      if (session.matched_tag && !overlap.some(t => clean(t) === clean(session.matched_tag))) {
        overlap.push(session.matched_tag)
      }
      setCommonTags(overlap)

      const { data: existingMsgs } = await supabase.from('messages').select('*').eq('session_id', id).order('created_at', { ascending: true })
      if (existingMsgs) setMessages(existingMsgs)

      checkMatchStatus(session)

      const channel = supabase
        .channel(`session:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${id}` }, 
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          scrollToBottom()
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${id}` },
        (payload) => { 
            setSessionData(payload.new)
            checkMatchStatus(payload.new) 
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    init()
  }, [id, supabase, router, checkMatchStatus])

  useEffect(() => {
    if (!sessionData?.expires_at || status !== 'active') return

    const interval = setInterval(() => {
      const now = Date.now()
      const expiry = new Date(sessionData.expires_at).getTime()
      const diff = Math.floor((expiry - now) / 1000)
      
      setTimeLeft(diff > 0 ? diff : 0)

      if (diff <= 0) {
        setStatus('voting')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionData, status])

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || status !== 'active') return
    await supabase.from('messages').insert({ session_id: id, user_id: user.id, content: newMessage })
    setNewMessage('')
  }

  const handleStopClick = async () => {
    if (confirmStop) {
      await handleVote('no')
      setStatus('ended')
      setConfirmStop(false)
    } else {
      setConfirmStop(true)
      setTimeout(() => setConfirmStop(false), 3000)
    }
  }

  const handleBack = async () => {
    if (status === 'active' || status === 'voting') {
        await handleVote('no')
    }
    router.push('/lobby')
  }

  const handleNextPerson = async () => {
    if (!user) return
    setIsSearching(true)

    try {
        const myId = user.id
        await supabase.from('queue').delete().eq('user_id', myId)

        const channel = supabase.channel('chat_match_' + myId)
        channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_sessions', filter: `user_b_id=eq.${myId}` }, (payload) => {
                supabase.removeChannel(channel)
                router.push(`/chat/${payload.new.id}`)
            })
            .subscribe()

        await supabase.from('queue').insert({ user_id: myId })

        let query = supabase.from('queue').select('*').neq('user_id', myId)
        
        // --- BULLETPROOF: PREVENT IMMEDIATE RE-MATCH ---
        if (partner?.id) {
            query = query.neq('user_id', partner.id)
        }
        // ----------------------------------------------
        
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        query = query.gt('created_at', twoMinutesAgo)
        
        const { data: others } = await query.limit(1).single()
        
        if (others) {
             const { data: claimed } = await supabase.from('queue').delete().eq('user_id', others.user_id).select()
             
             if (claimed && claimed.length > 0) {
                 const { data: session, error } = await supabase.from('chat_sessions').insert({
                    user_a_id: myId,
                    user_b_id: others.user_id,
                    status: 'active',
                    expires_at: new Date(Date.now() + 30 * 1000).toISOString() 
                 }).select().single()

                 if (session && !error) {
                     await supabase.from('queue').delete().eq('user_id', myId)
                     supabase.removeChannel(channel)
                     router.push(`/chat/${session.id}`)
                 }
             }
        }
    } catch (e) {
        console.error(e)
        setIsSearching(false)
    }
  }

  const handleVote = async (vote: 'yes' | 'no') => {
    setMyVote(vote)
    let isUserA = false
    if (sessionData) {
        isUserA = sessionData.user_a_id === user.id
    } else {
        const { data } = await supabase.from('chat_sessions').select('user_a_id').eq('id', id).single()
        isUserA = data?.user_a_id === user.id
    }
    
    const column = isUserA ? 'user_a_vote' : 'user_b_vote'
    await supabase.from('chat_sessions').update({ [column]: vote }).eq('id', id)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (myVote) return
    setStartX(e.touches[0].clientX)
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || myVote) return
    const currentX = e.touches[0].clientX
    const delta = currentX - startX
    setDragX(delta)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragX > 120) handleVote('yes') 
    else if (dragX < -120) handleVote('no') 
    else setDragX(0) 
  }

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
    await supabase.from('profiles').update({ interests: myTags }).eq('id', user.id)
    setShowTagsModal(false)
  }

  // --- RENDERING: SEARCHING OVERLAY (FULL SCREEN) ---
  if (isSearching) {
    return (
        <div className="flex flex-col h-[100dvh] bg-background text-white items-center justify-center space-y-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-gold rounded-full animate-pulse"></div>
                </div>
            </div>
            <div className="text-center">
                <h2 className="text-xl font-serif text-gold italic">Finding Connection...</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-2">Matching your tags</p>
            </div>
            <button onClick={() => router.push('/lobby')} className="text-gray-600 text-xs hover:text-white mt-8 underline">
                Return to Lobby
            </button>
        </div>
    )
  }

  if (!partner) return <div className="text-white p-10 bg-background h-[100dvh]">Connecting...</div>

  const minutes = Math.floor((timeLeft || 0) / 60)
  const seconds = (timeLeft || 0) % 60
  const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`

  return (
    // FIX: Changed h-screen to h-[100dvh] for mobile browsers
    // FIX: Added overflow-hidden to prevent body scrolling
    <div className="flex flex-col h-[100dvh] bg-background text-white relative overflow-hidden">
        
        {/* --- TAGS MODAL --- */}
        {showTagsModal && (
            <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
                <div className="bg-surface border border-gold p-6 rounded-lg w-full max-w-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-gold font-serif italic text-xl">Update Interests</h3>
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
                    </div>
                    <button onClick={saveTags} className="w-full bg-gold text-black font-bold py-3 uppercase tracking-widest">Save Tags</button>
                </div>
            </div>
        )}

        {/* --- VOTING PHASE --- */}
        {status === 'voting' && (
            <div className="absolute inset-0 z-40 bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
                <h2 className="text-gold text-xs tracking-[0.4em] uppercase mb-6 animate-pulse">Time Expired</h2>
                <div className="relative w-full max-w-sm h-[65vh]">
                    <div 
                        onTouchStart={handleTouchStart} 
                        onTouchMove={handleTouchMove} 
                        onTouchEnd={handleTouchEnd}
                        className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-gold bg-black shadow-2xl transition-transform duration-100 ease-out cursor-grab active:cursor-grabbing"
                        style={{ 
                            transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
                            opacity: myVote ? 0 : Math.max(0.5, 1 - Math.abs(dragX) / 500)
                        }}
                    >
                        <img src={partner.real_photo_url} className="w-full h-full object-cover pointer-events-none" />
                        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-6 pt-20 pointer-events-none">
                            <h1 className="font-serif text-3xl italic text-white">{partner.nickname}</h1>
                            {/* Height removed from partner display as well since requested */}
                            <p className="text-xs text-gold uppercase tracking-widest mb-1">{partner.gender}</p>
                            <p className="text-sm text-gray-300 italic">"{partner.bio}"</p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {partner.interests?.map((t: string) => <span key={t} className="text-[10px] bg-white/10 px-2 py-1 rounded border border-white/20">{t}</span>)}
                            </div>
                        </div>
                        {dragX > 50 && <div className="absolute top-10 left-10 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 -rotate-12 rounded-lg bg-black/50">YES</div>}
                        {dragX < -50 && <div className="absolute top-10 right-10 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rotate-12 rounded-lg bg-black/50">NOPE</div>}
                    </div>
                </div>

                {!myVote && (
                    <div className="flex gap-6 mt-8 w-full max-w-xs">
                        <button onClick={() => handleVote('no')} className="flex-1 py-4 rounded-full bg-zinc-900 text-red-500 border border-zinc-700 hover:bg-red-900/20"><X className="mx-auto" /></button>
                        <button onClick={() => handleVote('yes')} className="flex-1 py-4 rounded-full bg-gold text-black hover:bg-white"><Heart className="mx-auto" fill="black" /></button>
                    </div>
                )}
                {myVote && <div className="mt-8 text-gold animate-pulse">Waiting for partner...</div>}
            </div>
        )}

        {/* --- REVEALED PHASE --- */}
        {status === 'revealed' && (
             <div className="absolute inset-0 z-40 bg-background flex flex-col items-center justify-center p-6 text-center space-y-8">
                <div className="w-40 h-40 rounded-full border-4 border-gold overflow-hidden shadow-glow">
                   <img src={partner.real_photo_url} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h1 className="font-serif text-5xl italic text-gold mb-2">It's a Match</h1>
                    <p className="text-gray-400 text-sm uppercase tracking-widest">Screenshot this.</p>
                </div>
                <div className="bg-surface border border-gold/30 p-8 rounded-xl w-full max-w-sm">
                    <p className="text-xs text-gold-dim uppercase mb-2">Social Handle</p>
                    <p className="text-2xl font-mono select-all text-white">{partner.contact_info}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <button onClick={handleNextPerson} className="bg-white text-black px-8 py-3 rounded-full font-bold">Next Person</button>
                  <button onClick={() => setShowTagsModal(true)} className="text-gold text-xs underline">Edit My Tags</button>
                </div>
            </div>
        )}

        {/* --- MAIN CHAT UI --- */}
        <div className="flex-col h-full w-full relative flex">
            
            <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-surface z-20 relative shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="text-gray-400 hover:text-white mr-1">
                        <ArrowLeft size={20} />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-[#333] border border-gold/30 overflow-hidden relative">
                        {/* BLUR FIX: blur-[2px] is subtle enough to see there's a pic but obscures details */}
                        <img src={partner.real_photo_url} className="w-full h-full object-cover blur-[2px] scale-110 opacity-80" />
                    </div>
                    <div>
                        <h2 className="font-serif font-bold text-gold text-base tracking-wide flex items-center gap-2">
                            {partner.nickname}
                        </h2>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* ONLY SHOW TIMER IF ACTIVE */}
                    {status === 'active' && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${timeLeft && timeLeft < 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-gold/50 text-gold'}`}>
                            <span className="font-mono text-sm">{timeString}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto z-10 relative">
                {/* --- SYSTEM MESSAGE FOR TAGS --- */}
                {commonTags.length > 0 ? (
                    <div className="flex justify-center mb-6">
                        <div className="bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
                            <p className="text-[10px] text-gold uppercase tracking-widest text-center">
                                You matched with {commonTags.join(', ').replace(/, ([^,]*)$/, ' and $1')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center mb-6">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center">
                                Matched by Fate (No common tags)
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg) => {
                const isMe = msg.user_id === user.id
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                        isMe 
                        ? 'bg-gold text-black rounded-2xl rounded-tr-none font-medium' 
                        : 'bg-surface border border-border text-gray-300 rounded-2xl rounded-tl-none'
                    }`}>
                        {msg.content}
                    </div>
                    </div>
                )
                })}
                
                {status === 'ended' && (
                <div className="flex justify-center py-4">
                    <span className="text-red-500 text-xs uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} /> Chat Disconnected
                    </span>
                </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-surface border-t border-border z-20 relative shrink-0 safe-bottom">
                {status === 'active' ? (
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <button 
                            type="button" 
                            onClick={handleStopClick} 
                            className={`px-4 rounded-full font-bold text-xs uppercase tracking-widest transition-all ${
                            confirmStop 
                                ? 'bg-red-500 text-white w-24' 
                                : 'bg-red-900/20 text-red-500 hover:bg-red-900/40 w-12 flex items-center justify-center'
                            }`}
                        >
                            {confirmStop ? 'Sure?' : <Square size={16} fill="currentColor" />}
                        </button>

                        <input 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            type="text" 
                            placeholder="Type..." 
                            className="flex-1 bg-background border border-border rounded-full px-5 py-3 text-white focus:outline-none focus:border-gold transition-colors"
                        />
                        <button type="submit" className="bg-gold text-black w-12 h-12 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                            <Send size={20} />
                        </button>
                    </form>
                ) : (
                    <div className="flex gap-3">
                        <button onClick={handleNextPerson} className="flex-1 bg-gold text-black h-14 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-colors text-sm shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                            New Chat
                        </button>
                        <button onClick={() => setShowTagsModal(true)} className="px-6 bg-surface border border-border text-gray-400 rounded-full text-xs font-bold uppercase tracking-widest hover:border-gold hover:text-gold transition-colors">
                            Tags
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  )
}