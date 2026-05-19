import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types

app = FastAPI(title="Adversarial Q&A Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()

sessions: dict = {}
MAX_CHARS = 300000

# -- Text extraction -----------------------------------------------------------

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = "".join(page.get_text() for page in doc)
        doc.close()
        return text
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {str(e)}")


def extract_text(file_bytes: bytes, filename: str) -> str:
    fname = filename.lower()
    if fname.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif fname.endswith((".txt", ".md")):
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        try:
            return extract_text_from_pdf(file_bytes)
        except Exception:
            return file_bytes.decode("utf-8", errors="ignore")


# -- Prompt content ------------------------------------------------------------

PERSONAS = {
    "thesis_defense": {
        "en": (
            "a ruthless, skeptical thesis committee examiner with 30 years of academic experience "
            "who has failed more dissertations than they have passed"
        ),
        "pt": (
            "um examinador de banca de dissertação implacável e cético, com 30 anos de experiência académica, "
            "que já reprovou mais dissertações do que aprovou"
        ),
    },
    "technical_interview": {
        "en": (
            "a brutally demanding Staff Engineer at a top-tier tech company, "
            "notorious for rejecting 90% of candidates with surgical precision"
        ),
        "pt": (
            "um Engenheiro Staff extremamente exigente numa empresa de tecnologia de topo, "
            "notório por rejeitar 90% dos candidatos com precisão cirúrgica"
        ),
    },
}

FOCUS = {
    "thesis_defense": {
        "en": """You are examining an academic thesis or dissertation. Your adversarial areas:
- Challenge the research methodology: why this design and not an experimental or quasi-experimental alternative?
- Attack statistical validity: sample size justification, selection bias, confounding variables, p-hacking risk.
- Expose contradictions between the literature review, methodology, and stated findings.
- Question overgeneralization: can conclusions extend beyond the specific study population?
- Demand justification for every theoretical framework chosen over known alternatives.
- Probe missing literature, ignored counterarguments, and undiscussed limitations.
- Ask why a specific measurement instrument was used rather than a validated standard.
- Challenge the true contribution to knowledge: is this novel or merely incremental?""",
        "pt": """Estás a examinar uma tese ou dissertação académica. As tuas áreas adversariais:
- Desafia a metodologia de investigação: por que este design e não uma alternativa experimental ou quasi-experimental?
- Ataca a validade estatística: justificação do tamanho da amostra, viés de seleção, variáveis de confundimento, risco de p-hacking.
- Expõe contradições entre a revisão de literatura, a metodologia e os resultados declarados.
- Questiona a overgeneralização: as conclusões podem estender-se para além da população específica estudada?
- Exige justificação para cada framework teórico escolhido em detrimento de alternativas conhecidas.
- Sonda literatura omitida, contra-argumentos ignorados e limitações não discutidas.
- Pergunta por que foi usado um instrumento de medição específico em vez de um padrão validado.
- Desafia a verdadeira contribuição para o conhecimento: é inovador ou apenas incremental?""",
    },
    "technical_interview": {
        "en": """You are interviewing a software or tech professional based solely on their CV. Your adversarial areas:
- Demand justification for every algorithm, architecture, and technology choice listed on the CV.
- Probe edge cases and failure modes of every system they claim to have built or maintained.
- Challenge scalability: what breaks at 10x, 100x, 1000x the load they described?
- Expose security vulnerabilities they may have overlooked in past projects.
- Question why they chose a specific framework or tool instead of established alternatives.
- Drill into gaps in employment history or suspiciously vague project descriptions.
- Ask what went wrong in listed projects and how they handled production incidents.
- Challenge impact metrics: how were they measured, and could they be inflated?
- Test real depth: anyone can list a technology on a CV - demand they explain its internals.""",
        "pt": """Estás a entrevistar um profissional de software ou tecnologia com base exclusivamente no seu CV. As tuas áreas adversariais:
- Exige justificação para cada escolha de algoritmo, arquitetura e tecnologia listada no CV.
- Sonda casos extremos e modos de falha de cada sistema que afirma ter construído ou mantido.
- Desafia a escalabilidade: o que falha com 10x, 100x, 1000x a carga que descreveu?
- Expõe vulnerabilidades de segurança que podem ter sido ignoradas em projetos anteriores.
- Questiona por que escolheu um framework ou ferramenta específica em vez de alternativas estabelecidas.
- Aprofunda lacunas no historial de emprego ou descrições de projetos suspeitamente vagas.
- Pergunta o que correu mal nos projetos listados e como lidou com incidentes em produção.
- Desafia métricas de impacto: como foram medidas e poderiam estar inflacionadas?
- Testa profundidade real: qualquer pessoa pode listar uma tecnologia no CV - exige que explique os seus internos.""",
    },
}

RULES = {
    "en": """ABSOLUTE RULES:
- Base questions ONLY on specific, verifiable content in the provided document.
- Never be encouraging or warm. Show zero sympathy.
- Ask exactly ONE focused, uncomfortable question. No compound questions.
- Begin directly with the question. No preamble whatsoever.
- All your output must be in English.""",
    "pt": """REGRAS ABSOLUTAS:
- Baseia as perguntas APENAS em conteúdo específico e verificável do documento fornecido.
- Nunca sejas encorajador ou simpático. Mostra zero empatia.
- Faz exatamente UMA pergunta focada e desconfortável. Sem perguntas compostas.
- Começa diretamente com a pergunta. Absolutamente sem preâmbulo.
- Todo o teu output deve ser em Português.""",
}

EVAL_INSTRUCTIONS = {
    "en": (
        "Evaluate the candidate's last answer and then ask your next question.\n\n"
        "Format strictly - use these exact labels:\n"
        "FEEDBACK: [1-3 sentences, blunt and specific - name exactly what was weak, missing, or wrong]\n"
        "QUESTION: [your next adversarial question, building on what they said or targeting a new vulnerability]\n\n"
        "Respond entirely in English."
    ),
    "pt": (
        "Avalia a última resposta do candidato e depois faz a tua próxima pergunta.\n\n"
        "Formato estrito - usa exatamente estes rótulos:\n"
        "FEEDBACK: [1-3 frases, direto e específico - nomeia exatamente o que foi fraco, omitido ou errado]\n"
        "PERGUNTA: [a tua próxima pergunta adversarial, baseada no que foi dito ou visando uma nova vulnerabilidade]\n\n"
        "Responde inteiramente em Português."
    ),
}

ASSESSMENT_PROMPTS = {
    "thesis_defense": {
        "en": """You examined a master's or doctoral candidate during their thesis defense. Based solely on the Q&A history, produce a final performance report.

Use this EXACT structure:
SCORE: [X/10]
VERDICT: [one sentence - pass / borderline / fail, and the decisive reason]

STRENGTHS:
- [specific strength observed in the session]
- [specific strength observed in the session]

CRITICAL GAPS:
- [specific weakness or gap revealed]
- [specific weakness or gap revealed]

STUDY PRIORITIES:
- [concrete thing to fix before the real defense]
- [concrete thing to fix before the real defense]

EXAMINER'S NOTE: [one final, blunt sentence about their readiness]

Be honest. Be harsh where warranted. Respond in English.""",

        "pt": """Examinaste um candidato a mestrado ou doutoramento durante a defesa de tese. Com base apenas no histórico de perguntas e respostas, produz um relatório final de desempenho.

Usa EXATAMENTE esta estrutura:
PONTUAÇÃO: [X/10]
VEREDICTO: [uma frase - aprovado / borderline / reprovado, e a razão decisiva]

PONTOS FORTES:
- [ponto forte específico observado na sessão]
- [ponto forte específico observado na sessão]

LACUNAS CRÍTICAS:
- [fraqueza ou lacuna específica revelada]
- [fraqueza ou lacuna específica revelada]

PRIORIDADES DE ESTUDO:
- [algo concreto a corrigir antes da defesa real]
- [algo concreto a corrigir antes da defesa real]

NOTA DO EXAMINADOR: [uma frase final e direta sobre a sua prontidão]

Sê honesto. Sê duro quando justificado. Responde em Português.""",
    },
    "technical_interview": {
        "en": """You interviewed a technical candidate based on their CV. Based solely on the Q&A history, produce a final performance report.

Use this EXACT structure:
SCORE: [X/10]
VERDICT: [one sentence - hire / borderline / no hire, and the decisive reason]

STRENGTHS:
- [specific technical strength observed]
- [specific strength observed]

CRITICAL GAPS:
- [specific technical weakness or gap revealed]
- [specific weakness or gap revealed]

STUDY PRIORITIES:
- [concrete thing to study before the real interview]
- [concrete thing to study before the real interview]

INTERVIEWER'S NOTE: [one final, blunt sentence about their readiness for a senior role]

Be honest. Be harsh where warranted. Respond in English.""",

        "pt": """Entrevistaste um candidato técnico com base no seu CV. Com base apenas no histórico de perguntas e respostas, produz um relatório final de desempenho.

Usa EXATAMENTE esta estrutura:
PONTUAÇÃO: [X/10]
VEREDICTO: [uma frase - contratar / borderline / não contratar, e a razão decisiva]

PONTOS FORTES:
- [ponto forte técnico específico observado]
- [ponto forte específico observado]

LACUNAS CRÍTICAS:
- [fraqueza ou lacuna técnica específica revelada]
- [fraqueza ou lacuna específica revelada]

PRIORIDADES DE ESTUDO:
- [algo concreto a estudar antes da entrevista real]
- [algo concreto a estudar antes da entrevista real]

NOTA DO ENTREVISTADOR: [uma frase final e direta sobre a sua prontidão para um cargo sénior]

Sê honesto. Sê duro quando justificado. Responde em Português.""",
    },
}


def build_system_prompt(mode: str, language: str, document_text: str, question_number: int) -> str:
    lang = language if language in ("en", "pt") else "en"
    persona = PERSONAS[mode][lang]
    focus = FOCUS[mode][lang]
    rules = RULES[lang]

    if question_number >= 3:
        escalation = (
            "\nThis is a late-stage question - identify the single most questionable or vulnerable point in the document and attack it directly."
            if lang == "en"
            else "\nEsta é uma pergunta de fase avançada - identifica o ponto mais questionável ou vulnerável no documento e ataca-o diretamente."
        )
    else:
        escalation = ""

    return (
        f"You are {persona}.\n\n"
        f"{focus}\n\n"
        f"DOCUMENT TO EXAMINE:\n---\n{document_text[:MAX_CHARS]}\n---\n\n"
        f"{rules}{escalation}"
    )


# -- Endpoints -----------------------------------------------------------------

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    text = extract_text(content, file.filename or "document").strip()

    if len(text) < 100:
        raise HTTPException(
            status_code=422,
            detail="Could not extract sufficient text. Ensure the PDF is not a scanned image.",
        )

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "document_text": text,
        "filename": file.filename,
        "history": [],
        "mode": None,
        "language": "en",
        "question_count": 0,
    }

    return {
        "session_id": session_id,
        "filename": file.filename,
        "char_count": len(text),
        "word_count": len(text.split()),
    }


class StartRequest(BaseModel):
    mode: str      # "thesis_defense" | "technical_interview"
    language: str  # "en" | "pt"


@app.post("/session/{session_id}/start")
async def start_session(session_id: str, req: StartRequest):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if req.mode not in ("thesis_defense", "technical_interview"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    if req.language not in ("en", "pt"):
        raise HTTPException(status_code=400, detail="Invalid language")

    session = sessions[session_id]
    session.update(mode=req.mode, language=req.language, history=[], question_count=0)

    system = build_system_prompt(req.mode, req.language, session["document_text"], 1)
    seed = "Begin the examination." if req.language == "en" else "Começa o exame."

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=seed,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=1024,
        ),
    )

    question = response.text.strip()
    session["question_count"] = 1
    session["history"].append({"role": "user", "content": seed})
    session["history"].append({"role": "model", "content": question})

    return {"question": question, "question_number": 1}


class AnswerRequest(BaseModel):
    answer: str


@app.post("/session/{session_id}/answer")
async def submit_answer(session_id: str, req: AnswerRequest):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    if not session.get("mode"):
        raise HTTPException(status_code=400, detail="Session not started")

    answer = req.answer.strip()
    if not answer:
        raise HTTPException(status_code=400, detail="Empty answer")

    lang = session.get("language", "en")
    next_q = session["question_count"] + 1
    
    session["history"].append({"role": "user", "content": answer})

    system = build_system_prompt(session["mode"], lang, session["document_text"], next_q)
    
    gemini_contents = []
    for msg in session["history"]:
        role = "model" if msg["role"] == "assistant" else "user"
        gemini_contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )
    
    gemini_contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=EVAL_INSTRUCTIONS[lang])])
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=gemini_contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=2048,
        ),
    )

    raw = response.text.strip()
    
    session["history"].append({"role": "assistant", "content": raw})
    session["question_count"] = next_q

    feedback, question = "", raw
    fb_label = "FEEDBACK:"
    q_label = "QUESTION:" if lang == "en" else "PERGUNTA:"

    if fb_label in raw and q_label in raw:
        try:
            parts = raw.split(q_label, 1)
            feedback = parts[0].replace(fb_label, "").strip()
            question = parts[1].strip()
        except Exception:
            pass
    elif q_label in raw:
        question = raw.split(q_label, 1)[1].strip()

    return {"feedback": feedback, "question": question, "question_number": next_q}


@app.post("/session/{session_id}/end")
async def end_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    if not session["history"]:
        raise HTTPException(status_code=400, detail="No history to assess")

    lang = session.get("language", "en")
    mode = session.get("mode", "technical_interview")
    assessment_system = ASSESSMENT_PROMPTS[mode][lang]
    seed = (
        "Provide the final performance assessment."
        if lang == "en"
        else "Fornece a avaliação final de desempenho."
    )

    gemini_contents = []
    for msg in session["history"]:
        role = "model" if msg["role"] == "assistant" else "user"
        gemini_contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )
    gemini_contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=seed)])
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=gemini_contents,
        config=types.GenerateContentConfig(
            system_instruction=assessment_system,
            max_output_tokens=1024,
        ),
    )

    assessment = response.text.strip()
    sessions[session_id]["complete"] = True

    return {
        "assessment": assessment,
        "questions_answered": session["question_count"] - 1,
        "mode": mode,
        "language": lang,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
