!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInit
  ; Older launcher versions do not pass /S to quitAndInstall. The updater always
  ; passes --updated, so switch those upgrades to silent mode inside the package.
  ; A normal first-time installation still displays the branded installer.
  ${if} ${isUpdated}
    SetSilent silent
  ${endif}
!macroend
