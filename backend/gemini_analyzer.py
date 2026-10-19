import os
import sys
import json
import re

# Set UTF-8 encoding for standard output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def get_gemini_api_key():
    """
    Safely load the Gemini API key from .env or environment variables.
    Supports keys like 'Gimini-api', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', etc.
    """
    candidates = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", ".env")
    ]
    for env_path in candidates:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            key, val = line.split("=", 1)
                            key_clean = key.strip().lower()
                            if key_clean in [
                                "gimini-api",
                                "gemini-api",
                                "gemini_api",
                                "gemini_api_key",
                                "google_api_key"
                            ]:
                                cleaned_val = val.strip().strip("\"' ")
                                if cleaned_val:
                                    return cleaned_val
            except Exception as e:
                print(f"[Gemini] Warning reading {env_path}: {e}")

    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


_llm_instance = None


def get_gemini_llm(model_override=None):
    """
    Initializes and caches the LangChain ChatGoogleGenerativeAI client using .invoke().
    Supports multi-model fallback to avoid rate limits (429).
    """
    global _llm_instance
    if _llm_instance is not None and not model_override:
        return _llm_instance

    api_key = get_gemini_api_key()
    if not api_key:
        print("[Gemini] WARNING: No Gemini API key found in .env or environment.")
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        candidate_models = [model_override] if model_override else [
            "gemini-flash-lite-latest",
            "gemini-3.8-flash",
            "gemini-flash-latest"
        ]

        for model_name in candidate_models:
            if not model_name:
                continue
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    google_api_key=api_key,
                    temperature=0.2
                )
                print(f"[Gemini] LangChain ChatGoogleGenerativeAI initialized with {model_name}.")
                _llm_instance = llm
                return _llm_instance
            except Exception as e:
                print(f"[Gemini] Could not initialize {model_name}: {e}. Trying next candidate...")

        return None
    except Exception as e:
        print(f"[Gemini] Error loading ChatGoogleGenerativeAI: {e}")
        return None


def extract_llm_text(response):
    """
    Extracts text cleanly from a LangChain response object or string.
    """
    if response is None:
        return ""
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict):
                parts.append(p.get("text", ""))
            else:
                parts.append(str(p))
        return "".join(parts)
    return str(content)


def clean_json_text(text):
    """
    Cleans markdown code fences from JSON text.
    """
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def analyze_call_with_gemini(transcript_text, conversation=None, audio_filename="audio.mp3"):
    """
    Performs comprehensive sales intelligence analysis on the transcript using Gemini's .invoke().
    Returns a complete structured dictionary ready for final_report and frontend display.
    """
    llm = get_gemini_llm()
    if not llm:
        print("[Gemini] LLM not available. Falling back to default heuristics.")
        return None

    # Prepare formatted conversation snippet
    conv_context = ""
    if conversation and isinstance(conversation, list):
        lines = []
        for item in conversation:
            role = item.get("role", "SPEAKER")
            text = item.get("text", "")
            lines.append(f"{role}: {text}")
        conv_context = "\n".join(lines)
    else:
        conv_context = transcript_text or ""

    prompt = f"""You are an elite Sales Call Intelligence AI and Executive Sales Coach (comparable to Gong.io or Chorus).
Analyze the following sales call transcript and audio details:

Audio Filename: {audio_filename}
Call Transcript:
\"\"\"{conv_context}\"\"\"

Generate a rich, highly specific sales call analysis report.
Output ONLY valid JSON matching this exact structure:
{{
  "call_summary": "Concise 2-3 sentence executive summary of what happened, key customer interest, and outcome.",
  "conversation": [
    {{
      "role": "SALES REPRESENTATIVE" or "CUSTOMER",
      "speaker": "Sales Representative" or "Customer",
      "text": "spoken dialogue"
    }}
  ],
  "customer_analysis": {{
    "overall_sentiment": "Positive" or "Neutral" or "Negative",
    "sentiment": [
      {{
        "text": "customer utterance snippet",
        "label": "POSITIVE" or "NEGATIVE" or "NEUTRAL",
        "score": 0.85,
        "reason": "Brief explanation of tone and attitude"
      }}
    ],
    "primary_need": "Specific need expressed by the customer (e.g. Website development pricing, CRM migration)",
    "buying_intent": "High" or "Medium" or "Low",
    "buying_intent_score": 0.75,
    "intent": [
      {{
        "text": "relevant sentence",
        "customer_need": "detected need",
        "intent": "specific customer intent description",
        "buying_intent_score": 0.8
      }}
    ],
    "objections": [
      {{
        "objection": "Price objection / Timing objection / etc.",
        "text": "customer statement expressing hesitation or objection",
        "severity": "High" or "Medium" or "Low",
        "rebuttal": "Recommended rebuttal to resolve this objection"
      }}
    ],
    "questions": [
      {{
        "question": "Question category or summary",
        "text": "the exact question asked by customer",
        "answered": true or false
      }}
    ]
  }},
  "salesperson_analysis": {{
    "performance_score": 75,
    "performance_rating": "Good" or "Average" or "Needs Improvement" or "Excellent",
    "communication_score": 80,
    "engagement_score": 70,
    "strengths": [
      "Specific strength observed in this call"
    ],
    "improvements": [
      "Specific weakness or missed opportunity observed"
    ],
    "recommendations": [
      "Concrete, high-impact recommendation for the sales representative"
    ],
    "metrics": {{
      "salesperson_talk_percentage": 55.0,
      "customer_talk_percentage": 45.0,
      "salesperson_questions": 1,
      "salesperson_message_count": 1,
      "customer_message_count": 1,
      "salesperson_word_count": 25,
      "customer_word_count": 20
    }}
  }},
  "next_call_strategy": {{
    "suggested_timing": "Within 24 hours" or "Within 2-3 business days",
    "objective": "Clear, measurable goal for the next call",
    "priority": "Highest priority topic to address first",
    "checklist": [
      "Step 1 to prepare or execute for next call",
      "Step 2",
      "Step 3",
      "Step 4"
    ]
  }},
  "recommended_conversation": {{
    "opening": "Natural opening line for the follow-up call referencing this discussion",
    "discovery_question": "High-impact open-ended question to uncover customer budget or timeline",
    "objection_handling": "Tailored rebuttal addressing the customer's specific concern",
    "value_proposition": "Compelling pitch connecting the solution to their primary need",
    "closing_question": "Call-to-action to lock in the next step"
  }},
  "sales_coaching": [
    {{
      "area": "Strength" or "Improvement" or "Discovery" or "Listening" or "Closing",
      "title": "Coaching Title",
      "advice": "Actionable coaching guidance for the salesperson"
    }}
  ],
  "follow_up_actions": [
    {{
      "action": "Immediate follow-up task name",
      "detail": "Actionable instructions and timing"
    }}
  ]
}}

Rules:
1. Base all scores, needs, objections, and scripts directly on the actual conversation.
2. If there are no objections, keep "objections" as an empty list [].
3. Ensure the JSON is completely valid, with escaped quotes and no trailing commas.
4. Output raw JSON only.
"""

    try:
        print("[Gemini] Invoking Gemini AI model for full sales analysis...")
        # REAL GENERATIVE AI INVOKE
        response = llm.invoke(prompt)
        raw_text = extract_llm_text(response)
        cleaned_text = clean_json_text(raw_text)

        parsed_data = json.loads(cleaned_text)
        print("[Gemini] Analysis successfully generated and parsed from Gemini!")
        return parsed_data

    except Exception as e:
        print(f"[Gemini] Error invoking or parsing Gemini response: {e}")
        return None
