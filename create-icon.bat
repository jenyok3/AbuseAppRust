@echo off
powershell -Command "Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap(256, 256); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Blue); $bmp.Save('C:\Users\Admin\Abuse-App\src-tauri\icons\icon.ico', [System.Drawing.Imaging.ImageFormat]::Icon); $g.Dispose(); $bmp.Dispose(); Write-Host 'Icon created successfully'"
