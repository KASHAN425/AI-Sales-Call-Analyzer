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
# 2. LOAD ZERO-SHOT MODEL
# ==========================================

print("Loading objection analysis model...")

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

print("Model loaded!")


# ==========================================
# 3. OBJECTION CATEGORIES
# ==========================================

objection_labels = [

    "price objection",

    "product objection",

    "quality objection",

    "delivery objection",

    "trust objection",

    "timing objection",

    "competitor objection",

    "feature objection",

    "no objection"

]


# ==========================================
# 4. QUESTION CATEGORIES
# ==========================================

question_labels = [

    "pricing question",

    "product information question",

    "feature question",

    "delivery question",

    "availability question",

    "technical question",

    "support question",

    "general question",

    "not a question"

]


# ==========================================
# 5. ANALYSIS
# ==========================================

results = []


for item in conversation:

    if item["role"] != "CUSTOMER":
        continue


    text = item["text"]

    print("\n")
    print("=" * 70)
    print("Analyzing:")
    print(text)
    print("=" * 70)


    # ======================================
    # OBJECTION DETECTION
    # ======================================

    objection_result = classifier(
        text,
        objection_labels
    )

    objection = objection_result["labels"][0]

    objection_confidence = objection_result["scores"][0]


    # ======================================
    # QUESTION DETECTION
    # ======================================

    question_result = classifier(
        text,
        question_labels
    )

    question = question_result["labels"][0]

    question_confidence = question_result["scores"][0]


    # ======================================
    # SAVE RESULT
    # ======================================

    result = {

        "start": item["start"],

        "end": item["end"],

        "text": text,

        "objection": objection,

        "objection_confidence": round(
            objection_confidence,
            3
        ),

        "question_type": question,

        "question_confidence": round(
            question_confidence,
            3
        )

    }


    results.append(result)


    # ======================================
    # DISPLAY
    # ======================================

    print(
        f"Objection: {objection}"
    )

    print(
        f"Objection Confidence: "
        f"{round(objection_confidence, 3)}"
    )

    print(
        f"Question Type: {question}"
    )

    print(
        f"Question Confidence: "
        f"{round(question_confidence, 3)}"
    )


# ==========================================
# 6. SAVE JSON
# ==========================================

output_data = {

    "objection_question_analysis": results

}


output_file = "output/objection_analysis.json"


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
# 7. COMPLETE
# ==========================================

print("\n")
print("=" * 70)

print("OBJECTION + QUESTION ANALYSIS COMPLETED!")

print("=" * 70)

print(
    f"Saved to: {output_file}"
)

print(
    f"Customer segments analyzed: "
    f"{len(results)}"
)

print("=" * 70)