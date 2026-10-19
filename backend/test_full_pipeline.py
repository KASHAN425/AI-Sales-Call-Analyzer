import os

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
import torch
import torchaudio
from pyannote.audio import Pipeline


# ==========================================
# 1. AUDIO FILE
# ==========================================

audio_file = "audio_test4.wav"


# ==========================================
# 2. LOAD WHISPER
# ==========================================

print("Loading Whisper model...")

whisper_model = whisper.load_model("base")

print("Whisper model loaded!")


# ==========================================
# 3. WHISPER TRANSCRIPTION
# ==========================================

print("\nRunning Whisper transcription...")

whisper_result = whisper_model.transcribe(
    audio_file
)

print("Whisper transcription completed!")


# ==========================================
# 4. LOAD AUDIO FOR PYANNOTE
# ==========================================

print("\nLoading audio...")

waveform, sample_rate = torchaudio.load(audio_file)

print(f"Audio loaded successfully!")
print(f"Waveform shape: {waveform.shape}")
print(f"Sample rate: {sample_rate}")


# ==========================================
# 5. LOAD PYANNOTE
# ==========================================

print("\nLoading speaker diarization model...")

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1"
)

print("Diarization model loaded successfully!")


# ==========================================
# 6. SPEAKER DIARIZATION
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
# 7. FIND SPEAKER FOR EACH WHISPER SEGMENT
# ==========================================

def get_speaker(start, end):

    best_speaker = "UNKNOWN"
    best_overlap = 0

    for turn, _, speaker in diarization.itertracks(
        yield_label=True
    ):

        overlap_start = max(start, turn.start)
        overlap_end = min(end, turn.end)

        overlap = max(
            0,
            overlap_end - overlap_start
        )

        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = speaker

    return best_speaker


# ==========================================
# 8. SPEAKER ROLE MAPPING
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
# 9. COMBINE WHISPER + PYANNOTE
# ==========================================

print("\n")
print("=" * 75)
print("SPEAKER-LABELED TRANSCRIPT")
print("=" * 75)


for segment in whisper_result["segments"]:

    start = segment["start"]
    end = segment["end"]

    text = segment["text"].strip()

    speaker = get_speaker(
        start,
        end
    )

    role = get_role(
        speaker
    )

    print(
        f"[{start:.2f}s - {end:.2f}s] "
        f"{role}: {text}"
    )


print("=" * 75)
print("FULL PIPELINE COMPLETED!")
print("=" * 75)