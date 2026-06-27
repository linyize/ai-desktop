#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::WindowEvent;

fn main() {
  tauri::Builder::default()
    .on_window_event(|window, event| {
      match event {
        WindowEvent::CloseRequested { api, .. } => {
          window.hide().unwrap();
          api.prevent_close();
        }
        WindowEvent::Focused(focused) => {
          if *focused {
            println!("MainWindow focused");
          }
        }
        _ => {}
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running AI Desktop");
}
