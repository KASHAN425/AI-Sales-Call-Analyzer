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
# 2. LOAD SENTIMENT MODEL
# ==========================================

print("Loading sentiment model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

print("Sentiment model loaded!")


# ==========================================
# 3. ANALYZE CUSTOMER MESSAGES
# ==========================================

customer_messages = []

for item in conversation:

    if item["role"] == "CUSTOMER":

        customer_messages.append(
            item["text"]
        )


# ==========================================
# 4. SENTIMENT ANALYSIS
# ==========================================

sentiment_results = []

for text in customer_messages:

    result = sentiment_model(text)[0]

    sentiment_results.append({

        "text": text,

        "sentiment": result["label"],

        "confidence": round(
            result["score"],
            3
        )

    })


# ==========================================
# 5. PRINT RESULTS
# ==========================================

print("\n")
print("=" * 70)
print("CUSTOMER SENTIMENT ANALYSIS")
print("=" * 70)

for result in sentiment_results:

    print(
        f"\nText: {result['text']}"
    )

    print(
        f"Sentiment: {result['sentiment']}"
    )

    print(
        f"Confidence: {result['confidence']}"
    )

print("=" * 70)


# ==========================================
# 6. SAVE ANALYSIS
# ==========================================

analysis = {

    "sentiment": sentiment_results

}


output_file = "output/analysis.json"


with open(
    output_file,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        analysis,
        file,
        indent=4,
        ensure_ascii=False
    )


print(
    f"\nAnalysis saved to: {output_file}"
)