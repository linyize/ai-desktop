#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::{command, Manager, WindowEvent};

#[command]
fn run_command(command: String) -> Result<String, String> {
  let output = Command::new("sh")
    .arg("-c")
    .arg(command)
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[command]
fn take_screenshot() -> Result<String, String> {
  let output = Command::new("gnome-screenshot")
    .arg("-f")
    .arg("/tmp/screenshot.png")
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    Ok("/tmp/screenshot.png".to_string())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[command]
fn read_dir(path: String) -> Result<Vec<String>, String> {
  std::fs::read_dir(&path)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| entry.ok())
    .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
    .map(|entry| entry.file_name().to_string_lossy().to_string())
    .collect()
}

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
    .setup(|app| {
      let tray_handle = app.tray_handle();
      
      tray_handle.on_tray_icon_event(|tray, event| {
        if let tauri::TrayIconEvent::Click { .. } = event {
          let window = tray.window();
          if let Some(w) = window {
            w.show().unwrap();
            w.set_focus().unwrap();
          }
        }
      });
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler!(run_command, take_screenshot, read_dir))
    .run(tauri::generate_context!())
    .expect("error while running AI Desktop");
}
