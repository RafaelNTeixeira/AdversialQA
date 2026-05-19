import { useState, useRef, useEffect, useCallback } from 'react'

// -- i18n strings --------------------------------------------------------------

const T = {
  en: {
    appTitle: 'The Examination Chamber',
    appSubtitle: 'Adversarial Q&A Simulator',
    heroTitle: ['The Examination', 'Chamber'],
    heroItalic: 'Chamber',
    heroDesc:
      'Upload your thesis or CV. The examiner will study it, find your weaknesses, and interrogate you without mercy.',
    modeThesis: 'Thesis Defense',
    modeTech: 'Tech Interview',
    langLabel: 'Language',
    dropTitle: 'Drop your file here',
    dropSub: 'PDF · TXT · MD - or click to browse',
    processing: 'PROCESSING DOCUMENT...',
    features: [
      { icon: '🎯', label: 'Edge Case Questions', desc: 'Targeted at the weakest parts of your document' },
      { icon: '🎤', label: 'Voice Defense', desc: 'Answer verbally or by text. Questions read aloud.' },
      { icon: '📊', label: 'Performance Report', desc: 'Brutally honest assessment at session end' },
    ],
    docProcessed: 'Document Processed',
    file: 'File',
    mode: 'Mode',
    wordsExtracted: 'Words Extracted',
    characters: 'Characters',
    language: 'Language',
    warningText:
      'The examiner has studied your document and identified potential weaknesses. Once you start, there are no pauses. Prepare to defend every decision.',
    beginBtn: 'Begin Examination →',
    backBtn: '← Back',
    question: 'Question',
    speaking: '● Speaking',
    evaluating: 'EVALUATING RESPONSE...',
    preparing: 'PREPARING QUESTION...',
    recording: 'RECORDING',
    answerPlaceholder: 'Type your answer, or use the mic button…',
    listeningPlaceholder: 'Listening… speak your defense',
    examinerFeedback: 'Examiner Feedback',
    submitAnswer: 'Submit\nAnswer',
    ctrlEnter: 'Ctrl+Enter to submit quickly',
    history: '◀ History',
    historyClose: '▶ Close',
    sessionHistory: 'Session History',
    you: 'You',
    feedback: 'Feedback',
    endSession: 'End Session',
    examComplete: 'Examination Complete',
    qAnswered: 'questions answered',
    newDoc: '← Upload New Document',
    ttsTitle: 'Examiner voice',
    micTitle: 'Voice answer',
    modeLabels: { thesis_defense: 'Thesis Defense', technical_interview: 'Tech Interview' },
    langLabels: { en: 'English', pt: 'Portuguese' },
  },
  pt: {
    appTitle: 'A Câmara de Exame',
    appSubtitle: 'Simulador de Q&A Adversarial',
    heroTitle: ['A Câmara', 'de Exame'],
    heroItalic: 'de Exame',
    heroDesc:
      'Carrega a tua tese ou CV. O examinador vai estudá-lo, encontrar as tuas fraquezas e interrogar-te sem misericórdia.',
    modeThesis: 'Defesa de Tese',
    modeTech: 'Entrevista Técnica',
    langLabel: 'Idioma',
    dropTitle: 'Larga o teu ficheiro aqui',
    dropSub: 'PDF · TXT · MD - ou clica para procurar',
    processing: 'A PROCESSAR DOCUMENTO...',
    features: [
      { icon: '🎯', label: 'Perguntas de Casos Extremos', desc: 'Direcionadas aos pontos mais fracos do teu documento' },
      { icon: '🎤', label: 'Defesa por Voz', desc: 'Responde verbalmente ou por texto. Perguntas lidas em voz alta.' },
      { icon: '📊', label: 'Relatório de Desempenho', desc: 'Avaliação brutalmente honesta no final da sessão' },
    ],
    docProcessed: 'Documento Processado',
    file: 'Ficheiro',
    mode: 'Modo',
    wordsExtracted: 'Palavras Extraídas',
    characters: 'Caracteres',
    language: 'Idioma',
    warningText:
      'O examinador estudou o teu documento e identificou potenciais fraquezas. Uma vez que começas, não há pausas. Prepara-te para defender cada decisão.',
    beginBtn: 'Iniciar Exame →',
    backBtn: '← Voltar',
    question: 'Pergunta',
    speaking: '● A Falar',
    evaluating: 'A AVALIAR RESPOSTA...',
    preparing: 'A PREPARAR PERGUNTA...',
    recording: 'A GRAVAR',
    answerPlaceholder: 'Escreve a tua resposta, ou usa o botão do microfone…',
    listeningPlaceholder: 'A ouvir… fala a tua defesa',
    examinerFeedback: 'Feedback do Examinador',
    submitAnswer: 'Enviar\nResposta',
    ctrlEnter: 'Ctrl+Enter para enviar rapidamente',
    history: '◀ Histórico',
    historyClose: '▶ Fechar',
    sessionHistory: 'Histórico da Sessão',
    you: 'Tu',
    feedback: 'Feedback',
    endSession: 'Terminar Sessão',
    examComplete: 'Exame Concluído',
    qAnswered: 'perguntas respondidas',
    newDoc: '← Carregar Novo Documento',
    ttsTitle: 'Voz do examinador',
    micTitle: 'Resposta por voz',
    modeLabels: { thesis_defense: 'Defesa de Tese', technical_interview: 'Entrevista Técnica' },
    langLabels: { en: 'Inglês', pt: 'Português' },
  },
}

// -- Helpers -------------------------------------------------------------------

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// -- TTS hook ------------------------------------------------------------------

function useTTS() {
  const isSpeaking = useRef(false)

  const speak = useCallback((text, language, onEnd) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = language === 'pt' ? 'pt-PT' : 'en-GB'
    utt.rate = 0.88
    utt.pitch = 0.85
    utt.volume = 1

    // Load voices and pick authoritative one
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      let preferred
      if (language === 'pt') {
        preferred =
          voices.find(v => v.lang === 'pt-PT') ||
          voices.find(v => v.lang.startsWith('pt'))
      } else {
        preferred =
          voices.find(v => v.name.includes('Daniel') && v.lang === 'en-GB') ||
          voices.find(v => v.name.includes('Google UK English Male')) ||
          voices.find(v => v.lang === 'en-GB') ||
          voices.find(v => v.name.toLowerCase().includes('male'))
      }
      if (preferred) utt.voice = preferred
    }

    if (window.speechSynthesis.getVoices().length) {
      setVoice()
    } else {
      window.speechSynthesis.onvoiceschanged = setVoice
    }

    isSpeaking.current = true
    utt.onend = () => { isSpeaking.current = false; onEnd?.() }
    utt.onerror = () => { isSpeaking.current = false; onEnd?.() }
    window.speechSynthesis.speak(utt)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    isSpeaking.current = false
  }, [])

  return { speak, stop, isSpeaking }
}

// -- STT hook ------------------------------------------------------------------

function useSTT({ onTranscript, language }) {
  const recogRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')

  const start = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) return
    const recog = new SpeechRec()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = language === 'pt' ? 'pt-PT' : 'en-US'

    recog.onresult = (e) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setInterimText(interim)
      if (final) onTranscript?.(final)
    }

    recog.onend = () => { setListening(false); setInterimText('') }
    recog.onerror = () => { setListening(false); setInterimText('') }

    recogRef.current = recog
    recog.start()
    setListening(true)
  }, [language, onTranscript])

  const stop = useCallback(() => {
    recogRef.current?.stop()
    setListening(false)
  }, [])

  return { start, stop, listening, interimText }
}

// -- TopBar --------------------------------------------------------------------

function TopBar({ phase, filename, mode, lang, onEnd }) {
  const t = T[lang]
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      borderBottom: '1px solid var(--border)',
      background: 'rgba(7,7,14,0.94)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', height: 52,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: 'var(--red)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>
          ⚖ {t.appTitle}
        </span>
        {filename && (
          <span style={{ color: 'var(--text-muted)', fontSize: 11, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
            {filename}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {mode && (
          <span style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            padding: '2px 10px', border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}>
            {t.modeLabels[mode]}
          </span>
        )}
        {lang && (
          <span style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            padding: '2px 8px', border: '1px solid var(--border)',
            color: 'var(--text-dim)',
          }}>
            {lang.toUpperCase()}
          </span>
        )}
        {phase === 'session' && (
          <button onClick={onEnd} style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            padding: '4px 12px', border: '1px solid var(--red-dim)',
            color: 'var(--red-dim)', cursor: 'pointer',
            transition: 'all 0.2s', background: 'none', fontFamily: 'var(--mono)',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--red-dim)'; e.target.style.color = 'var(--red-dim)' }}
          >
            {t.endSession}
          </button>
        )}
      </div>
    </header>
  )
}

// -- Upload screen -------------------------------------------------------------

function UploadScreen({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('thesis_defense')
  const [lang, setLang] = useState('en')
  const inputRef = useRef(null)
  const t = T[lang]

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await apiFetch('/upload', { method: 'POST', body: form })
      onUploaded({ ...data, mode, language: lang })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const modeOptions = [
    { id: 'thesis_defense', label: t.modeThesis, icon: '🎓' },
    { id: 'technical_interview', label: t.modeTech, icon: '💻' },
  ]
  const langOptions = [
    { id: 'en', flag: '🇬🇧', label: 'English' },
    { id: 'pt', flag: '🇵🇹', label: 'Português' },
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeUp 0.6s ease' }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 20 }}>
          {t.appSubtitle}
        </div>
        <h1 style={{
          fontFamily: 'var(--serif)', fontSize: 'clamp(42px, 6vw, 76px)',
          fontWeight: 300, lineHeight: 1.1, color: 'var(--text)', marginBottom: 16,
        }}>
          {t.heroTitle[0]}<br />
          <em style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{t.heroTitle[1]}</em>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
          {t.heroDesc}
        </p>
      </div>

      {/* Controls row: mode + language */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center',
        animation: 'fadeUp 0.6s ease 0.1s both',
      }}>
        {/* Mode selector */}
        <div style={{ border: '1px solid var(--border)', display: 'flex' }}>
          {modeOptions.map((m, i) => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '11px 24px', fontSize: 12, letterSpacing: 2,
              textTransform: 'uppercase', transition: 'all 0.2s', cursor: 'pointer',
              fontFamily: 'var(--mono)',
              background: mode === m.id ? 'var(--red)' : 'transparent',
              color: mode === m.id ? '#fff' : 'var(--text-muted)',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              border: 'none',
            }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Language selector */}
        <div style={{ border: '1px solid var(--border)', display: 'flex' }}>
          {langOptions.map((l, i) => (
            <button key={l.id} onClick={() => setLang(l.id)} style={{
              padding: '11px 20px', fontSize: 12, letterSpacing: 1,
              transition: 'all 0.2s', cursor: 'pointer', fontFamily: 'var(--mono)',
              background: lang === l.id ? 'var(--surface-2)' : 'transparent',
              color: lang === l.id ? 'var(--text)' : 'var(--text-muted)',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              border: 'none',
              outline: lang === l.id ? '1px solid var(--red-dim)' : 'none',
              outlineOffset: -1,
            }}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          width: '100%', maxWidth: 560, minHeight: 200,
          border: `1px solid ${dragging ? 'var(--red)' : 'var(--border)'}`,
          background: dragging ? 'var(--red-subtle)' : 'var(--surface)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: loading ? 'wait' : 'pointer', transition: 'all 0.25s', padding: 40,
          animation: 'fadeUp 0.6s ease 0.2s both',
          boxShadow: dragging ? '0 0 40px var(--red-glow)' : 'none',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {loading && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--red), transparent)',
            animation: 'scan-line 1.5s linear infinite',
          }} />
        )}
        <input ref={inputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        {loading ? (
          <>
            <div style={{
              width: 32, height: 32, border: '2px solid var(--border)',
              borderTop: '2px solid var(--red)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', marginBottom: 16,
            }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: 2 }}>{t.processing}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.5 }}>{dragging ? '⬇' : '📄'}</div>
            <p style={{ color: 'var(--text)', fontSize: 14, marginBottom: 6 }}>{t.dropTitle}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1 }}>{t.dropSub}</p>
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '12px 20px',
          border: '1px solid var(--red-dim)', color: 'var(--red)',
          fontSize: 12, maxWidth: 560, width: '100%', animation: 'fadeUp 0.3s ease',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Feature cards */}
      <div style={{
        marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1, maxWidth: 680, width: '100%', animation: 'fadeUp 0.6s ease 0.3s both',
      }}>
        {t.features.map(f => (
          <div key={f.label} style={{
            background: 'var(--surface)', padding: '18px 14px', textAlign: 'center',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--text)', marginBottom: 5, textTransform: 'uppercase' }}>{f.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// -- Ready screen --------------------------------------------------------------

function ReadyScreen({ sessionData, onStart, onReset }) {
  const t = T[sessionData.language]
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
    }}>
      <div style={{ maxWidth: 560, width: '100%', animation: 'fadeUp 0.5s ease' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 24 }}>
          {t.docProcessed}
        </div>

        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '28px 32px', marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { label: t.file, value: sessionData.filename },
              { label: t.mode, value: t.modeLabels[sessionData.mode] },
              { label: t.wordsExtracted, value: (sessionData.word_count || 0).toLocaleString() },
              { label: t.language, value: t.langLabels[sessionData.language] },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 5 }}>
                  {item.label}
                </div>
                <div style={{ color: 'var(--text)', fontSize: 13, wordBreak: 'break-all' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          border: '1px solid var(--border-hot)', background: 'var(--red-subtle)',
          padding: '14px 18px', marginBottom: 28, fontSize: 12,
          color: 'var(--text-muted)', lineHeight: 1.8,
        }}>
          ⚠ {t.warningText}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onStart} style={{
            flex: 1, padding: '15px', fontSize: 12, letterSpacing: 3,
            textTransform: 'uppercase', background: 'var(--red)', color: '#fff',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.target.style.background = '#e74c3c'}
            onMouseLeave={e => e.target.style.background = 'var(--red)'}
          >
            {t.beginBtn}
          </button>
          <button onClick={onReset} style={{
            padding: '15px 18px', fontSize: 12, letterSpacing: 2,
            border: '1px solid var(--border)', color: 'var(--text-muted)',
            cursor: 'pointer', background: 'none', fontFamily: 'var(--mono)',
          }}>
            {t.backBtn}
          </button>
        </div>
      </div>
    </div>
  )
}

// -- Session screen ------------------------------------------------------------

function SessionScreen({ sessionData, onComplete }) {
  const lang = sessionData.language
  const t = T[lang]

  const [question, setQuestion] = useState('')
  const [questionNum, setQuestionNum] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [answer, setAnswer] = useState('')
  const [history, setHistory] = useState([])
  const [phase, setPhase] = useState('loading')
  const [showHistory, setShowHistory] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [isSpeakingQ, setIsSpeakingQ] = useState(false)
  const [error, setError] = useState('')

  const { speak, stop } = useTTS()
  const finalTranscript = useRef('')

  const { start: startSTT, stop: stopSTT, listening, interimText } = useSTT({
    language: lang,
    onTranscript: (text) => {
      finalTranscript.current += text + ' '
      setAnswer(finalTranscript.current.trim())
    },
  })

  useEffect(() => { startExam() }, [])

  async function startExam() {
    setPhase('loading'); setError('')
    try {
      const data = await apiFetch(`/session/${sessionData.session_id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: sessionData.mode, language: lang }),
      })
      setQuestion(data.question)
      setQuestionNum(data.question_number)
      setPhase('questioning')
      setHistory([{ type: 'question', text: data.question, num: data.question_number }])
      if (ttsEnabled) {
        setIsSpeakingQ(true)
        speak(data.question, lang, () => setIsSpeakingQ(false))
      }
    } catch (e) {
      setError(e.message); setPhase('questioning')
    }
  }

  async function submitAnswer() {
    const ans = answer.trim()
    if (!ans) return
    stop(); stopSTT()
    setPhase('evaluating'); setError('')
    setHistory(h => [...h, { type: 'answer', text: ans }])

    try {
      const data = await apiFetch(`/session/${sessionData.session_id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: ans }),
      })
      setFeedback(data.feedback)
      setQuestion(data.question)
      setQuestionNum(data.question_number)
      setAnswer(''); finalTranscript.current = ''

      const additions = []
      if (data.feedback) additions.push({ type: 'feedback', text: data.feedback })
      additions.push({ type: 'question', text: data.question, num: data.question_number })
      setHistory(h => [...h, ...additions])
      setPhase('questioning')

      if (ttsEnabled) {
        const toSpeak = data.feedback ? `${data.feedback} ... ${data.question}` : data.question
        setIsSpeakingQ(true)
        speak(toSpeak, lang, () => setIsSpeakingQ(false))
      }
    } catch (e) {
      setError(e.message); setPhase('questioning')
    }
  }

  function toggleMic() {
    if (listening) {
      stopSTT()
    } else {
      stop(); setIsSpeakingQ(false)
      finalTranscript.current = answer
      startSTT()
    }
  }

  async function endSession() {
    stop(); stopSTT()
    try {
      const data = await apiFetch(`/session/${sessionData.session_id}/end`, { method: 'POST' })
      onComplete(data)
    } catch (e) { setError(e.message) }
  }

  const isLoading = phase === 'loading' || phase === 'evaluating'
  const canSubmit = phase === 'questioning' && answer.trim().length > 0

  return (
    <div style={{ display: 'flex', height: '100vh', paddingTop: 52 }}>
      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Question area */}
        <div style={{
          flex: 1, padding: '48px 48px 24px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {isSpeakingQ && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.04) 0%, transparent 70%)',
              animation: 'pulse-red 2s ease infinite',
            }} />
          )}

          {questionNum > 0 && (
            <div style={{ fontSize: 10, letterSpacing: 4, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 24 }}>
              {t.question} {questionNum}
              {isSpeakingQ && <span style={{ marginLeft: 16, color: 'var(--text-muted)' }}>{t.speaking}</span>}
            </div>
          )}

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 22, height: 22, border: '2px solid var(--border)',
                borderTop: '2px solid var(--red)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: 2 }}>
                {phase === 'evaluating' ? t.evaluating : t.preparing}
              </span>
            </div>
          ) : (
            <div style={{ animation: 'fadeUp 0.4s ease', maxWidth: 760 }}>
              <p style={{
                fontFamily: 'var(--serif)', fontSize: 'clamp(20px, 2.8vw, 30px)',
                fontWeight: 300, lineHeight: 1.55, color: 'var(--text)', letterSpacing: '0.2px',
                borderLeft: isSpeakingQ ? '3px solid var(--red)' : '3px solid var(--border)',
                paddingLeft: 24, transition: 'border-color 0.5s',
              }}>
                {question}
              </p>
            </div>
          )}

          {feedback && !isLoading && (
            <div style={{
              marginTop: 28, padding: '14px 18px',
              background: 'var(--amber-dim)', border: '1px solid rgba(200,146,42,0.2)',
              maxWidth: 680, animation: 'fadeUp 0.3s ease',
            }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 7 }}>
                {t.examinerFeedback}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{feedback}</p>
            </div>
          )}

          {error && <div style={{ marginTop: 16, color: 'var(--red)', fontSize: 12 }}>⚠ {error}</div>}
        </div>

        {/* Answer area */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '18px 48px' }}>
          {listening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ position: 'relative', width: 12, height: 12 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--red)',
                  animation: 'recording-ring 1.5s ease-out infinite',
                }} />
                <div style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: 'var(--red)' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--red)', letterSpacing: 2 }}>{t.recording}</span>
              {interimText && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 8 }}>
                  {interimText}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={listening ? t.listeningPlaceholder : t.answerPlaceholder}
              disabled={isLoading}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submitAnswer() }}
              style={{
                flex: 1, minHeight: 76, maxHeight: 160, resize: 'vertical',
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '11px 14px', fontSize: 13,
                lineHeight: 1.6, fontFamily: 'var(--mono)', opacity: isLoading ? 0.4 : 1,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--red-dim)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Mic */}
              <button onClick={toggleMic} disabled={isLoading} title={t.micTitle} style={{
                width: 46, height: 46,
                background: listening ? 'var(--red)' : 'var(--surface-2)',
                border: `1px solid ${listening ? 'var(--red)' : 'var(--border)'}`,
                color: listening ? '#fff' : 'var(--text-muted)',
                fontSize: 17, cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: listening ? '0 0 18px var(--red-glow)' : 'none',
              }}>
                {listening ? '⏹' : '🎤'}
              </button>

              {/* TTS toggle */}
              <button onClick={() => { setTtsEnabled(v => !v); if (isSpeakingQ) { stop(); setIsSpeakingQ(false) } }}
                title={t.ttsTitle} style={{
                  width: 46, height: 46, background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: ttsEnabled ? 'var(--text-muted)' : 'var(--text-dim)',
                  fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {ttsEnabled ? '🔊' : '🔇'}
              </button>
            </div>

            <button onClick={submitAnswer} disabled={!canSubmit} style={{
              minHeight: 76, padding: '0 24px',
              background: canSubmit ? 'var(--red)' : 'transparent',
              border: `1px solid ${canSubmit ? 'var(--red)' : 'var(--border)'}`,
              color: canSubmit ? '#fff' : 'var(--text-dim)',
              fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', fontFamily: 'var(--mono)', whiteSpace: 'pre-line',
            }}>
              {t.submitAnswer}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>{t.ctrlEnter}</div>
        </div>
      </div>

      {/* History sidebar */}
      <div style={{
        position: 'fixed', right: 0, top: 52, bottom: 0,
        width: showHistory ? 300 : 0, overflow: 'hidden',
        transition: 'width 0.3s ease',
        borderLeft: showHistory ? '1px solid var(--border)' : 'none',
        background: 'var(--surface)',
      }}>
        <div style={{ padding: 18, height: '100%', overflowY: 'auto', width: 300 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>
            {t.sessionHistory}
          </div>
          {history.map((item, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{
                fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5,
                color: item.type === 'question' ? 'var(--red)' : item.type === 'feedback' ? 'var(--amber)' : 'var(--text-dim)',
              }}>
                {item.type === 'question' ? `Q${item.num}` : item.type === 'feedback' ? t.feedback : t.you}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History toggle */}
      <button onClick={() => setShowHistory(s => !s)} style={{
        position: 'fixed', right: showHistory ? 300 : 0, top: '50%',
        transform: 'translateY(-50%)',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRight: 'none', color: 'var(--text-muted)',
        padding: '10px 5px', cursor: 'pointer',
        fontSize: 9, writingMode: 'vertical-lr', letterSpacing: 2,
        transition: 'right 0.3s',
      }}>
        {showHistory ? t.historyClose : t.history}
      </button>
    </div>
  )
}

// -- Assessment screen ---------------------------------------------------------

const SECTION_HEADERS_EN = ['SCORE:', 'VERDICT:', 'STRENGTHS:', 'CRITICAL GAPS:', 'STUDY PRIORITIES:', "EXAMINER'S NOTE:", "INTERVIEWER'S NOTE:"]
const SECTION_HEADERS_PT = ['PONTUAÇÃO:', 'VEREDICTO:', 'PONTOS FORTES:', 'LACUNAS CRÍTICAS:', 'PRIORIDADES DE ESTUDO:', 'NOTA DO EXAMINADOR:', 'NOTA DO ENTREVISTADOR:']

function AssessmentScreen({ data, onReset }) {
  const lang = data.language || 'en'
  const t = T[lang]
  const headers = lang === 'pt' ? SECTION_HEADERS_PT : SECTION_HEADERS_EN
  const lines = data.assessment.split('\n')

  const scoreMatch = data.assessment.match(/(?:SCORE|PONTUAÇÃO):\s*(\d+)\/10/)
  const scoreNum = scoreMatch ? parseInt(scoreMatch[1]) : null
  const scoreColor = scoreNum >= 7 ? 'var(--green)' : scoreNum >= 5 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{
      minHeight: '100vh', paddingTop: 52,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '72px 40px 60px',
    }}>
      <div style={{ maxWidth: 660, width: '100%', animation: 'fadeUp 0.5s ease' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 24 }}>
          {t.examComplete}
        </div>

        {scoreNum !== null && (
          <div style={{ marginBottom: 36, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 68, fontWeight: 300, color: scoreColor }}>
              {scoreNum}/10
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {data.questions_answered} {t.qAnswered} · {t.modeLabels[data.mode]}
            </span>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '28px 28px', marginBottom: 28 }}>
          {lines.map((line, i) => {
            if (!line.trim()) return <div key={i} style={{ height: 10 }} />
            const isHeader = headers.some(h => line.startsWith(h))
            return (
              <div key={i} style={{
                fontSize: isHeader ? 10 : 13,
                letterSpacing: isHeader ? 2 : 0,
                textTransform: isHeader ? 'uppercase' : 'none',
                color: isHeader ? 'var(--red)' : 'var(--text-muted)',
                lineHeight: 1.8, marginTop: isHeader ? 18 : 0,
                fontWeight: isHeader ? 700 : 400,
              }}>
                {line}
              </div>
            )
          })}
        </div>

        <button onClick={onReset} style={{
          width: '100%', padding: '14px', fontSize: 11, letterSpacing: 3,
          textTransform: 'uppercase', background: 'transparent',
          color: 'var(--text-muted)', border: '1px solid var(--border)',
          cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
        >
          {t.newDoc}
        </button>
      </div>
    </div>
  )
}

// -- Root App ------------------------------------------------------------------

export default function App() {
  const [phase, setPhase] = useState('upload')
  const [sessionData, setSessionData] = useState(null)
  const [assessmentData, setAssessmentData] = useState(null)

  const lang = sessionData?.language || 'en'

  function handleUploaded(data) { setSessionData(data); setPhase('ready') }
  function handleStart() { setPhase('session') }
  function handleComplete(data) { setAssessmentData(data); setPhase('assessment') }
  function handleReset() { setSessionData(null); setAssessmentData(null); setPhase('upload') }

  async function handleEndFromBar() {
    if (!sessionData) return
    try {
      const data = await apiFetch(`/session/${sessionData.session_id}/end`, { method: 'POST' })
      handleComplete(data)
    } catch { handleReset() }
  }

  return (
    <>
      <TopBar
        phase={phase}
        filename={sessionData?.filename}
        mode={sessionData?.mode}
        lang={lang}
        onEnd={handleEndFromBar}
      />
      {phase === 'upload' && <UploadScreen onUploaded={handleUploaded} />}
      {phase === 'ready' && <ReadyScreen sessionData={sessionData} onStart={handleStart} onReset={handleReset} />}
      {phase === 'session' && <SessionScreen sessionData={sessionData} onComplete={handleComplete} />}
      {phase === 'assessment' && <AssessmentScreen data={assessmentData} onReset={handleReset} />}
    </>
  )
}
