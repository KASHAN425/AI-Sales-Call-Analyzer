import json
import os
from datetime import datetime


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

TRANSCRIPT_FILE = "output/transcript.json"
SENTIMENT_FILE = "output/analysis.json"
INTENT_FILE = "output/intent_analysis.json"
OBJECTION_FILE = "output/objection_analysis.json"
PERFORMANCE_FILE = "output/performance_analysis.json"

OUTPUT_FILE = "output/final_report.json"


# --------------------------------------------------
# LOAD JSON
# --------------------------------------------------

def load_json(file_path):

    if not os.path.exists(file_path):
        print(f"WARNING: File not found -> {file_path}")
        return {}

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def generate_report():

    print("\nLoading analysis files...")

    transcript = load_json(TRANSCRIPT_FILE)
    sentiment = load_json(SENTIMENT_FILE)
    intent = load_json(INTENT_FILE)
    objections = load_json(OBJECTION_FILE)
    performance = load_json(PERFORMANCE_FILE)


    conversation = transcript.get("conversation", [])


    # --------------------------------------------------
    # BASIC CALL INFORMATION
    # --------------------------------------------------

    audio_file = transcript.get(
        "audio_file",
        "unknown"
    )

    language = transcript.get(
        "language",
        "unknown"
    )


    # --------------------------------------------------
    # CUSTOMER MESSAGES
    # --------------------------------------------------

    customer_messages = [
        item for item in conversation
        if item.get("role", "").upper() == "CUSTOMER"
    ]


    salesperson_messages = [
        item for item in conversation
        if item.get("role", "").upper()
        == "SALES REPRESENTATIVE"
    ]


    # --------------------------------------------------
    # CUSTOMER SENTIMENT
    # --------------------------------------------------

    sentiment_results = sentiment.get(
        "sentiment_analysis",
        sentiment.get("results", [])
    )


    # --------------------------------------------------
    # INTENT
    # --------------------------------------------------

    intent_results = intent.get(
        "intent_analysis",
        intent.get("results", [])
    )


    # --------------------------------------------------
    # OBJECTIONS
    # --------------------------------------------------

    objection_results = objections.get(
        "objections",
        []
    )

    question_results = objections.get(
        "questions",
        []
    )


    # --------------------------------------------------
    # PERFORMANCE
    # --------------------------------------------------

    performance_score = performance.get(
        "performance_score",
        0
    )

    performance_rating = performance.get(
        "performance_rating",
        "Unknown"
    )

    performance_metrics = performance.get(
        "metrics",
        {}
    )

    strengths = performance.get(
        "strengths",
        []
    )

    improvements = performance.get(
        "improvements",
        []
    )


    # --------------------------------------------------
    # BUILD FINAL REPORT
    # --------------------------------------------------

    final_report = {

        "report_generated_at":
            datetime.now().isoformat(),

        "call_information": {

            "audio_file":
                audio_file,

            "language":
                language,

            "total_messages":
                len(conversation),

            "salesperson_messages":
                len(salesperson_messages),

            "customer_messages":
                len(customer_messages)
        },


        "conversation": conversation,


        "customer_analysis": {

            "sentiment":
                sentiment_results,

            "intent":
                intent_results,

            "objections":
                objection_results,

            "questions":
                question_results
        },


        "salesperson_analysis": {

            "performance_score":
                performance_score,

            "performance_rating":
                performance_rating,

            "metrics":
                performance_metrics,

            "strengths":
                strengths,

            "improvements":
                improvements
        },


        "summary": {

            "customer_sentiment":
                sentiment_results,

            "customer_intent":
                intent_results,

            "objection_count":
                len(objection_results)
                if isinstance(objection_results, list)
                else 0,

            "question_count":
                len(question_results)
                if isinstance(question_results, list)
                else 0,

            "salesperson_score":
                performance_score,

            "salesperson_rating":
                performance_rating
        }
    }


    # --------------------------------------------------
    # SAVE REPORT
    # --------------------------------------------------

    os.makedirs("output", exist_ok=True)

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            final_report,
            file,
            indent=4,
            ensure_ascii=False
        )


    # --------------------------------------------------
    # DISPLAY RESULT
    # --------------------------------------------------

    print("\n" + "=" * 70)
    print("FINAL CALL ANALYSIS REPORT")
    print("=" * 70)

    print(
        f"Audio File: {audio_file}"
    )

    print(
        f"Language: {language}"
    )

    print(
        f"Total Messages: {len(conversation)}"
    )

    print(
        f"Customer Messages: {len(customer_messages)}"
    )

    print(
        f"Salesperson Messages: {len(salesperson_messages)}"
    )

    print(
        f"Salesperson Score: {performance_score}/100"
    )

    print(
        f"Performance Rating: {performance_rating}"
    )

    print(
        f"Objections: "
        f"{len(objection_results) if isinstance(objection_results, list) else 0}"
    )

    print(
        f"Questions: "
        f"{len(question_results) if isinstance(question_results, list) else 0}"
    )

    print("\nFinal report saved successfully!")

    print(
        f"File: {OUTPUT_FILE}"
    )

    print("=" * 70)


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":
    generate_report()