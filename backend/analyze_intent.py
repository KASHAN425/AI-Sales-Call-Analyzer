import json
from transformers import pipeline


# ==========================================
# 1. LOAD TRANSCRIPT
# ==========================================

input_file = "output/transcript.json"

with open(
    input_file,
    "r",
    encoding="utf-8"
) as file:

    data = json.load(file)


conversation = data["conversation"]


# ==========================================
# 2. LOAD ZERO-SHOT CLASSIFIER
# ==========================================

print("Loading intent analysis model...")

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

print("Intent model loaded!")


# ==========================================
# 3. INTENT CATEGORIES
# ==========================================

intent_labels = [

    "purchase interest",

    "asking for price",

    "asking for information",

    "asking about features",

    "asking about delivery",

    "complaint",

    "price objection",

    "product objection",

    "general question",

    "not interested",

    "positive feedback",

    "negative feedback"

]


# ==========================================
# 4. CUSTOMER NEED CATEGORIES
# ==========================================

need_labels = [

    "website development",

    "pricing information",

    "product information",

    "technical information",

    "delivery information",

    "customer support",

    "discount",

    "customization",

    "none"

]


# ==========================================
# 5. BUYING INTENT CATEGORIES
# ==========================================

buying_labels = [

    "high buying intent",

    "medium buying intent",

    "low buying intent",

    "no buying intent"

]


# ==========================================
# 6. ANALYZE CUSTOMER MESSAGES
# ==========================================

analysis_results = []


for item in conversation:

    if item["role"] != "CUSTOMER":
        continue


    text = item["text"]


    print("\n")
    print("=" * 70)
    print("Analyzing:")
    print(text)
    print("=" * 70)


    # --------------------------------------
    # INTENT
    # --------------------------------------

    intent_result = classifier(
        text,
        intent_labels
    )

    intent = intent_result["labels"][0]

    intent_confidence = intent_result["scores"][0]


    # --------------------------------------
    # CUSTOMER NEED
    # --------------------------------------

    need_result = classifier(
        text,
        need_labels
    )

    need = need_result["labels"][0]

    need_confidence = need_result["scores"][0]


    # --------------------------------------
    # BUYING INTENT
    # --------------------------------------

    buying_result = classifier(
        text,
        buying_labels
    )

    buying_intent = buying_result["labels"][0]

    buying_confidence = buying_result["scores"][0]


    # --------------------------------------
    # SAVE RESULT
    # --------------------------------------

    result = {

        "start": item["start"],

        "end": item["end"],

        "text": text,

        "intent": intent,

        "intent_confidence": round(
            intent_confidence,
            3
        ),

        "customer_need": need,

        "need_confidence": round(
            need_confidence,
            3
        ),

        "buying_intent": buying_intent,

        "buying_confidence": round(
            buying_confidence,
            3
        )

    }


    analysis_results.append(result)


    # --------------------------------------
    # DISPLAY
    # --------------------------------------

    print(
        f"Intent: {intent}"
    )

    print(
        f"Customer Need: {need}"
    )

    print(
        f"Buying Intent: {buying_intent}"
    )


# ==========================================
# 7. SAVE ANALYSIS
# ==========================================

output_data = {

    "conversation_analysis": analysis_results

}


output_file = "output/intent_analysis.json"


with open(
    output_file,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        output_data,
        file,
        indent=4,
        ensure_ascii=False
    )


# ==========================================
# 8. FINISHED
# ==========================================

print("\n")
print("=" * 70)

print("INTENT ANALYSIS COMPLETED!")

print("=" * 70)

print(
    f"Saved to: {output_file}"
)

print(
    f"Customer segments analyzed: "
    f"{len(analysis_results)}"
)

print("=" * 70)