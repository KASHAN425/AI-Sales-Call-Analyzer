import os
import json

# ==========================================
# FFmpeg DLL PATH
# ==========================================

os.add_dll_directory(
    r"C:\ffmpeg\ffmpeg-9.0.2-full_build-shared\bin"
)


# ==========================================
# IMPORTS
# ==========================================

import whisper
import torchaudio
from pyannote.audio import Pipeline


# ==========================================
# 1. AUDIO FILE
# ==========================================

audio_file = "audio_test4.wav"

output_file = "output/transcript.json"


# ==========================================
# 2. CREATE OUTPUT FOLDER
# ==========================================

os.makedirs("output", exist_ok=True)


# ==========================================
# 3. LOAD WHISPER
# ==========================================

print("Loading Whisper model...")

whisper_model = whisper.load_model("base")

print("Whisper model loaded!")


# ==========================================
# 4. WHISPER TRANSCRIPTION
# ==========================================

print("\nRunning Whisper transcription...")

whisper_result = whisper_model.transcribe(
    audio_file
)

print("Whisper transcription completed!")


# ==========================================
# 5. LOAD AUDIO
# ==========================================

print("\nLoading audio...")

waveform, sample_rate = torchaudio.load(
    audio_file
)

print(f"Sample rate: {sample_rate}")


# ==========================================
# 6. LOAD PYANNOTE
# ==========================================

print("\nLoading speaker diarization model...")

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1"
)

print("Diarization model loaded!")


# ==========================================
# 7. SPEAKER DIARIZATION
# ==========================================

print("\nRunning speaker diarization...")

output = pipeline(
    {
        "waveform": waveform,
        "sample_rate": sample_rate
    },
    num_speakers=2
)

diarization = output.speaker_diarization

print("Diarization completed!")


# ==========================================
# 8. FIND SPEAKER
# ==========================================

def get_speaker(start, end):

    best_speaker = "UNKNOWN"
    best_overlap = 0

    for turn, _, speaker in diarization.itertracks(
        yield_label=True
    ):

        overlap_start = max(
            start,
            turn.start
        )

        overlap_end = min(
            end,
            turn.end
        )

        overlap = max(
            0,
            overlap_end - overlap_start
        )

        if overlap > best_overlap:

            best_overlap = overlap
            best_speaker = speaker

    return best_speaker


# ==========================================
# 9. SPEAKER ROLE MAPPING
# ==========================================

speaker_roles = {
    "SPEAKER_00": "SALES REPRESENTATIVE",
    "SPEAKER_01": "CUSTOMER"
}


def get_role(speaker):

    return speaker_roles.get(
        speaker,
        speaker
    )


# ==========================================
# 10. CREATE STRUCTURED TRANSCRIPT
# ==========================================

conversation = []


for segment in whisper_result["segments"]:

    start = segment["start"]
    end = segment["end"]

    text = segment["text"].strip()

    if not text:
        continue

    speaker = get_speaker(
        start,
        end
    )

    role = get_role(
        speaker
    )

    conversation.append({

        "start": round(start, 2),

        "end": round(end, 2),

        "speaker_id": speaker,

        "role": role,

        "text": text

    })


# ==========================================
# 11. CREATE FINAL JSON
# ==========================================

transcript_data = {

    "audio_file": audio_file,

    "language": whisper_result.get(
        "language",
        "unknown"
    ),

    "conversation": conversation

}


# ==========================================
# 12. SAVE JSON
# ==========================================

with open(
    output_file,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        transcript_data,
        file,
        indent=4,
        ensure_ascii=False
    )


# ==========================================
# 13. PRINT RESULT
# ==========================================

print("\n")
print("=" * 70)

print("TRANSCRIPT SAVED SUCCESSFULLY!")

print("=" * 70)

print(f"File: {output_file}")

print(f"Total segments: {len(conversation)}")

print("=" * 70)


# ==========================================
# 14. SHOW CONVERSATION
# ==========================================

for item in conversation:

    print(
        f"[{item['start']:.2f}s - "
        f"{item['end']:.2f}s] "
        f"{item['role']}: "
        f"{item['text']}"
    )

print("=" * 70)