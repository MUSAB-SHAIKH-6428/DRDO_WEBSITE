import os
import tempfile

import sounddevice as sd
from scipy.io.wavfile import write
from dotenv import load_dotenv
from groq import Groq


load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in .env")


client = Groq(api_key=GROQ_API_KEY)

SAMPLE_RATE = 16000
CHANNELS = 1


def record_and_transcribe():

    input("\nPress ENTER to start recording...")

    print("Recording... Speak now.")

    audio = sd.rec(
        int(60 * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16"
    )

    sd.wait()

    print("Recording finished.")

    with tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    ) as temp_file:

        audio_path = temp_file.name

    write(
        audio_path,
        SAMPLE_RATE,
        audio
    )

    try:

        with open(audio_path, "rb") as audio_file:

            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                response_format="text"
            )

        return transcription

    finally:

        if os.path.exists(audio_path):
            os.remove(audio_path)