'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Upload, X, Plus } from 'lucide-react'

export default function Onboarding() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('male')
  const [lookingFor, setLookingFor] = useState('female')
  const [bio, setBio] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  
  const [customTag, setCustomTag] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const SUGGESTED_TAGS = ['Gaming', 'Gym', 'Foodie', 'Music', 'Tech', 'Art', 'Nightlife', 'Travel']

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (profile) {
          setNickname(profile.nickname || '')
          setGender(profile.gender || 'male')
          setLookingFor(profile.wants || 'female')
          setBio(profile.bio || '')
          setContactInfo(profile.contact_info || '')
          setSelectedTags(profile.interests || [])
          if (profile.real_photo_url) setPhotoPreview(profile.real_photo_url)
        }
      }
      setFetching(false)
    }
    loadProfile()
  }, [])

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
        }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    if (!nickname || selectedTags.length === 0 || !bio || !contactInfo) return alert("Please fill out all fields.")
    if (!photoPreview) return alert("You must upload a photo.")
    
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      try {
        let publicUrl = photoPreview
        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop()
            const filePath = `${user.id}-${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, photoFile)
            if (uploadError) throw uploadError
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
            publicUrl = data.publicUrl
        }

        const { error: profileError } = await supabase.from('profiles').upsert({
            id: user.id,
            nickname,
            gender,
            wants: lookingFor,
            bio,
            contact_info: contactInfo,
            interests: selectedTags,
            avatar_color: '#333',
            real_photo_url: publicUrl,
        })

        if (profileError) throw profileError
        router.push('/lobby')

      } catch (error: any) {
        alert('Error: ' + error.message)
      }
    }
    setLoading(false)
  }

  if (fetching) return <div className="min-h-screen bg-background text-gold p-10 text-center">Loading Records...</div>

  return (
    <div className="min-h-screen bg-background text-white p-6 pt-10 pb-20">
        <div className="max-w-md mx-auto w-full space-y-8">
            <div className="text-center space-y-2">
                <p className="text-gold text-xs tracking-[0.3em] uppercase">Identity Protocol</p>
                <h2 className="text-4xl font-serif italic text-white">The Dossier</h2>
            </div>

            <div className="space-y-8 bg-surface p-6 border border-border rounded-lg">
                <div className="space-y-2">
                    <label className="block text-gold text-xs uppercase tracking-widest">Proof of Life (Hidden)</label>
                    
                    {photoPreview ? (
                        // FILLED STATE: Natural Height, No Black Borders
                        <div 
                            onClick={() => fileInputRef.current?.click()} 
                            className="relative w-full rounded-lg overflow-hidden border border-gold/50 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                            <img src={photoPreview} className="w-full h-auto block" alt="Preview" />
                            <div className="absolute bottom-2 right-2 bg-black/70 text-gold text-[10px] px-2 py-1 rounded uppercase tracking-widest">
                                Tap to Change
                            </div>
                        </div>
                    ) : (
                        // EMPTY STATE: Fixed Height Dropzone
                        <div 
                            onClick={() => fileInputRef.current?.click()} 
                            className="relative w-full h-96 border border-dashed border-gold/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gold/5 transition-colors overflow-hidden"
                        >
                            <div className="flex flex-col items-center">
                                <Upload className="text-gold mb-2" />
                                <span className="text-xs text-gray-500 uppercase tracking-widest">Tap to upload</span>
                            </div>
                        </div>
                    )}
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-gold text-xs uppercase tracking-widest mb-2">Alias</label>
                        <input type="text" className="w-full bg-background border-b border-border p-3 text-white font-serif text-xl focus:outline-none focus:border-gold" placeholder="e.g. MidnightRider" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={15}/>
                    </div>
                    <div>
                         <label className="block text-gold text-xs uppercase tracking-widest mb-2">Social Handle</label>
                         <input type="text" className="w-full bg-background border-b border-border p-3 text-white text-sm focus:outline-none focus:border-gold" placeholder="@handle" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gold text-xs uppercase tracking-widest mb-2">I am a</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-background border border-border p-3 text-sm text-gray-300 focus:border-gold outline-none">
                            <option value="male">Gentleman</option>
                            <option value="female">Lady</option>
                            <option value="nonbinary">Person</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gold text-xs uppercase tracking-widest mb-2">Seeking</label>
                        <select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} className="w-full bg-background border border-border p-3 text-sm text-gray-300 focus:border-gold outline-none">
                            <option value="female">Ladies</option>
                            <option value="male">Gentlemen</option>
                            <option value="everyone">Everyone</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-gold text-xs uppercase tracking-widest mb-2">The Hook</label>
                    <textarea className="w-full bg-background border border-border p-3 text-white text-sm h-20 focus:outline-none focus:border-gold" placeholder="My toxic trait is..." value={bio} onChange={(e) => setBio(e.target.value)} maxLength={100}/>
                </div>

                <div>
                    <label className="block text-gold text-xs uppercase tracking-widest mb-4">Niches (Max 5)</label>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={customTag} 
                            onChange={(e) => setCustomTag(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && addCustomTag(e)}
                            className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-gold outline-none" 
                            placeholder="Type specific niche..." 
                        />
                        <button onClick={addCustomTag} className="bg-gold/20 text-gold px-4 rounded hover:bg-gold hover:text-black transition-colors"><Plus size={18} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedTags.map(tag => (
                          <button key={tag} onClick={() => toggleTag(tag)} className="px-3 py-1 border border-gold bg-gold text-black font-bold text-xs uppercase flex items-center gap-1">{tag} <X size={12} /></button>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="w-full bg-gold text-black font-serif font-bold italic text-xl py-4 hover:bg-white transition-colors rounded-sm">
              {loading ? 'Sealing...' : 'Seal the Record'}
            </button>
        </div>
    </div>
  )
}