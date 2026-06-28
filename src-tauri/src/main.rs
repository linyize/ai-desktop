#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::{command, Manager, tray::TrayIconBuilder, tray::TrayIconEvent, WindowEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[command]
fn run_command(command: String) -> Result<String, String> {
  #[cfg(target_os = "windows")]
  let shell = ("cmd", "/c");
  #[cfg(not(target_os = "windows"))]
  let shell = ("sh", "-c");

  let output = Command::new(shell.0)
    .arg(shell.1)
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
  #[cfg(target_os = "linux")]
  let (cmd, args, out) = ("gnome-screenshot", vec!["-f", "/tmp/screenshot.png"], "/tmp/screenshot.png");
  #[cfg(target_os = "macos")]
  let (cmd, args, out) = ("screencapture", vec!["-x", "/tmp/screenshot.png"], "/tmp/screenshot.png");
  #[cfg(target_os = "windows")]
  let (cmd, args, out) = ("powershell", vec!["-Command", "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Seconds 1; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('C:\\temp\\screenshot.png')"], "C:\\temp\\screenshot.png");

  let output = Command::new(cmd)
    .args(&args)
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    Ok(out.to_string())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[command]
fn read_dir(path: String) -> Result<Vec<String>, String> {
  let entries: Vec<String> = std::fs::read_dir(&path)
    .map_err(|e| e.to_string())?
    .filter_map(|entry| entry.ok())
    .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
    .map(|entry| entry.file_name().to_string_lossy().to_string())
    .collect();
  
  Ok(entries)
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
      let _shortcut = app
        .register_global_shortcut("Super+Shift+Space", |app, _, _| {
          let window = app.get_webview_window("ai-sidebar").unwrap();
          if window.is_visible().unwrap() {
            window.hide().unwrap();
          } else {
            window.show().unwrap();
            window.set_focus().unwrap();
          }
        })
        .expect("Failed to register global shortcut");

      TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { .. } = event {
            let window = tray.app_handle().get_webview_window("ai-sidebar").unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
          }
        })
        .build(app)
        .unwrap();

      Ok(())
    })
    .invoke_handler(tauri::generate_handler!(run_command, take_screenshot, read_dir))
    .run(tauri::generate_context!())
    .expect("error while running AI Desktop");
}
