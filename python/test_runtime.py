"""Integration smoke: actual local Basic Pitch model, not a voice-quality test."""

from array import array
from contextlib import ExitStack
from hashlib import sha256
from importlib.metadata import version
import json
import math
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import wave

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".cache" / "basic-pitch-smoke"
for variable, relative in {
    "NUMBA_CACHE_DIR": ".cache/numba",
    "MPLCONFIGDIR": ".cache/matplotlib",
    "KERAS_HOME": ".cache/keras",
    "TEMP": ".cache/tmp",
    "TMP": ".cache/tmp",
}.items():
    location = ROOT / relative
    location.mkdir(parents=True, exist_ok=True)
    os.environ[variable] = str(location)
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"


class RuntimeSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if sys.version_info[:2] != (3, 11):
            raise RuntimeError("Use the project-local Python 3.11 environment")
        cls.network_attempts = 0

        def deny_network(*args, **kwargs):
            cls.network_attempts += 1
            raise AssertionError("Network access is forbidden during this smoke test")

        stack = ExitStack()
        cls.addClassCleanup(stack.close)
        for target in ("socket.socket.connect", "socket.socket.connect_ex",
                       "socket.create_connection", "socket.getaddrinfo"):
            stack.enter_context(patch(target, new=deny_network))

        import basic_pitch
        from basic_pitch.inference import Model, predict
        import numpy
        import pretty_midi

        cls.numpy = numpy
        cls.pretty_midi = pretty_midi
        cls.predict = staticmethod(predict)
        cls.model_path = basic_pitch.ICASSP_2022_MODEL_PATH.resolve()
        if not cls.model_path.is_relative_to(Path(sys.prefix).resolve()):
            raise RuntimeError("Model must be inside the local virtual environment")
        cls.model = Model(cls.model_path)
        if cls.model.model_type != Model.MODEL_TYPES.TENSORFLOW:
            raise RuntimeError("This environment must validate the TensorFlow CPU backend")
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.report = {
            "python": sys.version.split()[0],
            "versions": {name: version(name) for name in
                         ("basic-pitch", "tensorflow", "numpy", "librosa", "pretty-midi")},
            "model_files_sha256": {
                str(p.relative_to(cls.model_path)): sha256(p.read_bytes()).hexdigest()
                for p in cls.model_path.rglob("*") if p.is_file()
            },
            "cases": {},
            "network_guard": "Python socket functions only; not an OS firewall",
        }

    def infer(self, label, audible):
        audio_path = ARTIFACTS / f"{label}.wav"
        sample_rate = 22050
        pcm = array("h")
        for index in range(int(sample_rate * 2.5)):
            t = index / sample_rate
            amplitude = 0.0
            if audible and 0.25 <= t < 2.25:
                envelope = min(1.0, (t - 0.25) / 0.02, (2.25 - t) / 0.02)
                amplitude = envelope * sum(weight * math.sin(2 * math.pi * 440 * harmonic * t)
                                           for harmonic, weight in ((1, 0.45), (2, 0.18), (3, 0.08)))
            pcm.append(round(32767 * amplitude))
        if sys.byteorder != "little":
            pcm.byteswap()
        with wave.open(str(audio_path), "wb") as output:
            output.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
            output.writeframes(pcm.tobytes())
        original_hash = sha256(audio_path.read_bytes()).hexdigest()
        tensors, midi, events = self.predict(audio_path, model_or_model_path=self.model)
        self.assertEqual(sha256(audio_path.read_bytes()).hexdigest(), original_hash)
        self.assertEqual(set(tensors), {"note", "onset", "contour"})
        for tensor in tensors.values():
            self.assertGreater(tensor.size, 0)
            self.assertTrue(self.numpy.isfinite(tensor).all())
        midi_path = ARTIFACTS / f"{label}.mid"
        midi.write(str(midi_path))
        loaded = self.pretty_midi.PrettyMIDI(str(midi_path))
        notes = [note for instrument in loaded.instruments for note in instrument.notes]
        for note in notes:
            self.assertGreater(note.end, note.start)
            self.assertGreaterEqual(note.velocity, 1)
            self.assertLessEqual(note.velocity, 127)
        self.assertEqual(type(self).network_attempts, 0)
        type(self).report["cases"][label] = {
            "pitches": [note.pitch for note in notes],
            "source_sha256": original_hash,
            "note_events_count": len(events),
            "python_socket_attempts": type(self).network_attempts,
        }
        (ARTIFACTS / "report.json").write_text(
            json.dumps(type(self).report, indent=2) + "\n", encoding="utf8")
        return notes

    def test_synthetic_a4_produces_a4_in_a_readable_midi(self):
        notes = self.infer("a4", audible=True)
        self.assertIn(69, [note.pitch for note in notes])

    def test_silence_produces_no_notes(self):
        self.assertEqual(self.infer("silence", audible=False), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
