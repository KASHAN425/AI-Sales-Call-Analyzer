import os
import sys
import json
import re

# Set UTF-8 output encoding for Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def get_gemini_api_key():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", ".env")
    
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip().lower()
                    if key in ["gimini-api", "gemini_api", "gemini_api_key", "google_api_key"]:
                        return val.strip().strip("\"' ")
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

api_key = get_gemini_api_key()
print(f"API Key found: {'Yes (' + api_key[:6] + '...)' if api_key else 'No'}")

from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-3.8-flash",
    google_api_key=api_key,
    temperature=0.2
)

transcript = "Sales: Hello, I am Sales Representative. Today, I will explain our website development services. Customer: Thank you. I am interested in your service. I would like to know about the pricing."

prompt = f"""You are an elite sales call analyzer and executive coach.
Analyze the following call transcript:
\"\"\"{transcript}\"\"\"

Generate a comprehensive sales intelligence report in strictly valid JSON format matching this structure:
{{
  "conversation": [
    {{"role": "SALES REPRESENTATIVE", "speaker": "Sales Representative", "text": "Hello, I am Sales Representative. Today, I will explain our website development services."}},
    {{"role": "CUSTOMER", "speaker": "Customer", "text": "Thank you. I am interested in your service. I would like to know about the pricing."}}
  ],
  "customer_analysis": {{
    "sentiment": [
      {{"text": "...", "label": "POSITIVE", "score": 0.92, "reason": "Customer expressed interest in the service."}}
    ],
    "overall_sentiment": "Positive",
    "intent": [
      {{"text": "...", "customer_need": "Website development pricing", "intent": "Inquiring about service pricing", "buying_intent_score": 0.8}}
    ],
    "primary_need": "Website development pricing and scope",
    "buying_intent": "High",
    "buying_intent_score": 0.8,
    "objections": [],
    "questions": [
      {{"question": "Pricing inquiry", "text": "I would like to know about the pricing."}}
    ]
  }},
  "salesperson_analysis": {{
    "performance_score": 68,
    "performance_rating": "Average",
    "communication_score": 70,
    "engagement_score": 65,
    "strengths": [
      "Clearly introduced website development services"
    ],
    "improvements": [
      "Did not proactively address pricing options or ask qualifying questions"
    ],
    "recommendations": [
      "Follow up promptly with clear, tiered website development pricing options.",
      "Ask discovery questions about the customer's website goals, design preferences, and timeline."
    ],
    "metrics": {{
      "salesperson_talk_percentage": 50.0,
      "customer_talk_percentage": 50.0,
      "salesperson_questions": 0,
      "salesperson_message_count": 1,
      "customer_message_count": 1,
      "salesperson_word_count": 14,
      "customer_word_count": 15
    }}
  }},
  "next_call_strategy": {{
    "suggested_timing": "Within 24 hours",
    "objective": "Present tailored website development pricing tiers and discover project scope.",
    "priority": "Address the customer's pricing question before proposing a contract.",
    "checklist": [
      "Prepare transparent pricing packages for website development.",
      "Ask open-ended discovery questions to clarify their requirements.",
      "Confirm their target launch date and budget expectations.",
      "Schedule a demo or proposal walkthrough."
    ]
  }},
  "recommended_conversation": {{
    "opening": "Hi! Thanks for your interest in our website development services. I'm following up to share the pricing details you requested.",
    "discovery_question": "To give you the most accurate quote, could you share a bit more about what features or pages you need for your website?",
    "objection_handling": "Our pricing packages are structured to provide high ROI, ranging from starter packages to full custom builds to match your exact budget.",
    "value_proposition": "We build fast, modern, and mobile-optimized websites designed specifically to convert your visitors into paying customers.",
    "closing_question": "Would tomorrow afternoon work for a quick 10-minute walkthrough of our packages?"
  }},
  "sales_coaching": [
    {{
      "area": "Discovery",
      "title": "Uncover project requirements early",
      "advice": "When a customer asks for pricing, ask 1-2 quick scope questions before quoting to tailor the value."
    }},
    {{
      "area": "Next Steps",
      "title": "Always secure a concrete follow-up",
      "advice": "Lock down a specific date and time for the pricing review rather than leaving it open-ended."
    }}
  ],
  "follow_up_actions": [
    {{
      "action": "Send website development pricing sheet",
      "detail": "Email standard packages and case studies within 4 hours."
    }},
    {{
      "action": "Schedule scope discovery call",
      "detail": "Invite the customer to a 15-minute call to finalize specifications."
    }}
  ],
  "summary": {{
    "call_summary": "Customer showed strong interest in website development services and explicitly requested pricing information. The salesperson introduced the offering but has not yet provided quotes.",
    "salesperson_score": 68,
    "salesperson_rating": "Average",
    "objection_count": 0,
    "question_count": 1
  }}
}}

Provide ONLY the JSON response without codeblocks.
"""

print("Invoking Gemini via LangChain...")
response = llm.invoke(prompt)

content = response.content
if isinstance(content, list):
    content = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
elif not isinstance(content, str):
    content = str(content)

content = content.strip()
if content.startswith("```"):
    content = re.sub(r"^```[a-zA-Z]*\n?", "", content)
    content = re.sub(r"\n?```$", "", content)

data = json.loads(content.strip())
print("Test completed successfully!")
print("Customer Need:", data.get("customer_analysis", {}).get("primary_need"))
print("Performance Score:", data.get("salesperson_analysis", {}).get("performance_score"))
print("Recommendations:", data.get("salesperson_analysis", {}).get("recommendations"))
print("Next Call Timing:", data.get("next_call_strategy", {}).get("suggested_timing"))
