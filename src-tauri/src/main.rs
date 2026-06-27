#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .on_window_event(|window, event| {
      match event {
        // 窗口关闭时隐藏而不是退出
        tauri::WindowEvent::CloseRequested { api, .. } => {
          window.hide().unwrap();
          api.prevent_close();
        }
        // 窗口激活时->真正暴露
        tauri::WindowEvent::Focused(focused) => {
          if focused {
            println!("MainWindow focused");
          }
        }
        _ => {}
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running AI Desktop");
}
