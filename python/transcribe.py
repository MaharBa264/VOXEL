"""Local transcription worker. Nearest tick/velocity ties round upward (half-up).

The source is read only. Model caches and temporary files stay inside .cache.
"""
import argparse
from array import array
from contextlib import redirect_stdout
import json
import math
import os
from pathlib import Path
import struct
import sys
import tempfile
import uuid
import wave

ROOT = Path(__file__).resolve().parents[1]


def configure_environment():
    for variable, directory in {'NUMBA_CACHE_DIR': 'numba', 'KERAS_HOME': 'keras',
                                'MPLCONFIGDIR': 'matplotlib', 'TEMP': 'tmp', 'TMP': 'tmp'}.items():
        path = ROOT / '.cache' / directory
        path.mkdir(parents=True, exist_ok=True)
        os.environ[variable] = str(path)
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
    tempfile.tempdir = str(ROOT / '.cache' / 'tmp')


def nearest(value):
    return math.floor(value + 0.5)


def convert_events(events, tempo, ppq, duration):
    """Clip in seconds first; discard empty/nonfinite intervals and half-up round."""
    ticks_per_second = tempo * ppq / 60
    last_tick = nearest(duration * ticks_per_second)
    notes = []
    for event in events:
        if len(event) < 4:
            continue
        start, end, pitch, amplitude = event[:4]
        try:
            if not all(math.isfinite(v) for v in (start, end, pitch, amplitude)):
                continue
            if pitch != int(pitch) or not 0 <= pitch <= 127:
                continue
            start, end = max(0, start), min(duration, end)
            if end <= start:
                continue
            start_tick = nearest(start * ticks_per_second)
            end_tick = min(last_tick, max(start_tick + 1, nearest(end * ticks_per_second)))
            if end_tick <= start_tick:
                continue
            notes.append({'id': str(uuid.uuid4()), 'pitch': int(pitch),
                          'velocity': min(127, max(1, nearest(amplitude * 127))),
                          'startTick': start_tick, 'durationTicks': end_tick - start_tick})
        except (TypeError, ValueError, OverflowError):
            continue
    return notes


def select_monophonic(notes):
    """Optional single-voice cleanup: drop notes one octave or more above a sustained lower note.

    Basic Pitch is polyphonic and reports harmonics as extra notes. For a single
    vocal line a note at least an octave above a note that sustains it is a
    candidate harmonic, not a melody event. The filter is opt-in: silence still
    reports an empty note list and untouched input.
    """
    kept = []
    for note in sorted(notes, key=lambda item: (item['startTick'], item['pitch'])):
        harmonic = False
        for other in kept:
            interval = note['pitch'] - other['pitch']
            sustained = other['startTick'] < note['startTick'] + note['durationTicks'] and other['startTick'] + other['durationTicks'] > note['startTick']
            if other['pitch'] < note['pitch'] and interval > 0 and interval % 12 == 0 and sustained:
                harmonic = True
                break
        if not harmonic:
            kept.append(note)
    return kept


def read_audio(path):
    try:
        with wave.open(str(path), 'rb') as audio:
            frames, rate = audio.getnframes(), audio.getframerate()
            if (audio.getnchannels() != 1 or audio.getsampwidth() != 2 or
                    audio.getcomptype() != 'NONE' or frames <= 0 or
                    not 1 <= rate <= 384000 or frames > rate * 30):
                raise ValueError('Input must be nonempty mono PCM16 WAV, at most 30 seconds')
            raw = audio.readframes(frames)
            if len(raw) != frames * 2:
                raise ValueError('Truncated WAV data')
    except (wave.Error, EOFError) as error:
        raise ValueError('Invalid WAV input') from error
    samples = array('h', raw)
    if sys.byteorder != 'little':
        samples.byteswap()
    # <=3 PCM16 units is below -80 dBFS: suppress numerical noise before normalization.
    silence = max(abs(value) for value in samples) <= 3
    return frames / rate, silence


def infer_events(path):
    # Lazy import is essential: silence does not load TensorFlow or normalize zero audio.
    with redirect_stdout(sys.stderr):
        import basic_pitch
        from basic_pitch.inference import Model, predict
        model_path = basic_pitch.ICASSP_2022_MODEL_PATH.resolve()
        if not model_path.is_relative_to(Path(sys.prefix).resolve()):
            raise ValueError('Basic Pitch model must be installed in the local environment')
        model = Model(model_path)
        _, _, events = predict(path, model_or_model_path=model)
    return events


def variable_length(value):
    data = [value & 127]
    value >>= 7
    while value:
        data.insert(0, (value & 127) | 128)
        value >>= 7
    return bytes(data)


def parse_time_signature(value):
    if not isinstance(value, str) or '/' not in value:
        raise ValueError('Time signature must be a string like "3/4"')
    numerator, _, denominator = value.partition('/')
    try:
        parsed_numerator, parsed_denominator = int(numerator), int(denominator)
    except ValueError as error:
        raise ValueError('Invalid time signature') from error
    valid = (1, 2, 4, 8, 16, 32, 64, 128)
    if parsed_numerator < 1 or parsed_numerator > 255 or parsed_denominator not in valid:
        raise ValueError('Invalid time signature')
    return parsed_numerator, parsed_denominator


def midi_bytes(notes, tempo, ppq, time_signature=(4, 4)):
    """Format 0, piano channel 0; events come exclusively from converted PPQ notes."""
    microseconds = nearest(60_000_000 / tempo)
    numerator, denominator = time_signature
    denominator_exponent = int(round(math.log2(denominator)))
    track = bytearray(b'\x00\xff\x51\x03' + microseconds.to_bytes(3, 'big') + bytes((0, 255, 88, 4, numerator, denominator_exponent, 24, 8)) + b'\x00\xc0\x00')
    events = []
    for note in notes:
        start = note['startTick']
        events.append((start, 1, note['pitch'], note['velocity']))
        events.append((start + note['durationTicks'], 0, note['pitch'], 0))
    previous = 0
    for tick, on, pitch, velocity in sorted(events):
        track.extend(variable_length(tick - previous))
        track.extend(bytes((0x90 if on else 0x80, pitch, velocity)))
        previous = tick
    track.extend(b'\x00\xff\x2f\x00')
    return b'MThd' + struct.pack('>IHHH', 6, 0, 1, ppq) + b'MTrk' + struct.pack('>I', len(track)) + track


def validate_paths(source, output, midi):
    paths = [Path(p).resolve() for p in (source, output, midi)]
    for i, first in enumerate(paths):
        for second in paths[i + 1:]:
            if first == second or (first.exists() and second.exists() and os.path.samefile(first, second)):
                raise ValueError('Input, JSON output and MIDI output must be distinct files')
    return paths


SUPPORTED_INPUT_KINDS = ('voice',)


def validate_input_kind(value):
    if value not in SUPPORTED_INPUT_KINDS:
        raise ValueError('Unsupported input kind; only "voice" is supported by the local engine')


def transcribe(source, output, midi, tempo, ppq, monophonic=False, input_kind='voice', time_signature=None):
    if not math.isfinite(tempo) or not 40 <= tempo <= 240:
        raise ValueError('Tempo must be finite and between 40 and 240 BPM')
    if isinstance(ppq, bool) or not isinstance(ppq, int) or not 1 <= ppq <= 32767:
        raise ValueError('PPQ must be an integer between 1 and 32767')
    validate_input_kind(input_kind)
    parsed_time_signature = parse_time_signature(time_signature or '4/4')
    source, output, midi = validate_paths(source, output, midi)
    configure_environment()
    duration, silence = read_audio(source)
    notes = [] if silence else convert_events(infer_events(source), tempo, ppq, duration)
    if monophonic:
        notes = select_monophonic(notes)
    result = {'protocolVersion': 1, 'notes': notes, 'silence': silence}
    payloads = [(midi, midi_bytes(notes, tempo, ppq, parsed_time_signature)),
                (output, (json.dumps(result, allow_nan=False) + '\n').encode('utf-8'))]
    staged = []
    try:
        # Prepare both complete files before publishing either. Each replacement is atomic.
        for destination, payload in payloads:
            with tempfile.NamedTemporaryFile(mode='wb', dir=destination.parent, prefix='.voxel-', delete=False) as stream:
                temporary = Path(stream.name)
                staged.append((temporary, destination))
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
        for temporary, destination in staged:
            os.replace(temporary, destination)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
    return result


def main():
    parser = argparse.ArgumentParser(description='VOXEL local Basic Pitch transcription')
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--midi', required=True, type=Path)
    parser.add_argument('--tempo', required=True, type=float)
    parser.add_argument('--ppq', required=True, type=int)
    parser.add_argument('--monophonic', action='store_true')
    parser.add_argument('--input-kind', default='voice')
    parser.add_argument('--time-signature', default='4/4')
    args = parser.parse_args()
    try:
        transcribe(args.input, args.output, args.midi, args.tempo, args.ppq, args.monophonic, args.input_kind, args.time_signature)
    except Exception as error:
        print(f'Transcription failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

