using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Reflection;
using System.Runtime.InteropServices;

namespace RSLauncher.Installer;

internal sealed class InstallerForm : Form
{
    private const int WmNclButtonDown = 0x00A1;
    private const int HtCaption = 0x0002;
    private const int DwmWindowCornerPreference = 33;
    private const int DwmWindowCornerRound = 2;

    private readonly Image _backgroundImage;
    private readonly Image _logoImage;
    private readonly RoundedPanel _card;
    private readonly Label _pathValue;
    private readonly StyledCheckBox _desktopShortcut;
    private readonly StyledCheckBox _launchAfterInstall;
    private readonly Label _statusLabel;
    private readonly Panel _progressTrack;
    private readonly Panel _progressFill;
    private readonly RoundedButton _installButton;
    private readonly RoundedButton _browseButton;
    private readonly RoundedButton _closeButton;
    private readonly System.Windows.Forms.Timer _progressTimer;

    private string _installPath;
    private int _progressPosition;
    private bool _installing;
    private bool _installed;

    public InstallerForm()
    {
        _backgroundImage = LoadImageResource("RSInstallerBackground.png");
        _logoImage = LoadImageResource("RSIcon.png");
        _installPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "RSLauncher");

        SuspendLayout();
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        BackColor = Color.FromArgb(6, 11, 8);
        ClientSize = new Size(980, 610);
        DoubleBuffered = true;
        FormBorderStyle = FormBorderStyle.None;
        KeyPreview = true;
        MaximizeBox = false;
        MinimizeBox = false;
        Name = "RSLauncherInstaller";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "RSLauncher 설치";
        MouseDown += DragWindow;

        var windowIcon = new Bitmap(_logoImage, new Size(64, 64));
        Icon = Icon.FromHandle(windowIcon.GetHicon());

        AddBrandArea();

        _card = new RoundedPanel
        {
            BackColor = Color.FromArgb(9, 19, 14),
            BorderColor = Color.FromArgb(98, 133, 113),
            CornerRadius = 24,
            InnerBorderColor = Color.FromArgb(24, 255, 255, 255),
            Location = new Point(535, 54),
            RasterTexture = true,
            SecondaryColor = Color.FromArgb(5, 13, 9),
            Size = new Size(405, 540)
        };
        AttachDragHandler(_card);
        Controls.Add(_card);

        var heading = CreateLabel("RSLauncher 설치", 24F, FontStyle.Bold, Color.White);
        heading.Location = new Point(32, 28);
        heading.Size = new Size(335, 45);
        AttachDragHandler(heading);
        _card.Controls.Add(heading);

        var description = CreateLabel("Minecraft를 시작할 준비를 마쳐보세요.", 9.5F, FontStyle.Regular, Color.FromArgb(174, 188, 179));
        description.Location = new Point(34, 75);
        description.Size = new Size(335, 25);
        AttachDragHandler(description);
        _card.Controls.Add(description);

        var divider = new Panel
        {
            BackColor = Color.FromArgb(43, 57, 48),
            Location = new Point(34, 111),
            Size = new Size(337, 1)
        };
        _card.Controls.Add(divider);

        var pathTitle = CreateLabel("설치 위치", 9F, FontStyle.Bold, Color.FromArgb(226, 235, 229));
        pathTitle.Location = new Point(34, 132);
        pathTitle.Size = new Size(200, 24);
        _card.Controls.Add(pathTitle);

        var pathPanel = new RoundedPanel
        {
            BackColor = Color.FromArgb(22, 38, 29),
            BorderColor = Color.FromArgb(67, 98, 79),
            CornerRadius = 10,
            InnerBorderColor = Color.FromArgb(18, 255, 255, 255),
            Location = new Point(34, 160),
            SecondaryColor = Color.FromArgb(14, 27, 20),
            Size = new Size(258, 48)
        };
        _card.Controls.Add(pathPanel);

        _pathValue = CreateLabel(_installPath, 8.5F, FontStyle.Regular, Color.FromArgb(221, 231, 224));
        _pathValue.AutoEllipsis = true;
        _pathValue.Location = new Point(14, 10);
        _pathValue.Size = new Size(230, 28);
        pathPanel.Controls.Add(_pathValue);

        _browseButton = new RoundedButton
        {
            CornerRadius = 10,
            BorderColor = Color.FromArgb(61, 95, 73),
            FillColor = Color.FromArgb(37, 58, 46),
            Font = CreateFont(8.5F, FontStyle.Bold),
            ForeColor = Color.FromArgb(224, 234, 227),
            Location = new Point(300, 160),
            SecondaryFillColor = Color.FromArgb(24, 41, 32),
            Size = new Size(71, 48),
            Text = "변경"
        };
        _browseButton.Click += BrowseButton_Click;
        _card.Controls.Add(_browseButton);

        _desktopShortcut = CreateCheckBox("바탕화면에 바로가기 만들기", true);
        _desktopShortcut.Location = new Point(34, 229);
        _desktopShortcut.Size = new Size(330, 28);
        _card.Controls.Add(_desktopShortcut);

        _launchAfterInstall = CreateCheckBox("설치가 끝나면 RSLauncher 실행", true);
        _launchAfterInstall.Location = new Point(34, 265);
        _launchAfterInstall.Size = new Size(330, 28);
        _card.Controls.Add(_launchAfterInstall);

        var infoPanel = new RoundedPanel
        {
            BackColor = Color.FromArgb(17, 32, 23),
            BorderColor = Color.FromArgb(53, 83, 65),
            CornerRadius = 12,
            InnerBorderColor = Color.FromArgb(16, 255, 255, 255),
            Location = new Point(34, 312),
            RasterTexture = true,
            SecondaryColor = Color.FromArgb(12, 24, 17),
            Size = new Size(337, 78)
        };
        _card.Controls.Add(infoPanel);

        var infoDot = new Label
        {
            BackColor = Color.FromArgb(77, 200, 99),
            Location = new Point(17, 20),
            Size = new Size(8, 8)
        };
        infoPanel.Controls.Add(infoDot);

        var infoTitle = CreateLabel("기존 버전은 자동으로 정리됩니다", 9F, FontStyle.Bold, Color.FromArgb(232, 240, 235));
        infoTitle.Location = new Point(35, 13);
        infoTitle.Size = new Size(280, 24);
        infoPanel.Controls.Add(infoTitle);

        var infoText = CreateLabel("설정과 로그인 정보는 그대로 유지됩니다.", 8.5F, FontStyle.Regular, Color.FromArgb(152, 169, 158));
        infoText.Location = new Point(35, 41);
        infoText.Size = new Size(280, 23);
        infoPanel.Controls.Add(infoText);

        _statusLabel = CreateLabel("설치 준비가 완료되었습니다.", 8.5F, FontStyle.Regular, Color.FromArgb(164, 182, 170));
        _statusLabel.Location = new Point(34, 405);
        _statusLabel.Size = new Size(337, 24);
        _card.Controls.Add(_statusLabel);

        _progressTrack = new Panel
        {
            BackColor = Color.FromArgb(35, 49, 40),
            Location = new Point(34, 435),
            Size = new Size(337, 4),
            Visible = false
        };
        _card.Controls.Add(_progressTrack);

        _progressFill = new Panel
        {
            BackColor = Color.FromArgb(75, 201, 99),
            Location = new Point(0, 0),
            Size = new Size(86, 4)
        };
        _progressTrack.Controls.Add(_progressFill);

        _installButton = new RoundedButton
        {
            BorderColor = Color.FromArgb(116, 231, 143),
            CornerRadius = 13,
            FillColor = Color.FromArgb(84, 210, 112),
            Font = CreateFont(10.5F, FontStyle.Bold),
            ForeColor = Color.White,
            Location = new Point(34, 461),
            SecondaryFillColor = Color.FromArgb(50, 164, 76),
            Size = new Size(337, 54),
            Text = "설치하기"
        };
        _installButton.HoverBackColor = Color.FromArgb(96, 224, 123);
        _installButton.PressedBackColor = Color.FromArgb(55, 170, 79);
        _installButton.Click += InstallButton_Click;
        _card.Controls.Add(_installButton);

        _closeButton = CreateWindowButton("×", new Point(932, 10));
        _closeButton.Font = new Font("Segoe UI", 16F, FontStyle.Regular, GraphicsUnit.Point);
        _closeButton.Click += (_, _) =>
        {
            if (!_installing)
            {
                Close();
            }
        };
        Controls.Add(_closeButton);

        var minimizeButton = CreateWindowButton("—", new Point(890, 10));
        minimizeButton.Font = new Font("Segoe UI", 11F, FontStyle.Regular, GraphicsUnit.Point);
        minimizeButton.Click += (_, _) => WindowState = FormWindowState.Minimized;
        Controls.Add(minimizeButton);

        _progressTimer = new System.Windows.Forms.Timer { Interval = 18 };
        _progressTimer.Tick += (_, _) =>
        {
            _progressPosition += 5;
            if (_progressPosition > _progressTrack.Width)
            {
                _progressPosition = -_progressFill.Width;
            }
            _progressFill.Left = _progressPosition;
        };

        FormClosing += InstallerForm_FormClosing;
        KeyDown += (_, eventArgs) =>
        {
            if (eventArgs.KeyCode == Keys.Escape && !_installing)
            {
                Close();
            }
        };
        Shown += InstallerForm_Shown;
        ResumeLayout(false);
    }

    protected override CreateParams CreateParams
    {
        get
        {
            const int CsDropShadow = 0x00020000;
            var parameters = base.CreateParams;
            parameters.ClassStyle |= CsDropShadow;
            return parameters;
        }
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        base.OnPaint(eventArgs);
        eventArgs.Graphics.CompositingQuality = CompositingQuality.HighQuality;
        eventArgs.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        eventArgs.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        eventArgs.Graphics.SmoothingMode = SmoothingMode.HighQuality;

        DrawCoverImage(eventArgs.Graphics, _backgroundImage, ClientRectangle, 0.5F, 0.5F);

        using var shade = new LinearGradientBrush(
            ClientRectangle,
            Color.FromArgb(55, 2, 8, 6),
            Color.FromArgb(168, 2, 9, 6),
            LinearGradientMode.Horizontal);
        eventArgs.Graphics.FillRectangle(shade, ClientRectangle);

        using var topShade = new LinearGradientBrush(
            ClientRectangle,
            Color.FromArgb(18, 0, 0, 0),
            Color.FromArgb(102, 0, 0, 0),
            LinearGradientMode.Vertical);
        eventArgs.Graphics.FillRectangle(topShade, ClientRectangle);

        DrawRasterTexture(eventArgs.Graphics, new Rectangle(0, 0, 530, ClientSize.Height));

        if (_card is not null)
        {
            var shadowBounds = new Rectangle(_card.Left + 9, _card.Top + 11, _card.Width, _card.Height);
            using var shadowPath = RoundedPanel.CreateRoundedPath(shadowBounds, _card.CornerRadius + 2);
            using var shadowBrush = new SolidBrush(Color.FromArgb(105, 0, 0, 0));
            eventArgs.Graphics.FillPath(shadowBrush, shadowPath);
        }

        using var frame = new Pen(Color.FromArgb(70, 124, 167, 142), 1F);
        eventArgs.Graphics.DrawRectangle(frame, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _progressTimer.Dispose();
            _backgroundImage.Dispose();
            _logoImage.Dispose();
        }
        base.Dispose(disposing);
    }

    private void AddBrandArea()
    {
        var logo = new PictureBox
        {
            BackColor = Color.Transparent,
            Image = _logoImage,
            Location = new Point(64, 82),
            Size = new Size(116, 116),
            SizeMode = PictureBoxSizeMode.Zoom
        };
        AttachDragHandler(logo);
        Controls.Add(logo);

        var eyebrow = CreateLabel("MINECRAFT LAUNCHER", 9F, FontStyle.Bold, Color.FromArgb(156, 216, 168));
        eyebrow.Location = new Point(68, 222);
        eyebrow.Size = new Size(350, 25);
        AttachDragHandler(eyebrow);
        Controls.Add(eyebrow);

        var title = CreateLabel("RSLauncher", 30F, FontStyle.Bold, Color.White);
        title.Location = new Point(62, 248);
        title.Size = new Size(420, 62);
        AttachDragHandler(title);
        Controls.Add(title);

        var slogan = CreateLabel("새로운 세계로 떠날 준비를 시작하세요.", 11F, FontStyle.Regular, Color.FromArgb(218, 231, 222));
        slogan.Location = new Point(68, 316);
        slogan.Size = new Size(410, 33);
        AttachDragHandler(slogan);
        Controls.Add(slogan);

        var accent = new PixelAccent
        {
            AccentColor = Color.FromArgb(91, 220, 123),
            BackColor = Color.Transparent,
            Location = new Point(68, 368),
            Size = new Size(64, 7)
        };
        Controls.Add(accent);

        var features = CreateLabel("빠른 설치   ·   자동 업데이트   ·   서버팩 자동 구성", 9F, FontStyle.Regular, Color.FromArgb(177, 198, 184));
        features.Location = new Point(68, 395);
        features.Size = new Size(430, 28);
        AttachDragHandler(features);
        Controls.Add(features);

        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
        var versionLabel = CreateLabel($"VERSION {version}   •   WINDOWS 64-BIT", 8F, FontStyle.Bold, Color.FromArgb(139, 158, 145));
        versionLabel.Location = new Point(68, 548);
        versionLabel.Size = new Size(360, 24);
        AttachDragHandler(versionLabel);
        Controls.Add(versionLabel);
    }

    private async void InstallButton_Click(object? sender, EventArgs eventArgs)
    {
        if (_installed)
        {
            LaunchInstalledLauncher();
            Close();
            return;
        }

        if (_installing)
        {
            return;
        }

        try
        {
            SetInstallingState(true);
            _statusLabel.Text = "설치파일을 준비하고 있습니다...";

            var temporaryDirectory = Path.Combine(
                Path.GetTempPath(),
                "RSLauncher-Installer",
                Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temporaryDirectory);
            var setupPath = Path.Combine(temporaryDirectory, "RSLauncher-setup-Windows.exe");

            try
            {
                await ExtractInstallerAsync(setupPath);
                _statusLabel.Text = "RSLauncher를 설치하고 있습니다...";

                var startInfo = new ProcessStartInfo
                {
                    FileName = setupPath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                startInfo.ArgumentList.Add("/S");
                startInfo.ArgumentList.Add("/currentuser");
                startInfo.ArgumentList.Add($"/D={_installPath}");

                using var installer = Process.Start(startInfo)
                    ?? throw new InvalidOperationException("내부 설치 프로그램을 시작하지 못했습니다.");
                await installer.WaitForExitAsync();

                if (installer.ExitCode != 0)
                {
                    throw new InvalidOperationException($"설치 프로그램이 오류 코드 {installer.ExitCode}로 종료되었습니다.");
                }

                ApplyShortcutPreference();
                ShowCompletedState();

                if (_launchAfterInstall.Checked)
                {
                    LaunchInstalledLauncher();
                }

                await Task.Delay(650);
                Close();
            }
            finally
            {
                TryDeleteDirectory(temporaryDirectory);
            }
        }
        catch (Exception exception)
        {
            _statusLabel.Text = "설치하지 못했습니다. 다시 시도해 주세요.";
            MessageBox.Show(
                this,
                exception.Message,
                "RSLauncher 설치 오류",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            SetInstallingState(false);
        }
    }

    private void BrowseButton_Click(object? sender, EventArgs eventArgs)
    {
        using var browser = new FolderBrowserDialog
        {
            Description = "RSLauncher를 설치할 폴더를 선택해 주세요.",
            InitialDirectory = Directory.Exists(_installPath)
                ? _installPath
                : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            ShowNewFolderButton = true,
            UseDescriptionForTitle = true
        };

        if (browser.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        _installPath = EnsureLauncherDirectory(browser.SelectedPath);
        _pathValue.Text = _installPath;
    }

    private void SetInstallingState(bool installing)
    {
        _installing = installing;
        _browseButton.Enabled = !installing;
        _desktopShortcut.Enabled = !installing;
        _launchAfterInstall.Enabled = !installing;
        _installButton.Enabled = !installing;
        _closeButton.Enabled = !installing;
        _progressTrack.Visible = installing;

        if (installing)
        {
            _installButton.Text = "설치 중...";
            _progressPosition = -_progressFill.Width;
            _progressTimer.Start();
        }
        else
        {
            _installButton.Text = "다시 시도";
            _progressTimer.Stop();
            _progressTrack.Visible = false;
        }
    }

    private void ShowCompletedState()
    {
        _installing = false;
        _installed = true;
        _progressTimer.Stop();
        _progressFill.Left = 0;
        _progressFill.Width = _progressTrack.Width;
        _progressTrack.Visible = true;
        _statusLabel.Text = "설치가 완료되었습니다.";
        _installButton.Enabled = true;
        _installButton.Text = "RSLauncher 실행";
        _closeButton.Enabled = true;
    }

    private async Task ExtractInstallerAsync(string destination)
    {
        await using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("RSLauncherSetup.exe")
            ?? throw new InvalidOperationException("내부 설치파일을 찾지 못했습니다.");
        await using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1024 * 1024, true);
        await resource.CopyToAsync(output);
    }

    private void ApplyShortcutPreference()
    {
        if (_desktopShortcut.Checked)
        {
            return;
        }

        foreach (var desktop in new[]
                 {
                     Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                     Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
                 })
        {
            if (string.IsNullOrWhiteSpace(desktop))
            {
                continue;
            }

            var shortcut = Path.Combine(desktop, "RSLauncher.lnk");
            if (File.Exists(shortcut))
            {
                try
                {
                    File.Delete(shortcut);
                }
                catch
                {
                    // Installation succeeded. A locked shortcut should not turn it into a failure.
                }
            }
        }
    }

    private void LaunchInstalledLauncher()
    {
        var launcherPath = Path.Combine(_installPath, "RSLauncher.exe");
        if (!File.Exists(launcherPath))
        {
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = launcherPath,
            WorkingDirectory = _installPath,
            UseShellExecute = true
        });
    }

    private void InstallerForm_Shown(object? sender, EventArgs eventArgs)
    {
        var cornerPreference = DwmWindowCornerRound;
        _ = DwmSetWindowAttribute(
            Handle,
            DwmWindowCornerPreference,
            ref cornerPreference,
            Marshal.SizeOf<int>());
    }

    private void InstallerForm_FormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        if (_installing)
        {
            eventArgs.Cancel = true;
        }
    }

    private void AttachDragHandler(Control control)
    {
        control.MouseDown += DragWindow;
    }

    private void DragWindow(object? sender, MouseEventArgs eventArgs)
    {
        if (eventArgs.Button != MouseButtons.Left)
        {
            return;
        }

        ReleaseCapture();
        SendMessage(Handle, WmNclButtonDown, HtCaption, 0);
    }

    private static string EnsureLauncherDirectory(string selectedPath)
    {
        var trimmed = selectedPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return string.Equals(Path.GetFileName(trimmed), "RSLauncher", StringComparison.OrdinalIgnoreCase)
            ? trimmed
            : Path.Combine(trimmed, "RSLauncher");
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, true);
            }
        }
        catch
        {
            // Windows can briefly keep the extracted installer open after it exits.
        }
    }

    private static Image LoadImageResource(string resourceName)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"이미지 리소스를 찾지 못했습니다: {resourceName}");
        using var image = Image.FromStream(stream);
        return new Bitmap(image);
    }

    private static Label CreateLabel(string text, float size, FontStyle style, Color color)
    {
        return new Label
        {
            AutoSize = false,
            BackColor = Color.Transparent,
            Font = CreateFont(size, style),
            ForeColor = color,
            Text = text,
            TextAlign = ContentAlignment.MiddleLeft
        };
    }

    private static StyledCheckBox CreateCheckBox(string text, bool isChecked)
    {
        return new StyledCheckBox
        {
            AutoSize = false,
            BackColor = Color.Transparent,
            Checked = isChecked,
            Font = CreateFont(9F, FontStyle.Regular),
            ForeColor = Color.FromArgb(217, 228, 220),
            Text = text
        };
    }

    private static RoundedButton CreateWindowButton(string text, Point location)
    {
        return new RoundedButton
        {
            BorderColor = Color.FromArgb(56, 85, 68),
            CornerRadius = 9,
            FillColor = Color.FromArgb(22, 35, 27),
            ForeColor = Color.FromArgb(221, 231, 224),
            HoverBackColor = Color.FromArgb(49, 60, 52),
            Location = location,
            PressedBackColor = Color.FromArgb(60, 73, 63),
            SecondaryFillColor = Color.FromArgb(12, 23, 17),
            Size = new Size(34, 34),
            Text = text
        };
    }

    private static Font CreateFont(float size, FontStyle style)
    {
        return new Font("맑은 고딕", size, style, GraphicsUnit.Point);
    }

    private static void DrawCoverImage(Graphics graphics, Image image, Rectangle target, float focusX, float focusY)
    {
        var scale = Math.Max((float)target.Width / image.Width, (float)target.Height / image.Height);
        var sourceWidth = target.Width / scale;
        var sourceHeight = target.Height / scale;
        var sourceX = Math.Clamp((image.Width * focusX) - (sourceWidth / 2), 0, image.Width - sourceWidth);
        var sourceY = Math.Clamp((image.Height * focusY) - (sourceHeight / 2), 0, image.Height - sourceHeight);

        graphics.DrawImage(
            image,
            target,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            GraphicsUnit.Pixel);
    }

    private static void DrawRasterTexture(Graphics graphics, Rectangle bounds)
    {
        using var lightPixel = new SolidBrush(Color.FromArgb(13, 186, 228, 202));
        using var darkPixel = new SolidBrush(Color.FromArgb(12, 0, 0, 0));

        for (var y = bounds.Top + 9; y < bounds.Bottom; y += 7)
        {
            for (var x = bounds.Left + 9; x < bounds.Right; x += 7)
            {
                var hash = ((x / 7) * 17) + ((y / 7) * 31);
                if (hash % 23 == 0)
                {
                    graphics.FillRectangle(lightPixel, x, y, 1, 1);
                }
                else if (hash % 29 == 0)
                {
                    graphics.FillRectangle(darkPixel, x, y, 1, 1);
                }
            }
        }
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, int message, int parameter, int data);

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int valueSize);
}

internal sealed class RoundedPanel : Panel
{
    public int CornerRadius { get; set; } = 12;
    public Color BorderColor { get; set; } = Color.Transparent;
    public Color InnerBorderColor { get; set; } = Color.Transparent;
    public bool RasterTexture { get; set; }
    public Color SecondaryColor { get; set; } = Color.Empty;

    public RoundedPanel()
    {
        DoubleBuffered = true;
        ResizeRedraw = true;
    }

    protected override void OnResize(EventArgs eventArgs)
    {
        base.OnResize(eventArgs);
        if (Width <= 0 || Height <= 0)
        {
            return;
        }

        using var path = CreateRoundedPath(ClientRectangle, CornerRadius);
        var previousRegion = Region;
        Region = new Region(path);
        previousRegion?.Dispose();
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var bounds = new Rectangle(0, 0, Width - 1, Height - 1);
        using var path = CreateRoundedPath(bounds, CornerRadius);
        if (SecondaryColor == Color.Empty)
        {
            using var background = new SolidBrush(BackColor);
            eventArgs.Graphics.FillPath(background, path);
        }
        else
        {
            using var background = new LinearGradientBrush(bounds, BackColor, SecondaryColor, LinearGradientMode.Vertical);
            eventArgs.Graphics.FillPath(background, path);
        }

        if (RasterTexture)
        {
            var previousClip = eventArgs.Graphics.Clip;
            eventArgs.Graphics.SetClip(path);
            using var pixelBrush = new SolidBrush(Color.FromArgb(11, 191, 224, 202));
            for (var y = 10; y < Height; y += 8)
            {
                for (var x = 10; x < Width; x += 8)
                {
                    if ((((x / 8) * 13) + ((y / 8) * 19)) % 31 == 0)
                    {
                        eventArgs.Graphics.FillRectangle(pixelBrush, x, y, 1, 1);
                    }
                }
            }
            eventArgs.Graphics.Clip = previousClip;
            previousClip.Dispose();
        }

        if (InnerBorderColor.A > 0 && Width > 4 && Height > 4)
        {
            using var innerPath = CreateRoundedPath(new Rectangle(2, 2, Width - 5, Height - 5), Math.Max(2, CornerRadius - 2));
            using var innerBorder = new Pen(InnerBorderColor, 1F);
            eventArgs.Graphics.DrawPath(innerBorder, innerPath);
        }

        if (BorderColor.A > 0)
        {
            using var border = new Pen(BorderColor, 1F);
            eventArgs.Graphics.DrawPath(border, path);
        }
    }

    internal static GraphicsPath CreateRoundedPath(Rectangle bounds, int radius)
    {
        var diameter = Math.Max(2, radius * 2);
        var path = new GraphicsPath();
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}

internal sealed class RoundedButton : Control
{
    public int CornerRadius { get; set; } = 10;
    public Color BorderColor { get; set; } = Color.Transparent;
    public Color FillColor { get; set; } = Color.FromArgb(42, 55, 46);
    public Color HoverBackColor { get; set; } = Color.Empty;
    public Color PressedBackColor { get; set; } = Color.Empty;
    public Color SecondaryFillColor { get; set; } = Color.Empty;

    private bool _hovered;
    private bool _pressed;

    public RoundedButton()
    {
        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.ResizeRedraw |
            ControlStyles.SupportsTransparentBackColor |
            ControlStyles.UserPaint,
            true);
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
        TabStop = true;
    }

    protected override void OnMouseEnter(EventArgs eventArgs)
    {
        _hovered = true;
        Invalidate();
        base.OnMouseEnter(eventArgs);
    }

    protected override void OnMouseLeave(EventArgs eventArgs)
    {
        _hovered = false;
        _pressed = false;
        Invalidate();
        base.OnMouseLeave(eventArgs);
    }

    protected override void OnMouseDown(MouseEventArgs eventArgs)
    {
        _pressed = true;
        Invalidate();
        base.OnMouseDown(eventArgs);
    }

    protected override void OnMouseUp(MouseEventArgs eventArgs)
    {
        _pressed = false;
        Invalidate();
        base.OnMouseUp(eventArgs);
    }

    protected override void OnPaintBackground(PaintEventArgs eventArgs)
    {
        base.OnPaintBackground(eventArgs);
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var color = FillColor;
        if (!Enabled)
        {
            color = Color.FromArgb(95, FillColor);
        }
        else if (_pressed && PressedBackColor != Color.Empty)
        {
            color = PressedBackColor;
        }
        else if (_hovered && HoverBackColor != Color.Empty)
        {
            color = HoverBackColor;
        }

        using var path = RoundedPanel.CreateRoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), CornerRadius);
        var secondary = SecondaryFillColor == Color.Empty ? color : SecondaryFillColor;
        if ((_hovered && HoverBackColor != Color.Empty) || (_pressed && PressedBackColor != Color.Empty))
        {
            secondary = Color.FromArgb(
                color.A,
                Math.Max(0, color.R - 18),
                Math.Max(0, color.G - 18),
                Math.Max(0, color.B - 18));
        }

        using var background = new LinearGradientBrush(ClientRectangle, color, secondary, LinearGradientMode.Vertical);
        eventArgs.Graphics.FillPath(background, path);

        if (BorderColor.A > 0)
        {
            using var border = new Pen(BorderColor, 1F);
            eventArgs.Graphics.DrawPath(border, path);
        }

        using var shine = new Pen(Color.FromArgb(32, 255, 255, 255), 1F);
        eventArgs.Graphics.DrawLine(shine, CornerRadius, 1, Math.Max(CornerRadius, Width - CornerRadius), 1);

        var textBounds = new Rectangle(0, 1, Width, Math.Max(1, Height - 1));
        TextRenderer.DrawText(
            eventArgs.Graphics,
            Text,
            Font,
            textBounds,
            Enabled ? ForeColor : Color.FromArgb(135, ForeColor),
            TextFormatFlags.HorizontalCenter |
            TextFormatFlags.VerticalCenter |
            TextFormatFlags.SingleLine |
            TextFormatFlags.NoPadding);
    }
}

internal sealed class StyledCheckBox : Control
{
    private bool _checked;
    private bool _hovered;

    public bool Checked
    {
        get => _checked;
        set
        {
            if (_checked == value)
            {
                return;
            }

            _checked = value;
            Invalidate();
            CheckedChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public event EventHandler? CheckedChanged;

    public StyledCheckBox()
    {
        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.ResizeRedraw |
            ControlStyles.SupportsTransparentBackColor |
            ControlStyles.UserPaint,
            true);
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
        TabStop = true;
    }

    protected override void OnMouseEnter(EventArgs eventArgs)
    {
        _hovered = true;
        Invalidate();
        base.OnMouseEnter(eventArgs);
    }

    protected override void OnMouseLeave(EventArgs eventArgs)
    {
        _hovered = false;
        Invalidate();
        base.OnMouseLeave(eventArgs);
    }

    protected override void OnMouseUp(MouseEventArgs eventArgs)
    {
        base.OnMouseUp(eventArgs);
        if (eventArgs.Button == MouseButtons.Left && Enabled)
        {
            Checked = !Checked;
        }
    }

    protected override void OnKeyDown(KeyEventArgs eventArgs)
    {
        base.OnKeyDown(eventArgs);
        if (Enabled && (eventArgs.KeyCode == Keys.Space || eventArgs.KeyCode == Keys.Enter))
        {
            Checked = !Checked;
            eventArgs.Handled = true;
        }
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var boxSize = 18;
        var boxBounds = new Rectangle(0, (Height - boxSize) / 2, boxSize, boxSize);
        using var boxPath = RoundedPanel.CreateRoundedPath(boxBounds, 5);

        var topColor = Checked
            ? (_hovered ? Color.FromArgb(96, 222, 124) : Color.FromArgb(78, 202, 105))
            : (_hovered ? Color.FromArgb(35, 54, 43) : Color.FromArgb(24, 39, 31));
        var bottomColor = Checked ? Color.FromArgb(48, 159, 75) : Color.FromArgb(14, 27, 20);
        using var fill = new LinearGradientBrush(boxBounds, topColor, bottomColor, LinearGradientMode.Vertical);
        eventArgs.Graphics.FillPath(fill, boxPath);

        using var border = new Pen(
            Checked ? Color.FromArgb(123, 235, 149) : Color.FromArgb(72, 101, 83),
            1F);
        eventArgs.Graphics.DrawPath(border, boxPath);

        if (Checked)
        {
            using var tick = new Pen(Color.White, 2F)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round
            };
            eventArgs.Graphics.DrawLines(tick, new[]
            {
                new Point(4, boxBounds.Top + 9),
                new Point(8, boxBounds.Top + 13),
                new Point(14, boxBounds.Top + 5)
            });
        }

        var textBounds = new Rectangle(30, 0, Math.Max(1, Width - 30), Height);
        TextRenderer.DrawText(
            eventArgs.Graphics,
            Text,
            Font,
            textBounds,
            Enabled ? ForeColor : Color.FromArgb(120, ForeColor),
            TextFormatFlags.Left |
            TextFormatFlags.VerticalCenter |
            TextFormatFlags.SingleLine |
            TextFormatFlags.NoPadding);
    }
}

internal sealed class PixelAccent : Control
{
    public Color AccentColor { get; set; } = Color.FromArgb(91, 220, 123);

    public PixelAccent()
    {
        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.SupportsTransparentBackColor |
            ControlStyles.UserPaint,
            true);
        BackColor = Color.Transparent;
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        var widths = new[] { 23, 14, 9, 5 };
        var opacity = new[] { 255, 190, 120, 70 };
        var x = 0;
        for (var index = 0; index < widths.Length; index++)
        {
            using var brush = new SolidBrush(Color.FromArgb(opacity[index], AccentColor));
            eventArgs.Graphics.FillRectangle(brush, x, 1, widths[index], 4);
            x += widths[index] + 3;
        }
    }
}
