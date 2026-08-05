param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$buildDirectory = Join-Path $ProjectRoot 'build'
$backgroundPath = Join-Path $ProjectRoot 'app\assets\images\RSBackground.png'
$logoPath = Join-Path $ProjectRoot 'app\assets\images\RSIcon.png'

foreach ($requiredPath in @($backgroundPath, $logoPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Installer artwork source was not found: $requiredPath"
    }
}

[System.IO.Directory]::CreateDirectory($buildDirectory) | Out-Null

function New-InstallerBitmap {
    param(
        [int]$Width,
        [int]$Height
    )

    return [System.Drawing.Bitmap]::new(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
}

function Set-HighQualityGraphics {
    param([System.Drawing.Graphics]$Graphics)

    $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function Draw-CoverImage {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Image]$Image,
        [System.Drawing.Rectangle]$Target,
        [double]$FocusX = 0.5,
        [double]$FocusY = 0.5
    )

    $scale = [Math]::Max($Target.Width / $Image.Width, $Target.Height / $Image.Height)
    $sourceWidth = $Target.Width / $scale
    $sourceHeight = $Target.Height / $scale
    $sourceX = [Math]::Max(0, [Math]::Min($Image.Width - $sourceWidth, ($Image.Width * $FocusX) - ($sourceWidth / 2)))
    $sourceY = [Math]::Max(0, [Math]::Min($Image.Height - $sourceHeight, ($Image.Height * $FocusY) - ($sourceHeight / 2)))
    $source = [System.Drawing.RectangleF]::new($sourceX, $sourceY, $sourceWidth, $sourceHeight)

    $destination = [System.Drawing.RectangleF]::new(
        [float]$Target.X,
        [float]$Target.Y,
        [float]$Target.Width,
        [float]$Target.Height
    )
    $Graphics.DrawImage($Image, $destination, $source, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-CenteredText {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [float]$Y,
        [float]$CanvasWidth
    )

    $measured = $Graphics.MeasureString($Text, $Font)
    $Graphics.DrawString($Text, $Font, $Brush, ($CanvasWidth - $measured.Width) / 2, $Y)
}

function New-SidebarArtwork {
    param(
        [string]$OutputPath,
        [string]$FooterText,
        [System.Drawing.Image]$Background,
        [System.Drawing.Image]$Logo
    )

    $bitmap = New-InstallerBitmap -Width 164 -Height 314
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    Set-HighQualityGraphics -Graphics $graphics

    try {
        $canvas = [System.Drawing.Rectangle]::new(0, 0, 164, 314)
        Draw-CoverImage -Graphics $graphics -Image $Background -Target $canvas -FocusX 0.58 -FocusY 0.52

        $shade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $canvas,
            [System.Drawing.Color]::FromArgb(118, 5, 10, 7),
            [System.Drawing.Color]::FromArgb(235, 4, 9, 6),
            [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
        )
        $graphics.FillRectangle($shade, $canvas)
        $shade.Dispose()

        $graphics.DrawImage($Logo, 46, 24, 72, 72)

        $titleFont = [System.Drawing.Font]::new('Segoe UI', 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $captionFont = [System.Drawing.Font]::new('Segoe UI', 8, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $footerFont = [System.Drawing.Font]::new('Segoe UI', 9, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
        $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(185, 227, 235, 230))
        $greenBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 73, 185, 79))

        Draw-CenteredText -Graphics $graphics -Text 'RSLauncher' -Font $titleFont -Brush $whiteBrush -Y 104 -CanvasWidth 164
        Draw-CenteredText -Graphics $graphics -Text 'MINECRAFT LAUNCHER' -Font $captionFont -Brush $mutedBrush -Y 132 -CanvasWidth 164
        $graphics.FillRectangle($greenBrush, 62, 153, 40, 2)
        Draw-CenteredText -Graphics $graphics -Text $FooterText -Font $footerFont -Brush $whiteBrush -Y 271 -CanvasWidth 164
        Draw-CenteredText -Graphics $graphics -Text 'FAST AND SIMPLE' -Font $captionFont -Brush $mutedBrush -Y 290 -CanvasWidth 164

        $titleFont.Dispose()
        $captionFont.Dispose()
        $footerFont.Dispose()
        $whiteBrush.Dispose()
        $mutedBrush.Dispose()
        $greenBrush.Dispose()

        $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$background = [System.Drawing.Image]::FromFile($backgroundPath)
$logo = [System.Drawing.Image]::FromFile($logoPath)

try {
    New-SidebarArtwork `
        -OutputPath (Join-Path $buildDirectory 'installerSidebar.bmp') `
        -FooterText 'SETUP WIZARD' `
        -Background $background `
        -Logo $logo

    New-SidebarArtwork `
        -OutputPath (Join-Path $buildDirectory 'uninstallerSidebar.bmp') `
        -FooterText 'UNINSTALL WIZARD' `
        -Background $background `
        -Logo $logo

    $header = New-InstallerBitmap -Width 150 -Height 57
    $headerGraphics = [System.Drawing.Graphics]::FromImage($header)
    Set-HighQualityGraphics -Graphics $headerGraphics

    try {
        $headerCanvas = [System.Drawing.Rectangle]::new(0, 0, 150, 57)
        Draw-CoverImage -Graphics $headerGraphics -Image $background -Target $headerCanvas -FocusX 0.56 -FocusY 0.44
        $headerShade = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(205, 5, 10, 7))
        $headerGraphics.FillRectangle($headerShade, $headerCanvas)
        $headerShade.Dispose()

        $headerGraphics.DrawImage($logo, 8, 8, 41, 41)
        $headerFont = [System.Drawing.Font]::new('Segoe UI', 14, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $headerCaptionFont = [System.Drawing.Font]::new('Segoe UI', 7, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $headerWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
        $headerMuted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(195, 226, 235, 229))
        $headerGreen = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 73, 185, 79))

        $headerGraphics.DrawString('RSLauncher', $headerFont, $headerWhite, 53, 13)
        $headerGraphics.DrawString('MINECRAFT LAUNCHER', $headerCaptionFont, $headerMuted, 54, 33)
        $headerGraphics.FillRectangle($headerGreen, 0, 55, 150, 2)

        $headerFont.Dispose()
        $headerCaptionFont.Dispose()
        $headerWhite.Dispose()
        $headerMuted.Dispose()
        $headerGreen.Dispose()

        $header.Save((Join-Path $buildDirectory 'installerHeader.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
    } finally {
        $headerGraphics.Dispose()
        $header.Dispose()
    }
} finally {
    $background.Dispose()
    $logo.Dispose()
}

Write-Host 'RSLauncher installer artwork generated.'
