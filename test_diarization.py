import os

# Add FFmpeg DLL folder to Windows DLL search path
os.add_dll_directory(
    r"C:\ffmpeg\ffmpeg-9.0.2-full_build-shared\bin"
)

import torch
import torchaudio
from pyannote.audio import Pipeline


# --------------------------------------------------
# 1. Load audio
# --------------------------------------------------

audio_file = "audio_test4.wav"

print("Loading audio...")

waveform, sample_rate = torchaudio.load(audio_file)

print(f"Audio loaded successfully!")
print(f"Waveform shape: {waveform.shape}")
print(f"Sample rate: {sample_rate}")


# --------------------------------------------------
# 2. Load PyAnnote diarization model
# --------------------------------------------------

print("\nLoading speaker diarization model...")

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1"
)

print("Diarization model loaded successfully!")


# --------------------------------------------------
# 3. Run speaker diarization
# --------------------------------------------------

print("\nRunning speaker diarization...")
output = pipeline(
    {
        "waveform": waveform,
        "sample_rate": sample_rate
    },
    num_speakers=2
)

# --------------------------------------------------
# 4. Display detected speakers
# --------------------------------------------------

print("\nSpeaker segments:")
print("-" * 50)

diarization = output.speaker_diarization

for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(
        f"{turn.start:.2f}s - "
        f"{turn.end:.2f}s : "
        f"{speaker}"
    )

print("-" * 50)
print("Diarization completed!")