
import json
import os
import re

# Input and output files
INPUT_FILE = "output/transcript.json"
INTENT_FILE = "output/intent_analysis.json"
OBJECTION_FILE = "output/objection_analysis.json"
OUTPUT_FILE = "output/performance_analysis.json"


def load_json(file_path):
    if not os.path.exists(file_path):
        return {}

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(data, file_path):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)


def word_count(text):
    return len(re.findall(r"\b[\w'-]+\b", text))


def analyze_performance():
    transcript_data = load_json(INPUT_FILE)
    intent_data = load_json(INTENT_FILE)
    objection_data = load_json(OBJECTION_FILE)

    conversation = transcript_data.get("conversation", [])

    salesperson_messages = [
        item for item in conversation
        if item.get("role", "").upper() == "SALES REPRESENTATIVE"
    ]

    customer_messages = [
        item for item in conversation
        if item.get("role", "").upper() == "CUSTOMER"
    ]

    if not salesperson_messages:
        print("ERROR: No salesperson messages found.")
        print("Check the speaker roles in transcript.json.")
        return

    if not customer_messages:
        print("ERROR: No customer messages found.")
        return

    # Basic communication metrics
    sales_texts = [
        item.get("text", "").strip()
        for item in salesperson_messages
    ]

    customer_texts = [
        item.get("text", "").strip()
        for item in customer_messages
    ]

    sales_words = sum(word_count(text) for text in sales_texts)
    customer_words = sum(word_count(text) for text in customer_texts)

    total_words = sales_words + customer_words

    sales_talk_percentage = (
        round((sales_words / total_words) * 100, 2)
        if total_words else 0
    )

    customer_talk_percentage = (
        round((customer_words / total_words) * 100, 2)
        if total_words else 0
    )

    # Identify salesperson questions
    question_pattern = re.compile(
        r"\b(what|why|how|when|where|which|who|"
        r"can|could|would|do|does|did|is|are|"
        r"will|have|has)\b",
        re.IGNORECASE
    )

    sales_questions = [
        text for text in sales_texts
        if "?" in text or question_pattern.search(text)
    ]

    # Find customer questions
    customer_questions = [
        item for item in customer_messages
        if "?" in item.get("text", "")
    ]

    # Approximate whether a salesperson responds
    # to the next customer question in the conversation.
    response_checks = 0
    responses_found = 0

    for index, message in enumerate(conversation):
        if message.get("role", "").upper() != "CUSTOMER":
            continue

        text = message.get("text", "").strip()

        if "?" not in text:
            continue

        response_checks += 1

        for next_message in conversation[index + 1:]:
            role = next_message.get("role", "").upper()

            if role == "CUSTOMER":
                break

            if role == "SALES REPRESENTATIVE":
                if next_message.get("text", "").strip():
                    responses_found += 1
                break

    response_rate = (
        round((responses_found / response_checks) * 100, 2)
        if response_checks else None
    )

    # Objection analysis summary
    objections = objection_data.get("objections", [])
    if not isinstance(objections, list):
        objections = []

    detected_objections = [
        item for item in objections
        if isinstance(item, dict)
        and item.get("objection", "").lower() not in [
            "no objection", "none"
        ]
    ]

    # If objection output uses a different schema,
    # transcript analysis will still work.
    objection_count = len(detected_objections)

    # Basic engagement metrics
    engagement_score = min(len(sales_questions) * 15, 100)

    # Calculate initial rule-based scores
    communication_score = 50

    if 35 <= sales_talk_percentage <= 70:
        communication_score += 25
    elif sales_talk_percentage > 85:
        communication_score -= 15
    elif sales_talk_percentage < 20:
        communication_score -= 10

    if len(sales_texts) >= 3:
        communication_score += 10

    communication_score = max(
        0, min(100, communication_score)
    )

    question_handling_score = (
        response_rate if response_rate is not None else 50
    )

    objection_handling_score = (
        50 if objection_count == 0 else 40
    )

    # Overall score is a prototype estimate,
    # not a validated measure of sales ability.
    overall_score = round(
        communication_score * 0.30
        + question_handling_score * 0.35
        + engagement_score * 0.20
        + objection_handling_score * 0.15
    )

    # Generate feedback
    strengths = []
    improvements = []

    if 35 <= sales_talk_percentage <= 70:
        strengths.append(
            "Conversation talk ratio is reasonably balanced."
        )
    elif sales_talk_percentage > 70:
        improvements.append(
            "Try to give the customer more opportunity to speak."
        )
    else:
        improvements.append(
            "Provide more relevant information and guide the conversation."
        )

    if sales_questions:
        strengths.append(
            f"Salesperson asked approximately {len(sales_questions)} questions."
        )
    else:
        improvements.append(
            "Ask relevant questions to understand customer requirements."
        )

    if response_rate is not None and response_rate >= 70:
        strengths.append(
            "Most detected customer questions received a salesperson response."
        )
    elif response_rate is not None:
        improvements.append(
            "Improve responses to customer questions and clarify their concerns."
        )
    else:
        improvements.append(
            "Ask and answer questions naturally to maintain engagement."
        )

    if objection_count:
        improvements.append(
            "Review detected objections and check whether each was addressed."
        )
    else:
        strengths.append(
            "No objections were detected by the current objection analysis."
        )

    if overall_score >= 80:
        rating = "Good"
    elif overall_score >= 60:
        rating = "Average"
    else:
        rating = "Needs Improvement"

    result = {
        "performance_score": overall_score,
        "performance_rating": rating,
        "metrics": {
            "salesperson_message_count": len(salesperson_messages),
            "customer_message_count": len(customer_messages),
            "salesperson_word_count": sales_words,
            "customer_word_count": customer_words,
            "salesperson_talk_percentage": sales_talk_percentage,
            "customer_talk_percentage": customer_talk_percentage,
            "salesperson_questions_detected": len(sales_questions),
            "customer_questions_detected": len(customer_questions),
            "customer_question_response_rate": response_rate,
            "detected_objection_count": objection_count,
            "engagement_score": engagement_score
        },
        "strengths": strengths,
        "improvements": improvements,
        "method": "Initial rule-based prototype",
        "limitations": [
            "Short test conversations may produce unreliable scores.",
            "Question detection is based on text patterns.",
            "Objection handling requires deeper contextual analysis.",
            "This score is not yet validated against human sales evaluations."
        ]
    }

    save_json(result, OUTPUT_FILE)

    print("\n" + "=" * 60)
    print("SALESPERSON PERFORMANCE ANALYSIS")
    print("=" * 60)

    print(f"Performance Score: {overall_score}/100")
    print(f"Rating: {rating}")
    print(f"Salesperson Talk: {sales_talk_percentage}%")
    print(f"Customer Talk: {customer_talk_percentage}%")
    print(f"Salesperson Questions: {len(sales_questions)}")
    print(f"Customer Question Response Rate: {response_rate}")
    print(f"Detected Objections: {objection_count}")

    print("\nStrengths:")
    for item in strengths:
        print(f"- {item}")

    print("\nAreas for Improvement:")
    for item in improvements:
        print(f"- {item}")

    print(f"\nSaved successfully: {OUTPUT_FILE}")


if __name__ == "__main__":
    analyze_performance()