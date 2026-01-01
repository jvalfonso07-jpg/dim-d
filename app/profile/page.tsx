'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Upload, X, ArrowLeft, Plus, Loader2 } from 'lucide-react'

export default function Profile() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('male')
  const [lookingFor, setLookingFor] = useState('female')
  const [bio, setBio] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  
  // Loading state for initial fetch (used for subtle indicator, not blocking)
  const [fetching, setFetching] = useState(true)

  // Tags
  const [customTag, setCustomTag] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const SUGGESTED_TAGS = ['Gaming', 'Gym', 'Foodie', 'Music', 'Tech', 'Art', 'Nightlife', 'Travel']

  // Load Data
  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setNickname(data.nickname || '')
        setGender(data.gender)
        setLookingFor(data.wants)
        setBio(data.bio)
        setContactInfo(data.contact_info || '')
        setSelectedTags(data.interests || [])
        setPhotoPreview(data.real_photo_url)
      }
      setFetching(false) // Done loading
    }
    getProfile()
  }, [router, supabase])

  const handleSave = async () => {
    if (!nickname || selectedTags.length === 0 || !bio || !contactInfo) {
      return alert("Please fill out all fields.")
    }
    
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      let publicUrl = photoPreview
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const filePath = `${user.id}-${Math.random()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, photoFile)
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
          publicUrl = data.publicUrl
        }
      }

      await supabase.from('profiles').update({
        nickname,
        gender,
        wants: lookingFor,
        bio,
        contact_info: contactInfo,
        interests: selectedTags,
        real_photo_url: publicUrl
      }).eq('id', user.id)

      router.push('/lobby')
    }
    setLoading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) setSelectedTags(selectedTags.filter(t => t !== tag))
    else if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag])
  }

  const addCustomTag = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (customTag && !selectedTags.includes(customTag)) {
      if (selectedTags.length < 5) {
        setSelectedTags([...selectedTags, customTag])
        setCustomTag('')
      } else {
        alert("Max 5 interests allowed.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 pb-20">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/lobby')} className="text-gold hover:text-white">
                <ArrowLeft />
            </button>
            <h1 className="font-serif text-2xl italic">Edit Identity</h1>
          </div>
          {/* Subtle loading indicator instead of blocking screen */}
          {fetching && <Loader2 className="animate-spin text-gold" size={20} />}
        </div>

        {/* Removed blocking "Loading Records..." check */}

        <div className={`bg-surface p-6 border border-border rounded-lg space-y-6 ${fetching ? 'opacity-50 pointer-events-none' : ''}`}>
           {/* Photo */}
           <div className="flex flex-col items-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-full border-2 border-gold overflow-hidden cursor-pointer relative group"
              >
                {photoPreview ? (
                  <img src={photoPreview} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-gold"><Upload /></div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-white">Change</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
           </div>

           {/* Fields */}
           <div className="space-y-4">
              <div>
                <label className="text-xs text-gold uppercase tracking-widest">Alias</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full bg-background border-b border-border p-2 text-white font-serif text-lg focus:border-gold outline-none" />
              </div>

              <div>
                <label className="text-xs text-gold uppercase tracking-widest">Social Handle</label>
                <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full bg-background border-b border-border p-2 text-white text-sm focus:border-gold outline-none" />
              </div>

              <div>
                <label className="text-xs text-gold uppercase tracking-widest">The Hook / Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-background border border-border p-2 text-white text-sm h-20 focus:border-gold outline-none mt-1" />
              </div>

              {/* Tags */}
              <div>
                 <label className="text-xs text-gold uppercase tracking-widest">Interests (Max 5)</label>
                 <div className="flex gap-2 my-2">
                    <input 
                      value={customTag} 
                      onChange={e => setCustomTag(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && addCustomTag(e)}
                      className="flex-1 bg-background border border-border px-2 py-1 text-sm focus:border-gold outline-none" 
                      placeholder="Add custom..." 
                    />
                    <button onClick={addCustomTag} className="text-gold"><Plus /></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                      <span key={tag} onClick={() => toggleTag(tag)} className="px-2 py-1 bg-gold text-black text-xs font-bold uppercase cursor-pointer flex items-center gap-1">{tag} <X size={10}/></span>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-gold text-black font-bold uppercase tracking-widest hover:bg-white transition-colors">
          {loading ? 'Saving...' : 'Update Record'}
        </button>

      </div>
    </div>
  )
}