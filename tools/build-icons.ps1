# Windows built-in drawing APIs; no extra packages. Geometric court + shuttle mark.
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null
foreach ($size in 192,512) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#102c29'))
    $graphics.ScaleTransform(($size / 512.0), ($size / 512.0))
    $line = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#d9f5ab'), 10)
    $white = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#ecf5ef'), 9)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ecf5ef'))
    # All important artwork fits inside the central maskable safe circle.
    $graphics.DrawRectangle($line, 138, 114, 236, 284)
    $graphics.DrawLine($line, 138, 256, 374, 256)
    $graphics.DrawLine($line, 256, 114, 256, 206)
    $graphics.DrawLine($line, 256, 306, 256, 398)
    $graphics.DrawLine($white, 210, 204, 246, 294)
    $graphics.DrawLine($white, 256, 190, 256, 294)
    $graphics.DrawLine($white, 302, 204, 266, 294)
    $graphics.DrawArc($white, 210, 183, 92, 42, 180, 180)
    $graphics.FillEllipse($brush, 241, 284, 30, 30)
    $bitmap.Save((Join-Path $iconDirectory "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose(); $white.Dispose(); $line.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
