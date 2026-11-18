#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod host;

fn main() {
    use tauri::Manager;
    let host = host::Host::development().expect("failed to open VOXEL project storage");
    tauri::Builder::default()
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            host::save_take,
            host::transcribe_take,
            host::cancel_transcription,
            host::list_projects,
            host::load_project,
            host::get_original_audio
        ])
        .build(tauri::generate_context!())
        .expect("failed to build VOXEL")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                app.state::<host::Host>().shutdown();
            }
        });
}
