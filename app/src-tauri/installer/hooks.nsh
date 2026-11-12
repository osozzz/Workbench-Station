; Tauri's installer template sets no CompanyName, so the setup file's properties would show no publisher.
; This file is included before ${MANUFACTURER} is defined, so the name is repeated from bundle.publisher.
VIAddVersionKey "CompanyName" "Alejandro Osorno"

; The scheduled audit is a Task Scheduler task outside the install folder, so it goes with the app.
!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec '"$SYSDIR\schtasks.exe" /Delete /TN "Workbench Station\Audit" /F'
  Pop $0
!macroend
