Add-Type -AssemblyName System.Drawing

$iconPath = "d:\TraeProjects\1385\icons"
if (-not (Test-Path $iconPath)) {
    New-Item -ItemType Directory -Path $iconPath | Out-Null
}

$sizes = @(16, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    
    $rect = New-Object System.Drawing.Rectangle(2, 2, $size - 4, $size - 4)
    
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(76, 175, 80))
    $g.FillEllipse($brush, $rect.X, $rect.Y, $rect.Width, $rect.Height)
    
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 125, 50), 2)
    $g.DrawEllipse($pen, $rect.X, $rect.Y, $rect.Width, $rect.Height)
    
    if ($size -eq 16) {
        $fontSize = 9
    } elseif ($size -eq 48) {
        $fontSize = 26
    } else {
        $fontSize = 70
    }
    
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $textFormat = New-Object System.Drawing.StringFormat
    $textFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $textFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $textRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString("N", $font, $textBrush, $textRect, $textFormat)
    
    $outputPath = Join-Path $iconPath ("icon" + $size + ".png")
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $bmp.Dispose()
    $g.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    $font.Dispose()
    $textBrush.Dispose()
}

Write-Host "Icons generated successfully at $iconPath"
