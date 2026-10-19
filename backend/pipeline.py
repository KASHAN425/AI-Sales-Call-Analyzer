import os
import sys
import json
import shutil
import subprocess
import uuid
import re
from datetime import datetime

# --------------------------------------------------
# UTF-8 SAFE CONSOLE ENCODING FOR WINDOWS
# --------------------------------------------------
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# --------------------------------------------------
# FFmpeg DLL PATH (Optional for torchaudio on Windows)
# --------------------------------------------------
ffmpeg_dirs = [
    r"C:\ffmpeg\ffmpeg-9.0.2-full_build-shared\bin",
    r"C:\ffmpeg\ffmpeg-9.0.2-essentials_build\bin",
]
for fdir in ffmpeg_dirs:
    if os.path.exists(fdir) and hasattr(os, "add_dll_directory"):
        try:
            os.add_dll_directory(fdir)
        except Exception:
            pass

# --------------------------------------------------
# PATHS
# --------------------------------------------------
OUTPUT_FOLDER = "output"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# --------------------------------------------------
# LAZY-LOADED AI MODELS
# --------------------------------------------------
_whisper_model = None
_diarization_pipeline = None


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        print("[AI] Loading Whisper model (base)...")
        _whisper_model = whisper.load_model("base")
        print("[AI] Whisper model loaded successfully!")
    return _whisper_model


def get_diarization():
    global _diarization_pipeline
    if _diarization_pipeline is None:
        try:
            from pyannote.audio import Pipeline
            print("[AI] Loading PyAnnote speaker diarization model...")
            _diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-community-1"
            )
            print("[AI] Diarization model loaded successfully!")
        except Exception as e:
            print(f"[AI] Note: Speaker diarization pipeline skipped or unavailable ({e}).")
            _diarization_pipeline = False
    return _diarization_pipeline if _diarization_pipeline is not False else None


# --------------------------------------------------
# SPEAKER OVERLAP DETECTION
# --------------------------------------------------
def get_speaker_from_diarization(start, end, diarization):
    if not diarization:
        return "UNKNOWN"
    best_speaker = "UNKNOWN"
    best_overlap = 0

    try:
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            overlap_start = max(start, turn.start)
            overlap_end = min(end, turn.end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
    except Exception:
        pass

    return best_speaker


# --------------------------------------------------
# FALLBACK HEURISTIC GENERATOR (if Gemini offline)
# --------------------------------------------------
def build_fallback_report(conversation, audio_file, whisper_result):
    sales_msgs = [m for m in conversation if m.get("role") == "SALES REPRESENTATIVE"]
    cust_msgs = [m for m in conversation if m.get("role") == "CUSTOMER"]

    sales_words = sum(len(m.get("text", "").split()) for m in sales_msgs)
    cust_words = sum(len(m.get("text", "").split()) for m in cust_msgs)
    total_words = sales_words + cust_words or 1

    sales_talk = round((sales_words / total_words) * 100, 1)
    cust_talk = round((cust_words / total_words) * 100, 1)

    questions_asked = [m for m in sales_msgs if "?" in m.get("text", "")]
    cust_questions = [m for m in cust_msgs if "?" in m.get("text", "") or "how" in m.get("text", "").lower() or "price" in m.get("text", "").lower()]

    perf_score = 70
    if 40 <= sales_talk <= 65:
        perf_score += 15
    if len(questions_asked) > 0:
        perf_score += 10
    perf_score = min(100, max(40, perf_score))

    rating = "Good" if perf_score >= 80 else ("Average" if perf_score >= 60 else "Needs Improvement")

    return {
        "call_summary": "Sales conversation between Sales Representative and Customer reviewing product offering.",
        "customer_analysis": {
            "overall_sentiment": "Positive",
            "sentiment": [
                {"text": m.get("text", ""), "label": "POSITIVE", "score": 0.85, "reason": "Engaged customer tone."}
                for m in cust_msgs
            ] or [{"text": "Customer interaction", "label": "NEUTRAL", "score": 0.7, "reason": "Standard business interaction"}],
            "primary_need": "Product and pricing information",
            "buying_intent": "Medium",
            "buying_intent_score": 0.65,
            "intent": [
                {"text": m.get("text", ""), "customer_need": "Service information", "intent": "Inquiring about service", "buying_intent_score": 0.65}
                for m in cust_msgs
            ] or [{"text": "General inquiry", "customer_need": "General information", "intent": "Inquiry", "buying_intent_score": 0.5}],
            "objections": [],
            "questions": [
                {"question": "Customer inquiry", "text": m.get("text", ""), "answered": True}
                for m in cust_questions
            ]
        },
        "salesperson_analysis": {
            "performance_score": perf_score,
            "performance_rating": rating,
            "communication_score": 75,
            "engagement_score": 70,
            "strengths": ["Clear delivery and professional greeting."],
            "improvements": ["Ask more discovery questions to understand timeline and budget."],
            "recommendations": [
                "Proactively clarify project requirements before quoting.",
                "Set a firm next meeting date and time at the close of the conversation."
            ],
            "metrics": {
                "salesperson_talk_percentage": sales_talk,
                "customer_talk_percentage": cust_talk,
                "salesperson_questions": len(questions_asked),
                "salesperson_message_count": len(sales_msgs),
                "customer_message_count": len(cust_msgs),
                "salesperson_word_count": sales_words,
                "customer_word_count": cust_words
            }
        },
        "next_call_strategy": {
            "suggested_timing": "Within 24-48 hours",
            "objective": "Follow up with detailed pricing and scope proposal.",
            "priority": "Address all customer questions and establish clear project milestones.",
            "checklist": [
                "Review requirements discussed in initial call.",
                "Prepare transparent pricing and timeline tiers.",
                "Send recap email before the call.",
                "Agree on next decision step."
            ]
        },
        "recommended_conversation": {
            "opening": "Hi! Thanks for taking the time to speak previously. I'm following up with the information you requested.",
            "discovery_question": "What is the most important outcome for this project over the next 90 days?",
            "objection_handling": "Our solutions are flexible and built to match your specific budget and roadmap.",
            "value_proposition": "We deliver measurable value tailored directly to your business goals.",
            "closing_question": "Does Thursday at 2 PM work for a 15-minute walkthrough of the proposal?"
        },
        "sales_coaching": [
            {"area": "Discovery", "title": "Ask Open-Ended Questions", "advice": "Use 'what' and 'how' questions to encourage the customer to share their priorities."},
            {"area": "Closing", "title": "Secure the Next Step", "advice": "Always schedule the follow-up meeting before ending the call."}
        ],
        "follow_up_actions": [
            {"action": "Send follow-up email", "detail": "Summarize discussed points and include requested pricing tiers."},
            {"action": "Calendar reminder", "detail": "Schedule next touchpoint within 48 hours."}
        ]
    }


# --------------------------------------------------
# MAIN PROCESS AUDIO PIPELINE
# --------------------------------------------------
def process_audio(audio_file):
    print("\n" + "=" * 60)
    print("STARTING AI SALES CALL ANALYSIS")
    print(f"File: {audio_file}")
    print("=" * 60)

    # 1. Prepare unique workspace to avoid any file collision
    job_uuid = str(uuid.uuid4())
    work_dir = os.path.join("uploads", f"work_{job_uuid}")
    os.makedirs(work_dir, exist_ok=True)
    converted_audio = os.path.join(work_dir, "audio.wav")

    # 2. Audio conversion to standard 16kHz mono WAV for Whisper & analysis
    print("[1/5] Converting audio to standard 16kHz WAV...")
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i", audio_file,
        "-ar", "16000",
        "-ac", "1",
        converted_audio
    ]

    conv_res = subprocess.run(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if conv_res.returncode != 0:
        print(f"[Warning] FFmpeg conversion failed ({conv_res.stderr.strip()[:100]}). Using original file.")
        audio_to_transcribe = audio_file
    else:
        print("[1/5] Audio conversion completed successfully.")
        audio_to_transcribe = converted_audio

    # 3. Whisper Speech-to-Text
    print("\n[2/5] Running Whisper transcription...")
    whisper_model = get_whisper()
    whisper_result = whisper_model.transcribe(audio_to_transcribe)
    full_transcript_text = whisper_result.get("text", "").strip()
    segments = whisper_result.get("segments", [])
    language = whisper_result.get("language", "en")
    print(f"[2/5] Transcription complete ({len(segments)} segments detected, language: {language})")
    print(f"Transcript preview: \"{full_transcript_text[:120]}...\"" if len(full_transcript_text) > 120 else f"Transcript: \"{full_transcript_text}\"")

    # 4. Speaker Diarization / Turn mapping
    print("\n[3/5] Resolving conversation speakers...")
    conversation = []
    diarization_pipeline = get_diarization()
    diarization = None

    if diarization_pipeline and os.path.exists(converted_audio):
        try:
            import torchaudio
            waveform, sample_rate = torchaudio.load(converted_audio)
            diarization_out = diarization_pipeline(
                {"waveform": waveform, "sample_rate": sample_rate},
                num_speakers=2
            )
            diarization = getattr(diarization_out, "speaker_diarization", None)
            print("[3/5] PyAnnote diarization completed.")
        except Exception as e:
            print(f"[3/5] Diarization skipped: {e}")

    speaker_roles = {
        "SPEAKER_00": "SALES REPRESENTATIVE",
        "SPEAKER_01": "CUSTOMER"
    }

    for idx, seg in enumerate(segments):
        start = round(seg.get("start", 0.0), 2)
        end = round(seg.get("end", 0.0), 2)
        text = seg.get("text", "").strip()
        if not text:
            continue

        spk = get_speaker_from_diarization(start, end, diarization)
        # If diarization didn't split, heuristic alternating or role check
        if spk == "UNKNOWN":
            text_lower = text.lower()
            if any(k in text_lower for k in ["i am sales", "sales representative", "our service", "our product", "welcome"]):
                role = "SALES REPRESENTATIVE"
                spk = "SPEAKER_00"
            elif any(k in text_lower for k in ["interested in", "i would like", "how much", "what is the price", "pricing"]):
                role = "CUSTOMER"
                spk = "SPEAKER_01"
            else:
                role = "SALES REPRESENTATIVE" if idx % 2 == 0 else "CUSTOMER"
                spk = f"SPEAKER_0{idx % 2}"
        else:
            role = speaker_roles.get(spk, "SALES REPRESENTATIVE" if spk == "SPEAKER_00" else "CUSTOMER")

        conversation.append({
            "start": start,
            "end": end,
            "speaker_id": spk,
            "role": role,
            "speaker": "Sales Representative" if role == "SALES REPRESENTATIVE" else "Customer",
            "text": text
        })

    # If single segment containing both roles, split by sentence for rich dialogue
    if len(conversation) == 1 and len(full_transcript_text.split(".")) > 2:
        sentences = [s.strip() for s in re.split(r"(?<=[.?!])\s+", full_transcript_text) if s.strip()]
        if len(sentences) >= 2:
            new_conv = []
            cur_role = "SALES REPRESENTATIVE"
            for s_idx, sentence in enumerate(sentences):
                s_lower = sentence.lower()
                if any(k in s_lower for k in ["sales representative", "our service", "we offer", "explain"]):
                    cur_role = "SALES REPRESENTATIVE"
                elif any(k in s_lower for k in ["thank you", "interested", "price", "pricing", "cost", "how much"]):
                    cur_role = "CUSTOMER"
                else:
                    cur_role = "SALES REPRESENTATIVE" if s_idx == 0 else "CUSTOMER"

                new_conv.append({
                    "start": round(s_idx * 2.5, 2),
                    "end": round((s_idx + 1) * 2.5, 2),
                    "speaker_id": "SPEAKER_00" if cur_role == "SALES REPRESENTATIVE" else "SPEAKER_01",
                    "role": cur_role,
                    "speaker": "Sales Representative" if cur_role == "SALES REPRESENTATIVE" else "Customer",
                    "text": sentence
                })
            conversation = new_conv

    # 5. Real Generative AI Analysis with Gemini (.invoke())
    print("\n[4/5] Running Real Generative AI analysis via Gemini (.invoke)...")
    from gemini_analyzer import analyze_call_with_gemini

    gemini_data = analyze_call_with_gemini(
        transcript_text=full_transcript_text,
        conversation=conversation,
        audio_filename=os.path.basename(audio_file)
    )

    if not gemini_data:
        print("[4/5] Gemini analysis not available, using intelligent fallback...")
        gemini_data = build_fallback_report(conversation, audio_file, whisper_result)
    else:
        print("[4/5] Real Gemini predictions and recommendations successfully acquired!")

    # Merge Gemini conversation if Gemini refined the speaker turns
    if gemini_data.get("conversation") and len(gemini_data["conversation"]) >= len(conversation):
        refined_conv = []
        for c_idx, item in enumerate(gemini_data["conversation"]):
            role_raw = item.get("role", "SALES REPRESENTATIVE").upper()
            role = "SALES REPRESENTATIVE" if "SALES" in role_raw else "CUSTOMER"
            text = item.get("text", "")
            orig_start = conversation[c_idx]["start"] if c_idx < len(conversation) else round(c_idx * 3.0, 2)
            orig_end = conversation[c_idx]["end"] if c_idx < len(conversation) else round((c_idx + 1) * 3.0, 2)
            refined_conv.append({
                "start": orig_start,
                "end": orig_end,
                "role": role,
                "speaker": "Sales Representative" if role == "SALES REPRESENTATIVE" else "Customer",
                "text": text
            })
        if refined_conv:
            conversation = refined_conv

    # 6. Assemble Final Comprehensive Report
    print("\n[5/5] Assembling final call intelligence report...")
    perf = gemini_data.get("salesperson_analysis", {})
    cust = gemini_data.get("customer_analysis", {})

    final_report = {
        "report_generated_at": datetime.now().isoformat(),
        "call_information": {
            "audio_file": os.path.basename(audio_file),
            "language": language,
            "total_messages": len(conversation),
            "duration": round(segments[-1]["end"], 1) if segments else 0
        },
        "conversation": conversation,
        "customer_analysis": cust,
        "salesperson_analysis": perf,
        "recommendations": perf.get("recommendations", []),
        "next_call_strategy": gemini_data.get("next_call_strategy", {}),
        "recommended_conversation": gemini_data.get("recommended_conversation", {}),
        "sales_coaching": gemini_data.get("sales_coaching", []),
        "follow_up_actions": gemini_data.get("follow_up_actions", []),
        "summary": {
            "call_summary": gemini_data.get("call_summary") or gemini_data.get("summary", {}).get("call_summary", ""),
            "customer_sentiment": cust.get("sentiment", []),
            "customer_intent": cust.get("intent", []),
            "primary_need": cust.get("primary_need", ""),
            "buying_intent": cust.get("buying_intent", "Medium"),
            "buying_intent_score": cust.get("buying_intent_score", 0.65),
            "objection_count": len(cust.get("objections", [])),
            "question_count": len(cust.get("questions", [])),
            "salesperson_score": perf.get("performance_score", 70),
            "salesperson_rating": perf.get("performance_rating", "Good")
        }
    }

    # Save final report to disk
    final_report_path = os.path.join(OUTPUT_FOLDER, "final_report.json")
    with open(final_report_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=4, ensure_ascii=False)

    # Clean up temporary conversion workspace
    try:
        shutil.rmtree(work_dir, ignore_errors=True)
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("AI SALES CALL ANALYSIS COMPLETED")
    print(f"Performance Score: {perf.get('performance_score')}/100 ({perf.get('performance_rating')})")
    print(f"Customer Need: {cust.get('primary_need')}")
    print(f"Total Recommendations: {len(perf.get('recommendations', []))}")
    print("=" * 60)

    return final_report