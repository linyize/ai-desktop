// Tauri v2 正确 API 用法参考
// 所有实际代码以此为基准，不要猜测 API

// ===== 1. Command 定义 =====
use std::process::Command;

#[tauri::command]
fn run_command(command: String) -> Result<String, String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(command) // ← 正确: .arg(var)，不是 &var
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ===== 2. 注册 Command =====
// 宏名: generate_handler（不是 generate_invoke_handler）
// .invoke_handler(tauri::generate_handler!(run_command, take_screenshot, read_dir))

// ===== 3. 窗口事件 =====
// .on_window_event(|window, event| {
//     match event {
//         WindowEvent::CloseRequested { api, .. } => {
//             window.hide().unwrap();
//             api.prevent_close();
//         }
//         _ => {}
//     }
// })

// ===== 4. 系统托盘（Tauri v2） =====
// Cargo.toml 需要: tauri = { version = "2", features = ["tray-icon"] }
//
// use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
//
// .setup(|app| {
//     TrayIconBuilder::new() // ← 无参数
//         .icon(app.default_window_icon().unwrap().clone())
//         .on_tray_icon_event(|tray, event| {
//             if let TrayIconEvent::Click {
//                 button: MouseButton::Left, ..
//             } = event
//             {
//                 let window = tray.app_handle()
//                     .get_webview_window("ai-sidebar")
//                     .unwrap();
//                 window.show().unwrap();
//                 window.set_focus().unwrap();
//             }
//         })
//         .build(app)?; // ← 返回 Result
//     Ok(())
// })

// ===== 5. 获取窗口引用 =====
// 在 setup 中: app.get_webview_window("ai-sidebar")
// 在事件中: tray.app_handle().get_webview_window("ai-sidebar")

// ===== 6. tauri.conf.json 结构 =====
// {
//   "build": {
//     "frontendDist": "../dist",  // 相对 src-tauri/
//     "devUrl": "http://localhost:1420",
//     "beforeBuildCommand": "npm run build"
//   },
//   "app": {
//     "windows": [...]
//     // 不要在这里放 systemTray
//   }
//   // systemTray 在 Tauri v2 中通过 Rust API 配置
// }
