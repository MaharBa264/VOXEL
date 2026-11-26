use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex,
    },
    time::{Duration, Instant},
};
use uuid::Uuid;

type Result<T> = std::result::Result<T, String>;
const MAX_BYTES: usize = 16 * 1024 * 1024;
const MAX_SAFE_TICK: u64 = 9_007_199_254_740_991;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Note {
    id: String,
    pitch: u8,
    velocity: u8,
    start_tick: u64,
    duration_ticks: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AudioAsset {
    id: String,
    path: String,
    mime_type: String,
    sample_rate_hz: u32,
    channels: u8,
    duration_seconds: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Track {
    id: String,
    name: String,
    midi_channel: u8,
    program: u8,
    source_audio_id: String,
    notes: Vec<Note>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TimeSignature {
    numerator: u8,
    denominator: u8,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    schema_version: u8,
    id: String,
    name: String,
    ppq: u16,
    tempo_bpm: f64,
    time_signature: TimeSignature,
    audio_assets: Vec<AudioAsset>,
    tracks: Vec<Track>,
}
#[derive(Serialize)]
pub struct ProjectSummary {
    id: String,
    name: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginalAudio {
    bytes: Vec<u8>,
    mime_type: String,
}

fn err(error: impl std::fmt::Display) -> String {
    error.to_string()
}
fn uuid_id(id: &str) -> Result<()> {
    let parsed = Uuid::parse_str(id).map_err(|_| "Invalid project ID".to_string())?;
    if parsed.to_string() != id {
        return Err("Expected canonical project UUID".into());
    }
    Ok(())
}
fn original_name(mime: &str) -> Result<&'static str> {
    match mime {
        "audio/webm" => Ok("audio/original.webm"),
        "audio/wav" => Ok("audio/original.wav"),
        "audio/ogg" => Ok("audio/original.ogg"),
        _ => Err("Unsupported audio MIME type".into()),
    }
}
fn parse_time_signature(value: &str) -> Result<TimeSignature> {
    let (numerator, denominator) = value.split_once('/').ok_or("Invalid time signature")?;
    let numerator: u8 = numerator.parse().map_err(err)?;
    let denominator: u8 = denominator.parse().map_err(err)?;
    if numerator < 1 || ![1, 2, 4, 8, 16, 32, 64, 128].contains(&denominator) {
        return Err("Invalid time signature".into());
    }
    Ok(TimeSignature {
        numerator,
        denominator,
    })
}
fn format_time_signature(signature: &TimeSignature) -> String {
    format!("{}/{}", signature.numerator, signature.denominator)
}
fn validate_wav(bytes: &[u8], sample_rate: u32, duration: f64) -> Result<f64> {
    if bytes.len() < 44
        || bytes.len() > MAX_BYTES
        || &bytes[..4] != b"RIFF"
        || &bytes[8..12] != b"WAVE"
    {
        return Err("Expected RIFF WAV PCM16 mono".into());
    }
    let u32_at = |offset: usize| u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    if u32_at(4) as usize + 8 != bytes.len()
        || !(1..=384000).contains(&sample_rate)
        || !duration.is_finite()
        || duration <= 0.0
        || duration > 30.0
    {
        return Err("Invalid WAV size or metadata".into());
    }
    let mut offset = 12;
    let mut format = false;
    let mut samples = None;
    while offset + 8 <= bytes.len() {
        let length = u32_at(offset + 4) as usize;
        let start = offset + 8;
        let end = start.checked_add(length).ok_or("Invalid WAV chunk")?;
        if end > bytes.len() {
            return Err("Truncated WAV chunk".into());
        }
        match &bytes[offset..offset + 4] {
            b"fmt " => {
                if format || length != 16 {
                    return Err("Expected one PCM WAV format chunk".into());
                }
                let chunk = &bytes[start..end];
                if chunk[..4] != [1, 0, 1, 0]
                    || u32::from_le_bytes(chunk[4..8].try_into().unwrap()) != sample_rate
                    || u32::from_le_bytes(chunk[8..12].try_into().unwrap()) != sample_rate * 2
                    || chunk[12..16] != [2, 0, 16, 0]
                {
                    return Err("WAV must be PCM16 mono at declared sample rate".into());
                }
                format = true;
            }
            b"data" => {
                if samples.is_some() || length == 0 || length % 2 != 0 {
                    return Err("Invalid WAV data chunk".into());
                }
                samples = Some(length / 2);
            }
            _ => {}
        }
        offset = end + length % 2;
    }
    let actual = samples.ok_or("Missing WAV data")? as f64 / sample_rate as f64;
    if !format
        || offset != bytes.len()
        || actual > 30.0
        || (actual - duration).abs() > 1.0 / sample_rate as f64 + 1e-8
    {
        return Err("WAV duration does not match metadata".into());
    }
    Ok(actual)
}
fn valid_notes(notes: &[Note], duration: f64, tempo: f64) -> Result<()> {
    let mut ids = HashSet::new();
    let ticks_per_second = tempo * 480.0 / 60.0;
    let max_end = (duration * ticks_per_second).round().max(1.0) as u64;
    for note in notes {
        if note.id.is_empty()
            || note.id.len() > 128
            || !note
                .id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || !ids.insert(&note.id)
            || note.pitch > 127
            || !(1..=127).contains(&note.velocity)
            || note.duration_ticks == 0
            || note.start_tick > MAX_SAFE_TICK
            || note.duration_ticks > MAX_SAFE_TICK
            || note
                .start_tick
                .checked_add(note.duration_ticks)
                .is_none_or(|end| end > MAX_SAFE_TICK || end > max_end)
        {
            return Err("Invalid transcription note".into());
        }
    }
    Ok(())
}
fn validate_project(project: &Project, id: &str) -> Result<()> {
    uuid_id(id)?;
    if project.id != id
        || project.schema_version != 1
        || project.ppq != 480
        || !(40.0..=240.0).contains(&project.tempo_bpm)
        || !project.tempo_bpm.is_finite()
        || project.name.trim().is_empty()
        || project.name.chars().count() > 256
        || project.time_signature.numerator < 1
        || ![1, 2, 4, 8, 16, 32, 64, 128].contains(&project.time_signature.denominator)
        || project.audio_assets.len() != 1
        || project.tracks.is_empty()
        || project.tracks.len() > 4
    {
        return Err("Invalid owned project format".into());
    }
    let audio = &project.audio_assets[0];
    let track = &project.tracks[0];
    if audio.id != "original"
        || audio.path != original_name(&audio.mime_type)?
        || !(1..=32).contains(&audio.channels)
        || !(1..=384000).contains(&audio.sample_rate_hz)
        || !audio.duration_seconds.is_finite()
        || audio.duration_seconds <= 0.0
        || audio.duration_seconds > 32.0
        || track.id != "melody"
        || track.name != "Melodía"
        || track.midi_channel != 0
        || track.program != 0
        || track.source_audio_id != "original"
    {
        return Err("Invalid owned project assets or track".into());
    }
    let note_limit = (audio.duration_seconds + 1.0 / audio.sample_rate_hz as f64).min(30.0);
    valid_notes(&track.notes, note_limit, project.tempo_bpm)?;
    let mut track_ids = HashSet::new();
    track_ids.insert(track.id.as_str());
    for extra in project.tracks.iter().skip(1) {
        let (name, channel, program) = match extra.id.as_str() {
            "backtrack-chords" => ("Acordes", 1, 0),
            "backtrack-bass" => ("Bajo", 2, 32),
            "percussion" => ("Percusión", 9, 0),
            _ => return Err("Invalid backtrack track".into()),
        };
        if extra.name != name
            || extra.midi_channel != channel
            || extra.program != program
            || extra.source_audio_id != "original"
            || !track_ids.insert(extra.id.as_str())
        {
            return Err("Invalid backtrack track".into());
        }
        valid_notes(&extra.notes, note_limit, project.tempo_bpm)?;
    }
    Ok(())
}

// Reject reparse points at every component, including ancestors of the storage root.
fn no_links(path: &Path) -> Result<()> {
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component);
        if matches!(component, std::path::Component::Prefix(_)) {
            continue;
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if metadata.file_attributes() & 0x400 != 0 {
                        return Err("Storage path contains a reparse point".into());
                    }
                }
                if metadata.file_type().is_symlink() {
                    return Err("Storage path contains a link".into());
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(err(e)),
        }
    }
    Ok(())
}
#[derive(Clone)]
struct Store {
    root: PathBuf,
}
impl Store {
    fn new(root: PathBuf) -> Result<Self> {
        no_links(&root)?;
        fs::create_dir_all(&root).map_err(err)?;
        Ok(Self {
            root: fs::canonicalize(root).map_err(err)?,
        })
    }
    fn checked(&self, path: PathBuf) -> Result<PathBuf> {
        if !path.starts_with(&self.root) {
            return Err("Path escapes project storage".into());
        }
        no_links(&path)?;
        if path.exists()
            && !fs::canonicalize(&path)
                .map_err(err)?
                .starts_with(&self.root)
        {
            return Err("Path escapes project storage".into());
        }
        Ok(path)
    }
    fn project_dir(&self, id: &str) -> Result<PathBuf> {
        uuid_id(id)?;
        self.checked(self.root.join(id))
    }
    fn file(&self, id: &str, relative: &str) -> Result<PathBuf> {
        self.checked(self.project_dir(id)?.join(relative))
    }
    fn read(&self, id: &str, relative: &str, maximum: usize) -> Result<Vec<u8>> {
        let path = self.file(id, relative)?;
        if fs::metadata(&path).map_err(err)?.len() > maximum as u64 {
            return Err("Project file exceeds size limit".into());
        }
        let bytes = fs::read(path).map_err(err)?;
        if bytes.len() > maximum {
            return Err("Project file exceeds size limit".into());
        }
        Ok(bytes)
    }
    fn save_with_metadata(
        &self,
        original: &[u8],
        mime: &str,
        wav: &[u8],
        rate: u32,
        duration: f64,
        tempo: f64,
        channels: u8,
        analysis_duration: f64,
        time_signature: Option<String>,
    ) -> Result<Project> {
        let time_signature = match time_signature {
            Some(value) => parse_time_signature(&value)?,
            None => TimeSignature {
                numerator: 4,
                denominator: 4,
            },
        };
        let mime = mime
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        let path = original_name(&mime)?;
        if original.is_empty()
            || original.len() > MAX_BYTES
            || !tempo.is_finite()
            || !(40.0..=240.0).contains(&tempo)
        {
            return Err("Invalid recording size or tempo".into());
        }
        validate_wav(wav, rate, analysis_duration)?;
        if !(1..=32).contains(&channels)
            || !duration.is_finite()
            || duration <= 0.0
            || duration > 32.0
            || (analysis_duration - duration.min(30.0)).abs() > 1.0 / rate as f64 + 1e-8
        {
            return Err("Original and analysis metadata do not match".into());
        }
        let id = Uuid::new_v4().to_string();
        let project = Project {
            schema_version: 1,
            id: id.clone(),
            name: format!("Toma {}", &id[..8]),
            ppq: 480,
            tempo_bpm: tempo,
            time_signature,
            audio_assets: vec![AudioAsset {
                id: "original".into(),
                path: path.into(),
                mime_type: mime,
                sample_rate_hz: rate,
                channels,
                duration_seconds: duration,
            }],
            tracks: vec![Track {
                id: "melody".into(),
                name: "Melodía".into(),
                midi_channel: 0,
                program: 0,
                source_audio_id: "original".into(),
                notes: vec![],
            }],
        };
        fs::create_dir(self.project_dir(&id)?).map_err(err)?;
        fs::create_dir(self.file(&id, "audio")?).map_err(err)?;
        self.write_new(&id, path, original)?;
        self.write_new(&id, "audio/analysis.wav", wav)?;
        self.persist(&project)?;
        Ok(project)
    }
    #[cfg(test)]
    fn save(
        &self,
        original: &[u8],
        mime: &str,
        wav: &[u8],
        rate: u32,
        duration: f64,
        tempo: f64,
    ) -> Result<Project> {
        self.save_with_metadata(original, mime, wav, rate, duration, tempo, 1, duration, None)
    }
    fn write_new(&self, id: &str, path: &str, bytes: &[u8]) -> Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(self.file(id, path)?)
            .map_err(err)?;
        file.write_all(bytes).map_err(err)?;
        file.sync_all().map_err(err)
    }
    fn persist(&self, project: &Project) -> Result<()> {
        validate_project(project, &project.id)?;
        self.atomic(
            &project.id,
            "project.json",
            &serde_json::to_vec_pretty(project).map_err(err)?,
        )
    }
    fn commit_transcription(&self, project: &Project, midi: &[u8]) -> Result<()> {
        validate_project(project, &project.id)?;
        let midi_path = self.file(&project.id, "melody.mid")?;
        let previous = if midi_path.exists() {
            Some(self.read(&project.id, "melody.mid", 2 * 1024 * 1024)?)
        } else {
            None
        };
        self.atomic(&project.id, "melody.mid", midi)?;
        if let Err(failure) = self.persist(project) {
            let rollback = match previous {
                Some(bytes) => self.atomic(&project.id, "melody.mid", &bytes),
                None => fs::remove_file(self.file(&project.id, "melody.mid")?).map_err(err),
            };
            if let Err(rollback_error) = rollback {
                return Err(format!(
                    "Project commit failed: {failure}; MIDI rollback failed: {rollback_error}"
                ));
            }
            return Err(failure);
        }
        Ok(())
    }
    fn atomic(&self, id: &str, name: &str, bytes: &[u8]) -> Result<()> {
        let temporary = format!(".{}.tmp", Uuid::new_v4());
        self.write_new(id, &temporary, bytes)?;
        let source = self.file(id, &temporary)?;
        let target = self.file(id, name)?;
        let result = atomic_replace(&source, &target);
        if result.is_err() {
            let _ = fs::remove_file(source);
        }
        result
    }
    fn load(&self, id: &str) -> Result<Project> {
        let project: Project =
            serde_json::from_slice(&self.read(id, "project.json", 2 * 1024 * 1024)?)
                .map_err(err)?;
        validate_project(&project, id)?;
        self.file(id, &project.audio_assets[0].path)?;
        Ok(project)
    }
    fn original(&self, id: &str) -> Result<OriginalAudio> {
        let project = self.load(id)?;
        let asset = &project.audio_assets[0];
        Ok(OriginalAudio {
            bytes: self.read(id, &asset.path, MAX_BYTES)?,
            mime_type: asset.mime_type.clone(),
        })
    }
    fn list(&self) -> Result<Vec<ProjectSummary>> {
        no_links(&self.root)?;
        let mut projects = Vec::new();
        for entry in fs::read_dir(&self.root).map_err(err)? {
            let entry = entry.map_err(err)?;
            let id = entry.file_name().to_string_lossy().to_string();
            if uuid_id(&id).is_ok() {
                if let Ok(project) = self.load(&id) {
                    projects.push(ProjectSummary {
                        id,
                        name: project.name,
                    });
                }
            }
        }
        projects.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(projects)
    }
}
#[cfg(windows)]
fn atomic_replace(source: &Path, target: &Path) -> Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        return Err(err(std::io::Error::last_os_error()));
    }
    Ok(())
}
#[cfg(not(windows))]
fn atomic_replace(source: &Path, target: &Path) -> Result<()> {
    fs::rename(source, target).map_err(err)
}

#[derive(Default)]
struct JobFlags {
    busy: bool,
    closing: bool,
}
#[derive(Default)]
struct JobState {
    flags: Mutex<JobFlags>,
    changed: Condvar,
    cancel: AtomicBool,
}
struct JobLease(Arc<JobState>);
impl Drop for JobLease {
    fn drop(&mut self) {
        let mut flags = self.0.flags.lock().unwrap_or_else(|e| e.into_inner());
        flags.busy = false;
        self.0.changed.notify_all();
    }
}
impl JobState {
    fn begin(self: &Arc<Self>) -> Result<JobLease> {
        let mut flags = self.flags.lock().map_err(err)?;
        if flags.busy || flags.closing {
            return Err("A transcription is already running or the app is closing".into());
        }
        self.cancel.store(false, Ordering::SeqCst);
        flags.busy = true;
        Ok(JobLease(self.clone()))
    }
    fn shutdown(&self) {
        let mut flags = self.flags.lock().unwrap_or_else(|e| e.into_inner());
        flags.closing = true;
        self.cancel.store(true, Ordering::SeqCst);
        while flags.busy {
            flags = self.changed.wait(flags).unwrap_or_else(|e| e.into_inner());
        }
    }
}
struct ChildGuard(Child);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
#[derive(Clone)]
pub struct Host {
    store: Store,
    workspace: PathBuf,
    job: Arc<JobState>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkerResult {
    protocol_version: u8,
    notes: Vec<Note>,
    silence: bool,
}

#[cfg(debug_assertions)]
fn debug_storage_root(workspace: &Path, test_run_id: Option<&str>) -> Result<PathBuf> {
    match test_run_id {
        Some(id) => {
            uuid_id(id)?;
            Ok(workspace
                .join(".cache/desktop-test")
                .join(id)
                .join("projects"))
        }
        None => Ok(workspace.join("projects")),
    }
}

impl Host {
    pub fn development() -> Result<Self> {
        let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("Missing workspace")?
            .to_path_buf();
        #[cfg(debug_assertions)]
        let storage = {
            let test_run_id = match std::env::var("VOXEL_TEST_RUN_ID") {
                Ok(id) => Some(id),
                Err(std::env::VarError::NotPresent) => None,
                Err(error) => return Err(err(error)),
            };
            debug_storage_root(&workspace, test_run_id.as_deref())?
        };
        #[cfg(not(debug_assertions))]
        let storage = workspace.join("projects");
        Ok(Self {
            store: Store::new(storage)?,
            workspace,
            job: Arc::default(),
        })
    }
    pub fn shutdown(&self) {
        self.job.shutdown();
    }
    fn transcribe(&self, id: &str, _lease: JobLease, monophonic: bool, input_kind: &str) -> Result<Project> {
        let mut project = self.store.load(id)?;
        let wav = self.store.read(id, "audio/analysis.wav", MAX_BYTES)?;
        let asset = &project.audio_assets[0];
        let analysis_duration =
            validate_wav(&wav, asset.sample_rate_hz, asset.duration_seconds.min(30.0))?;
        if self.job.cancel.load(Ordering::SeqCst) {
            return Err("Transcription canceled".into());
        }
        let job_dir = format!("job-{}", Uuid::new_v4());
        fs::create_dir(self.store.file(id, &job_dir)?).map_err(err)?;
        let output = self.store.file(id, &format!("{job_dir}/result.json"))?;
        let midi = self.store.file(id, &format!("{job_dir}/melody.mid"))?;
        let log_path = self.store.file(id, &format!("{job_dir}/worker.log"))?;
        let log = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(log_path)
            .map_err(err)?;
        let temporary = self.workspace.join(".cache/tmp");
        no_links(&temporary)?;
        fs::create_dir_all(&temporary).map_err(err)?;
        let python = self.workspace.join(".venv/Scripts/python.exe");
        let worker = self.workspace.join("python/transcribe.py");
        no_links(&python)?;
        no_links(&worker)?;
        let mut command = Command::new(python);
        command
            .arg("-I")
            .arg(worker)
            .arg("--input")
            .arg(self.store.file(id, "audio/analysis.wav")?)
            .arg("--output")
            .arg(&output)
            .arg("--midi")
            .arg(&midi)
            .arg("--tempo")
            .arg(project.tempo_bpm.to_string())
            .arg("--ppq")
            .arg("480")
            .arg("--time-signature")
            .arg(format_time_signature(&project.time_signature));
        if monophonic {
            command.arg("--monophonic");
        }
        command.arg("--input-kind").arg(input_kind);
        command.current_dir(&self.workspace)
            .env("TEMP", &temporary)
            .env("TMP", &temporary)
            .env("TMPDIR", &temporary)
            .env("XDG_CACHE_HOME", self.workspace.join(".cache"))
            .stdin(Stdio::null())
            .stdout(Stdio::from(log.try_clone().map_err(err)?))
            .stderr(Stdio::from(log));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = ChildGuard(
            command
                .spawn()
                .map_err(|e| format!("Could not start local Python worker: {e}"))?,
        );
        let started = Instant::now();
        loop {
            if self.job.cancel.load(Ordering::SeqCst) {
                return Err("Transcription canceled".into());
            }
            if started.elapsed() > Duration::from_secs(180) {
                return Err("Transcription timed out after 180 seconds".into());
            }
            if let Some(status) = child.0.try_wait().map_err(err)? {
                if !status.success() {
                    return Err(format!(
                        "Transcription worker failed ({status}); see {job_dir}/worker.log"
                    ));
                }
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let result: WorkerResult = serde_json::from_slice(&self.store.read(
            id,
            &format!("{job_dir}/result.json"),
            2 * 1024 * 1024,
        )?)
        .map_err(err)?;
        if result.protocol_version != 1 || (result.silence && !result.notes.is_empty()) {
            return Err("Invalid worker protocol or silence flag".into());
        }
        valid_notes(&result.notes, analysis_duration, project.tempo_bpm)?;
        let midi_bytes = self
            .store
            .read(id, &format!("{job_dir}/melody.mid"), 2 * 1024 * 1024)?;
        if midi_bytes.len() < 14 || &midi_bytes[..4] != b"MThd" {
            return Err("Worker did not produce a MIDI file".into());
        }
        // Serialize cancellation and committing so cancellation never leaves half-applied notes.
        let _flags = self.job.flags.lock().map_err(err)?;
        if self.job.cancel.load(Ordering::SeqCst) {
            return Err("Transcription canceled".into());
        }
        if input_kind == "percussion" {
            project.tracks.retain(|track| track.id != "percussion");
            project.tracks.push(Track {
                id: "percussion".into(),
                name: "Percusión".into(),
                midi_channel: 9,
                program: 0,
                source_audio_id: "original".into(),
                notes: result.notes,
            });
        } else {
            project.tracks[0].notes = result.notes;
        }
        self.store.commit_transcription(&project, &midi_bytes)?;
        Ok(project)
    }
}

#[tauri::command]
pub fn save_take(
    host: tauri::State<'_, Host>,
    original: Vec<u8>,
    mime_type: String,
    wav: Vec<u8>,
    sample_rate_hz: u32,
    duration_seconds: f64,
    tempo_bpm: f64,
    channels: u8,
    analysis_duration_seconds: f64,
    time_signature: Option<String>,
) -> Result<Project> {
    host.store.save_with_metadata(
        &original,
        &mime_type,
        &wav,
        sample_rate_hz,
        duration_seconds,
        tempo_bpm,
        channels,
        analysis_duration_seconds,
        time_signature,
    )
}
#[tauri::command]
pub fn save_backtrack(
    host: tauri::State<'_, Host>,
    project_id: String,
    tracks: Vec<Track>,
) -> Result<Project> {
    let mut project = host.store.load(&project_id)?;
    if tracks.len() > 3 {
        return Err("Invalid extra tracks".into());
    }
    if tracks.is_empty() {
        project.tracks.retain(|track| track.id == "melody" || track.id == "percussion");
    } else {
        for track in tracks {
            if track.id == "melody" {
                return Err("The melody track cannot be replaced".into());
            }
            project.tracks.retain(|existing| existing.id != track.id);
            project.tracks.push(track);
        }
    }
    host.store.persist(&project)?;
    Ok(project)
}
#[tauri::command]
pub async fn transcribe_take(
    host: tauri::State<'_, Host>,
    project_id: String,
    monophonic: Option<bool>,
    input_kind: Option<String>,
) -> Result<Project> {
    let host = host.inner().clone();
    let lease = host.job.begin()?;
    let monophonic = monophonic.unwrap_or(false);
    let input_kind = input_kind.unwrap_or_else(|| "voice".to_string());
    tauri::async_runtime::spawn_blocking(move || host.transcribe(&project_id, lease, monophonic, &input_kind))
        .await
        .map_err(err)?
}
#[tauri::command]
pub fn cancel_transcription(host: tauri::State<'_, Host>) {
    let _guard = host.job.flags.lock().unwrap_or_else(|e| e.into_inner());
    host.job.cancel.store(true, Ordering::SeqCst);
}
#[tauri::command]
pub fn list_projects(host: tauri::State<'_, Host>) -> Result<Vec<ProjectSummary>> {
    host.store.list()
}
#[tauri::command]
pub fn load_project(host: tauri::State<'_, Host>, project_id: String) -> Result<Project> {
    host.store.load(&project_id)
}
#[tauri::command]
pub fn get_original_audio(
    host: tauri::State<'_, Host>,
    project_id: String,
) -> Result<OriginalAudio> {
    host.store.original(&project_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(debug_assertions)]
    #[test]
    fn desktop_test_storage_uses_only_a_validated_id_under_fixed_cache_prefix() {
        let workspace = PathBuf::from("D:/Proyectos/VOXEL");
        assert_eq!(
            debug_storage_root(&workspace, None).unwrap(),
            workspace.join("projects")
        );
        let id = Uuid::new_v4().to_string();
        assert_eq!(
            debug_storage_root(&workspace, Some(&id)).unwrap(),
            workspace
                .join(".cache/desktop-test")
                .join(&id)
                .join("projects")
        );
        for bad in [
            "",
            "../escape",
            "D:/outside",
            "00000000-0000-0000-0000-000000000000/../x",
            "DEADBEEF-DEAD-BEEF-DEAD-BEEFDEADBEEF",
        ] {
            assert!(debug_storage_root(&workspace, Some(bad)).is_err());
        }
    }

    fn wav(samples: usize, rate: u32) -> Vec<u8> {
        let size = (samples * 2) as u32;
        let mut bytes = Vec::new();
        bytes.extend(b"RIFF");
        bytes.extend((36 + size).to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16_u32.to_le_bytes());
        bytes.extend(1_u16.to_le_bytes());
        bytes.extend(1_u16.to_le_bytes());
        bytes.extend(rate.to_le_bytes());
        bytes.extend((rate * 2).to_le_bytes());
        bytes.extend(2_u16.to_le_bytes());
        bytes.extend(16_u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(size.to_le_bytes());
        bytes.resize(44 + size as usize, 0);
        bytes
    }

    #[test]
    fn rejects_bad_audio_before_creating_project() {
        let root = test_root();
        let store = Store::new(root.clone()).unwrap();
        assert!(store
            .save(&[], "audio/webm", &wav(16000, 16000), 16000, 1.0, 120.0)
            .is_err());
        assert!(store
            .save(&[1], "text/plain", &wav(16000, 16000), 16000, 1.0, 120.0)
            .is_err());
        assert!(store
            .save(&[1], "audio/webm", &[0; 50], 16000, 1.0, 120.0)
            .is_err());
        assert!(store
            .save(&[1], "audio/webm", &wav(16000, 16000), 8000, 1.0, 120.0)
            .is_err());
        assert!(store
            .save(&[1], "audio/webm", &wav(16000, 16000), 16000, 2.0, 120.0)
            .is_err());
        assert!(store
            .save(&[1], "audio/webm", &wav(16000, 16000), 16000, 1.0, f64::NAN)
            .is_err());
        assert_eq!(store.list().unwrap().len(), 0);
    }

    #[test]
    fn project_roundtrip_preserves_original_and_rejects_traversal() {
        let store = Store::new(test_root()).unwrap();
        let project = store
            .save(
                &[1, 2, 3],
                "audio/webm;codecs=opus",
                &wav(16000, 16000),
                16000,
                1.0,
                120.0,
            )
            .unwrap();
        let loaded = store.load(&project.id).unwrap();
        assert_eq!(loaded.audio_assets[0].path, "audio/original.webm");
        assert_eq!(store.original(&project.id).unwrap().bytes, vec![1, 2, 3]);
        assert_eq!(store.list().unwrap()[0].id, project.id);
        for bad in [
            "../outside",
            "C:\\Windows",
            "",
            "00000000-0000-0000-0000-000000000000/../x",
        ] {
            assert!(store.load(bad).is_err());
            assert!(store.original(bad).is_err());
        }
        let mut poisoned = serde_json::to_value(&loaded).unwrap();
        poisoned["audioAssets"][0]["path"] = "audio/../../secret".into();
        std::fs::write(
            store.project_dir(&project.id).unwrap().join("project.json"),
            serde_json::to_vec(&poisoned).unwrap(),
        )
        .unwrap();
        assert!(store.load(&project.id).is_err());
    }

    fn test_root() -> std::path::PathBuf {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../.cache/rust-tests")
            .join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&path).unwrap();
        std::fs::canonicalize(path).unwrap()
    }

    fn test_host() -> Host {
        Host {
            store: Store::new(test_root()).unwrap(),
            workspace: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .to_path_buf(),
            job: Arc::default(),
        }
    }

    #[test]
    fn atomic_replacement_keeps_valid_project_and_source() {
        let store = Store::new(test_root()).unwrap();
        let mut project = store
            .save(&[7, 8], "audio/ogg", &wav(16000, 16000), 16000, 1.0, 120.0)
            .unwrap();
        project.tracks[0].notes.push(Note {
            id: "note-1".into(),
            pitch: 69,
            velocity: 100,
            start_tick: 0,
            duration_ticks: 480,
        });
        store.persist(&project).unwrap();
        assert_eq!(
            store.load(&project.id).unwrap().tracks[0].notes[0].pitch,
            69
        );
        assert_eq!(store.original(&project.id).unwrap().bytes, vec![7, 8]);
        project.tracks[0].notes[0].duration_ticks = MAX_SAFE_TICK;
        assert!(store.persist(&project).is_err());
        assert_eq!(
            store.load(&project.id).unwrap().tracks[0].notes[0].duration_ticks,
            480
        );
    }

    #[cfg(windows)]
    #[test]
    fn failed_json_commit_restores_previous_midi_and_project() {
        let store = Store::new(test_root()).unwrap();
        let mut project = store
            .save(&[7], "audio/webm", &wav(16000, 16000), 16000, 1.0, 120.0)
            .unwrap();
        store
            .atomic(&project.id, "melody.mid", b"previous-midi")
            .unwrap();
        let before = store
            .read(&project.id, "project.json", 2 * 1024 * 1024)
            .unwrap();
        let path = store.file(&project.id, "project.json").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        project.tracks[0].notes.push(Note {
            id: "new".into(),
            pitch: 69,
            velocity: 100,
            start_tick: 0,
            duration_ticks: 480,
        });
        let result = store.commit_transcription(&project, b"new-midi");
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(result.is_err());
        assert_eq!(
            store
                .read(&project.id, "project.json", 2 * 1024 * 1024)
                .unwrap(),
            before
        );
        assert_eq!(
            store.read(&project.id, "melody.mid", 1024).unwrap(),
            b"previous-midi"
        );
    }

    #[test]
    fn rejects_invalid_note_protocol_and_bounds() {
        let valid = r#"{"protocolVersion":1,"notes":[{"id":"n","pitch":69,"velocity":127,"startTick":0,"durationTicks":960}],"silence":false}"#;
        let result: WorkerResult = serde_json::from_str(valid).unwrap();
        valid_notes(&result.notes, 1.0, 120.0).unwrap();
        for (field, value) in [
            ("pitch", 128_u64),
            ("velocity", 0),
            ("startTick", MAX_SAFE_TICK),
            ("durationTicks", 0),
            ("durationTicks", 961),
        ] {
            let mut json: serde_json::Value = serde_json::from_str(valid).unwrap();
            json["notes"][0][field] = value.into();
            let result: WorkerResult = serde_json::from_value(json).unwrap();
            assert!(valid_notes(&result.notes, 1.0, 120.0).is_err());
        }
        assert!(serde_json::from_str::<WorkerResult>(
            &valid.replace("\"pitch\":69", "\"pitch\":69.5")
        )
        .is_err());
        assert!(serde_json::from_str::<WorkerResult>(
            &valid.replace("\"pitch\":69", "\"pitch\":true")
        )
        .is_err());
        let mut duplicates = result.notes.clone();
        duplicates.push(result.notes[0].clone());
        assert!(valid_notes(&duplicates, 1.0, 120.0).is_err());
    }

    #[test]
    fn rejects_oversize_and_inconsistent_wav_chunks() {
        let store = Store::new(test_root()).unwrap();
        let good = wav(16000, 16000);
        assert!(store
            .save(
                &vec![1; MAX_BYTES + 1],
                "audio/webm",
                &good,
                16000,
                1.0,
                120.0
            )
            .is_err());
        assert!(validate_wav(&wav(16000 * 31, 16000), 16000, 31.0).is_err());
        let mut stereo = good.clone();
        stereo[22] = 2;
        assert!(validate_wav(&stereo, 16000, 1.0).is_err());
        let mut truncated = good.clone();
        truncated.pop();
        assert!(validate_wav(&truncated, 16000, 1.0).is_err());
        let mut fake_size = good;
        fake_size[40..44].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(validate_wav(&fake_size, 16000, 1.0).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn rejects_directory_junction_escape() {
        let store = Store::new(test_root()).unwrap();
        let project = store
            .save(&[1], "audio/webm", &wav(16000, 16000), 16000, 1.0, 120.0)
            .unwrap();
        let outside = test_root();
        let junction_id = Uuid::new_v4().to_string();
        let junction = store.root.join(&junction_id);
        let status = Command::new("cmd.exe")
            .args(["/C", "mklink", "/J"])
            .arg(&junction)
            .arg(store.project_dir(&project.id).unwrap())
            .output()
            .unwrap();
        assert!(
            status.status.success(),
            "{}",
            String::from_utf8_lossy(&status.stderr)
        );
        assert!(store.load(&junction_id).is_err());
        let nested = store.project_dir(&project.id).unwrap().join("escaped");
        let status = Command::new("cmd.exe")
            .args(["/C", "mklink", "/J"])
            .arg(&nested)
            .arg(outside)
            .output()
            .unwrap();
        assert!(
            status.status.success(),
            "{}",
            String::from_utf8_lossy(&status.stderr)
        );
        assert!(store.file(&project.id, "escaped/private").is_err());
    }

    #[test]
    fn exclusive_job_shutdown_waits_and_prevents_new_jobs() {
        let job = Arc::new(JobState::default());
        let lease = job.begin().unwrap();
        assert!(job.begin().is_err());
        let other = job.clone();
        let thread = std::thread::spawn(move || other.shutdown());
        while !job.cancel.load(Ordering::SeqCst) {
            std::thread::yield_now();
        }
        assert!(!thread.is_finished());
        drop(lease);
        thread.join().unwrap();
        assert!(job.begin().is_err());
    }

    #[test]
    fn original_metadata_preserves_stereo_and_codec_tail() {
        let store = Store::new(test_root()).unwrap();
        let analysis = wav(16000 * 30, 16000);
        let project = store
            .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 30.02, 120.0, 2, 30.0, None)
            .unwrap();
        assert_eq!(project.audio_assets[0].channels, 2);
        assert_eq!(
            store.load(&project.id).unwrap().audio_assets[0].duration_seconds,
            30.02
        );
        assert!(store
            .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 29.0, 120.0, 2, 30.0, None)
            .is_err());
        assert!(store
            .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 33.0, 120.0, 2, 30.0, None)
            .is_err());
        assert!(store
            .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 30.02, 120.0, 0, 30.0, None)
            .is_err());
    }

    #[test]
    fn chosen_time_signature_survives_storage_and_rejects_invalid_values() {
        let store = Store::new(test_root()).unwrap();
        let analysis = wav(16000, 16000);
        let project = store
            .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 1.0, 120.0, 1, 1.0, Some("6/8".into()))
            .unwrap();
        let loaded = store.load(&project.id).unwrap();
        assert_eq!(loaded.time_signature.numerator, 6);
        assert_eq!(loaded.time_signature.denominator, 8);
        assert_eq!(format_time_signature(&loaded.time_signature), "6/8");
        for invalid in ["", "3", "4/3", "0/4", "256/4", "3/4/5", "3/ 4"] {
            assert!(
                store
                    .save_with_metadata(&[1], "audio/webm", &analysis, 16000, 1.0, 120.0, 1, 1.0, Some(invalid.into()))
                    .is_err(),
                "Accepted invalid time signature {invalid}"
            );
        }
    }

    fn backtrack_tracks() -> Vec<Track> {
        vec![
            Track {
                id: "backtrack-chords".into(), name: "Acordes".into(), midi_channel: 1,
                program: 0, source_audio_id: "original".into(),
                notes: vec![Note {
                    id: "bt-c-0".into(), pitch: 60, velocity: 68, start_tick: 0, duration_ticks: 960,
                }],
            },
            Track {
                id: "backtrack-bass".into(), name: "Bajo".into(), midi_channel: 2,
                program: 32, source_audio_id: "original".into(),
                notes: vec![Note {
                    id: "bt-b-0".into(), pitch: 36, velocity: 88, start_tick: 0, duration_ticks: 480,
                }],
            },
        ]
    }

    #[test]
    fn backtrack_tracks_are_validated_and_persisted() {
        let store = Store::new(test_root()).unwrap();
        let project = store
            .save(&[1], "audio/webm", &wav(16000, 16000), 16000, 1.0, 120.0)
            .unwrap();
        let mut with_backtrack = project.clone();
        with_backtrack.tracks.extend(backtrack_tracks());
        store.persist(&with_backtrack).unwrap();
        let loaded = store.load(&project.id).unwrap();
        assert_eq!(loaded.tracks.len(), 3);
        assert_eq!(loaded.tracks[1].notes[0].pitch, 60);
        assert_eq!(loaded.tracks[2].notes[0].pitch, 36);

        let mut wrong_id = with_backtrack.clone();
        wrong_id.tracks[1].id = "unknown".into();
        assert!(store.persist(&wrong_id).is_err());
        let mut wrong_channel = with_backtrack.clone();
        wrong_channel.tracks[2].midi_channel = 0;
        assert!(store.persist(&wrong_channel).is_err());
        let mut too_far = with_backtrack.clone();
        too_far.tracks[1].notes[0].start_tick = 900;
        assert!(store.persist(&too_far).is_err());
        store.persist(&project).unwrap();
        assert_eq!(store.load(&project.id).unwrap().tracks.len(), 1);
    }

    #[test]
    fn real_python_worker_silence_and_a4_roundtrip() {
        let host = test_host();
        let silence = wav(16000, 16000);
        let project = host
            .store
            .save(&silence, "audio/wav", &silence, 16000, 1.0, 120.0)
            .unwrap();
        let result = host
            .transcribe(&project.id, host.job.begin().unwrap(), false, "voice")
            .unwrap();
        assert!(result.tracks[0].notes.is_empty());
        assert!(host.store.file(&project.id, "melody.mid").unwrap().exists());
        let mut tone = wav(32000, 16000);
        for (index, chunk) in tone[44..].chunks_exact_mut(2).enumerate() {
            let sample =
                ((index as f64 * 440.0 * std::f64::consts::TAU / 16000.0).sin() * 12000.0) as i16;
            chunk.copy_from_slice(&sample.to_le_bytes());
        }
        let project = host
            .store
            .save_with_metadata(&tone, "audio/wav", &tone, 16000, 2.0, 120.0, 1, 2.0, Some("3/4".into()))
            .unwrap();
        let result = host
            .transcribe(&project.id, host.job.begin().unwrap(), false, "voice")
            .unwrap();
        assert!(
            result.tracks[0].notes.iter().any(|n| n.pitch == 69),
            "Expected actual model to detect A4"
        );
        let midi = host
            .store
            .read(&project.id, "melody.mid", 2 * 1024 * 1024)
            .unwrap();
        assert!(
            midi.windows(8).any(|window| window == [0, 255, 88, 4, 3, 2, 24, 8]),
            "Worker MIDI must carry the project's 3/4 time signature"
        );
        assert_eq!(
            host.store.load(&project.id).unwrap().tracks[0].notes.len(),
            result.tracks[0].notes.len()
        );
        assert_eq!(host.store.original(&project.id).unwrap().bytes, tone);
        // A second run exercises replacing existing JSON/MIDI on Windows.
        let result = host
            .transcribe(&project.id, host.job.begin().unwrap(), false, "voice")
            .unwrap();
        assert!(result.tracks[0].notes.iter().any(|n| n.pitch == 69));
    }

    #[test]
    fn real_python_worker_percussion_creates_gm_drum_track() {
        let host = test_host();
        let mut clicks = wav(32000, 16000);
        for (index, chunk) in clicks[44..].chunks_exact_mut(2).enumerate() {
            let seconds = index as f64 / 16000.0;
            let phase = (seconds * 2.0) % 1.0;
            let value = if phase < 0.02 {
                (phase / 0.02 * std::f64::consts::TAU).sin() * 12000.0
            } else {
                0.0
            };
            chunk.copy_from_slice(&(value as i16).to_le_bytes());
        }
        let project = host
            .store
            .save(&clicks, "audio/wav", &clicks, 16000, 2.0, 120.0)
            .unwrap();
        host.transcribe(&project.id, host.job.begin().unwrap(), false, "percussion")
            .unwrap();
        let loaded = host.store.load(&project.id).unwrap();
        let drums = loaded
            .tracks
            .iter()
            .find(|track| track.id == "percussion")
            .expect("Percussion track must be created");
        assert_eq!(drums.midi_channel, 9);
        assert!(!drums.notes.is_empty());
        assert!(drums.notes.iter().all(|note| [36, 38, 42].contains(&note.pitch)));
        assert!(loaded.tracks[0].notes.is_empty(), "Melody track stays untouched");
    }

    #[test]
    fn cancel_running_worker_preserves_last_project() {
        let host = test_host();
        let mut tone = wav(16000 * 30, 16000);
        for (index, chunk) in tone[44..].chunks_exact_mut(2).enumerate() {
            chunk.copy_from_slice(
                &(((index as f64 * 440.0 * std::f64::consts::TAU / 16000.0).sin() * 12000.0)
                    as i16)
                    .to_le_bytes(),
            );
        }
        let project = host
            .store
            .save(&tone, "audio/wav", &tone, 16000, 30.0, 120.0)
            .unwrap();
        let before = host
            .store
            .read(&project.id, "project.json", 2 * 1024 * 1024)
            .unwrap();
        let lease = host.job.begin().unwrap();
        let other = host.clone();
        let id = project.id.clone();
        let thread = std::thread::spawn(move || other.transcribe(&id, lease, false, "voice"));
        let started = Instant::now();
        loop {
            let jobs = fs::read_dir(host.store.project_dir(&project.id).unwrap())
                .unwrap()
                .flatten()
                .any(|e| e.file_name().to_string_lossy().starts_with("job-"));
            if jobs {
                break;
            }
            assert!(started.elapsed() < Duration::from_secs(10));
            std::thread::sleep(Duration::from_millis(10));
        }
        std::thread::sleep(Duration::from_millis(150));
        host.job.cancel.store(true, Ordering::SeqCst);
        let error = thread.join().unwrap().unwrap_err();
        assert!(error.contains("canceled"), "{error}");
        assert_eq!(
            host.store
                .read(&project.id, "project.json", 2 * 1024 * 1024)
                .unwrap(),
            before
        );
        assert_eq!(host.store.original(&project.id).unwrap().bytes, tone);
        assert!(!host.store.file(&project.id, "melody.mid").unwrap().exists());
        assert!(host.job.begin().is_ok());
    }
}
