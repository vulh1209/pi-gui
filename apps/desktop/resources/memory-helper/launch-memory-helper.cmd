@echo off
setlocal
set "HOST_EXECUTABLE=%PI_MEMORY_HOST_EXECUTABLE%"
if "%HOST_EXECUTABLE%"=="" set "HOST_EXECUTABLE=%~dp0..\..\pi-gui.exe"
set "ELECTRON_RUN_AS_NODE=1"
"%HOST_EXECUTABLE%" %*
