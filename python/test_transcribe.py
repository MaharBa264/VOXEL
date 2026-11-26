"""Worker contract tests, including one real local-model CLI run."""
from array import array
from hashlib import sha256
import importlib.util
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / 'python' / 'transcribe.py'


def percussion_wav(path, hits=(0.1, 0.3, 0.5, 0.7), rate=22050):
    samples = [0] * rate
    length = int(0.02 * rate)
    for hit in hits:
        start = int(hit * rate)
        for index in range(length):
            envelope = 1 - index / length
            value = math.sin(2 * math.pi * 80 * index / rate) * 12000 * envelope
            samples[start + index] = int(value)
    wav(path, samples, rate=rate)


def wav(path, samples=None, channels=1, width=2, rate=22050):
    samples = samples if samples is not None else [0] * rate
    with wave.open(str(path), 'wb') as f:
        f.setparams((channels, width, rate, 0, 'NONE', 'not compressed'))
        f.writeframes(array('h', samples).tobytes())


class WorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert WORKER.exists(), 'transcription CLI must exist'
        spec = importlib.util.spec_from_file_location('voxel_transcribe', WORKER)
        cls.worker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.worker)

    def test_rounding_clipping_invalid_events_and_velocity(self):
        events = [(0.0005208333333333333, 0.0109375, 69, 0.5, None),
                  (-1, 0.5, 60, 2, None), (0.9, 4, 61, -1, None),
                  (1, 2, 62, 1, None), (0.5, 0.5, 63, 1, None),
                  (float('nan'), 1, 64, 1, None), (0, 1, 128, 1, None),
                  (0, 1, 65, float('inf'), None), (0.5, -1, 66, 1, None)]
        notes = self.worker.convert_events(events, 120, 480, 1)
        self.assertEqual([(n['pitch'], n['startTick'], n['durationTicks'], n['velocity']) for n in notes],
                         [(69, 1, 10, 64), (60, 0, 480, 127), (61, 864, 96, 1)])
        self.assertEqual(len({n['id'] for n in notes}), 3)

    def test_silence_skips_model_and_preserves_original(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            wav(source, [1] * 22050)
            before = sha256(source.read_bytes()).digest()
            with patch.object(self.worker, 'infer_events', side_effect=AssertionError('model loaded')):
                result = self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480)
            self.assertEqual(result, {'protocolVersion': 1, 'notes': [], 'silence': True})
            self.assertEqual(json.loads((p / 'out.json').read_text()), result)
            self.assertEqual(sha256(source.read_bytes()).digest(), before)
            self.assertEqual((p / 'out.mid').read_bytes()[:4], b'MThd')

    def test_host_maximum_sample_rate_is_supported(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            wav(source, [0] * 3840, rate=384000)
            result = self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480)
            self.assertTrue(result['silence'])
            self.assertEqual(result['notes'], [])

    def test_rejects_invalid_wav_arguments_and_aliases_before_writes(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'; wav(source)
            before = source.read_bytes()
            for tempo, ppq in [(float('nan'), 480), (39, 480), (241, 480), (120, 0), (120, 32768)]:
                with self.subTest(tempo=tempo, ppq=ppq), self.assertRaises(ValueError):
                    self.worker.transcribe(source, p / 'out.json', p / 'out.mid', tempo, ppq)
            for output, midi in [(source, p / 'out.mid'), (p / 'out.json', source), (p / 'same', p / 'same')]:
                with self.assertRaises(ValueError):
                    self.worker.transcribe(source, output, midi, 120, 480)
            for channels, width, rate, count in [(2, 2, 22050, 22050), (1, 1, 22050, 22050), (1, 2, 22050, 0), (1, 2, 1, 31)]:
                bad = p / 'bad.wav'; wav(bad, [0] * count, channels, width, rate)
                with self.assertRaises(ValueError):
                    self.worker.transcribe(bad, p / 'out.json', p / 'out.mid', 120, 480)
            self.assertEqual(source.read_bytes(), before)
            self.assertFalse((p / 'out.json').exists())

    def test_actual_cli_a4_matches_midi_ticks_and_keeps_source(self):
        source = ROOT / '.cache/basic-pitch-smoke/a4.wav'
        self.assertTrue(source.exists(), 'Run test_runtime.py to create the real A4 fixture')
        before = sha256(source.read_bytes()).digest()
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder)
            run = subprocess.run([sys.executable, '-I', str(WORKER), '--input', str(source), '--output', str(p / 'result.json'), '--midi', str(p / 'melody.mid'), '--tempo', '120', '--ppq', '480'], capture_output=True, text=True, timeout=180)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(run.stdout, '')
            result = json.loads((p / 'result.json').read_text())
            self.assertEqual(result['protocolVersion'], 1)
            self.assertFalse(result['silence'])
            self.assertIn(69, [n['pitch'] for n in result['notes']])
            import mido
            midi = mido.MidiFile(p / 'melody.mid')
            self.assertEqual(midi.ticks_per_beat, 480)
            self.assertEqual(next(msg.tempo for track in midi.tracks for msg in track if msg.type == 'set_tempo'), 500000)
            actual = []; active = {}; tick = 0
            for msg in midi.tracks[0]:
                tick += msg.time
                if msg.type == 'note_on' and msg.velocity:
                    active.setdefault(msg.note, []).append((tick, msg.velocity))
                elif msg.type == 'note_off':
                    start, velocity = active[msg.note].pop(0)
                    actual.append((msg.note, start, tick-start, velocity))
            expected = [(n['pitch'], n['startTick'], n['durationTicks'], n['velocity']) for n in result['notes']]
            self.assertCountEqual(actual, expected)
        self.assertEqual(sha256(source.read_bytes()).digest(), before)


    def test_monophonic_filter_drops_octave_harmonics_and_keeps_melody_notes(self):
        events = [(0.0, 1.0, 61, 1), (0.0, 0.6, 73, 1), (0.5, 0.9, 64, 1)]
        notes = self.worker.convert_events(events, 120, 480, 1)
        filtered = self.worker.select_monophonic(notes)
        self.assertEqual([note['pitch'] for note in filtered], [61, 64])

    def test_monophonic_filter_keeps_sustained_notes_without_harmonic_relation(self):
        notes = [
            {'id': 'a', 'pitch': 60, 'velocity': 90, 'startTick': 0, 'durationTicks': 960},
            {'id': 'b', 'pitch': 64, 'velocity': 80, 'startTick': 960, 'durationTicks': 480},
        ]
        self.assertEqual([note['pitch'] for note in self.worker.select_monophonic(notes)], [60, 64])

    def test_monophonic_flag_rejects_silence_before_model_load(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            wav(source, [1] * 22050)
            result = self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480, monophonic=True)
            self.assertEqual(result, {'protocolVersion': 1, 'notes': [], 'silence': True})


    def test_rejects_unsupported_input_kind(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            wav(source, [1] * 22050)
            with self.assertRaises(ValueError):
                self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480, input_kind='whistle')

    def test_percussion_detector_finds_regular_low_hits(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            percussion_wav(source)
            events = self.worker.infer_percussion_events(source)
            self.assertGreaterEqual(len(events), 3)
            self.assertTrue(all(pitch == 36 for _, _, pitch, _ in events))
            starts = [start for start, _, _, _ in events]
            self.assertTrue(all(0 <= start <= 1.0 for start in starts))
            self.assertEqual(starts, sorted(starts))

    def test_percussion_flag_skips_model_and_writes_drum_channel(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            percussion_wav(source, hits=(0.1, 0.4), rate=22050)
            with patch.object(self.worker, 'infer_events', side_effect=AssertionError('model loaded')):
                result = self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480, input_kind='percussion')
            self.assertFalse(result['silence'])
            self.assertGreaterEqual(len(result['notes']), 1)
            self.assertTrue(all(note['pitch'] in (36, 38, 42) for note in result['notes']))
            self.assertIn(0x99, (p / 'out.mid').read_bytes())

    def test_time_signature_is_written_to_midi_and_validated(self):
        self.assertEqual(self.worker.parse_time_signature('6/8'), (6, 8))
        for invalid in ['', '3', '4/3', '0/4', '256/4', '3/4/5']:
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                self.worker.parse_time_signature(invalid)
        midi = self.worker.midi_bytes([], 120, 480, (3, 4))
        self.assertIn(bytes((0, 255, 88, 4, 3, 2, 24, 8)), midi)
        self.assertEqual(self.worker.midi_bytes([], 120, 480), self.worker.midi_bytes([], 120, 480, (4, 4)))

    def test_worker_honors_requested_time_signature(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as folder:
            p = Path(folder); source = p / 'in.wav'
            wav(source, [1] * 22050)
            self.worker.transcribe(source, p / 'out.json', p / 'out.mid', 120, 480, time_signature='6/8')
            self.assertIn(bytes((0, 255, 88, 4, 6, 3, 24, 8)), (p / 'out.mid').read_bytes())


if __name__ == '__main__':
    unittest.main(verbosity=2)


