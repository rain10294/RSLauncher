using System.Text.Json;
using CmlLib.Core.Auth.Microsoft;
using CmlLib.Core.Auth.Microsoft.Sessions;
using XboxAuthNet.Game.Accounts;
using XboxAuthNet.Game.OAuth;

namespace RSLauncher.Auth;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        try
        {
            var command = args.FirstOrDefault()?.ToLowerInvariant();
            if (command == "self-test")
            {
                WriteJson(new { success = true, version = typeof(JELoginHandler).Assembly.GetName().Version?.ToString() });
                return 0;
            }

            var options = ParseOptions(args.Skip(1));
            var accountFile = Path.GetFullPath(RequiredOption(options, "account-file"));
            var useDefaultClient = options.TryGetValue("use-default-client", out var defaultClientValue)
                && bool.TryParse(defaultClientValue, out var defaultClientEnabled)
                && defaultClientEnabled;
            var clientId = useDefaultClient ? null : RequiredOption(options, "client-id");

            if (!useDefaultClient && !Guid.TryParse(clientId, out _))
                throw new ArgumentException("Microsoft Client ID 형식이 올바르지 않습니다.");

            Directory.CreateDirectory(Path.GetDirectoryName(accountFile)
                ?? throw new ArgumentException("계정 파일 경로가 올바르지 않습니다."));

            var loginHandler = CreateLoginHandler(clientId, accountFile, useDefaultClient);
            return command switch
            {
                "login" => await Login(loginHandler),
                "refresh" => await Refresh(loginHandler, RequiredOption(options, "uuid")),
                "logout" => await Logout(loginHandler, RequiredOption(options, "uuid")),
                "validate-config" => ValidateConfiguration(useDefaultClient),
                _ => throw new ArgumentException("지원하지 않는 인증 명령입니다.")
            };
        }
        catch (Exception ex)
        {
            var error = ToSafeError(ex);
            WriteJson(new { success = false, error });
            return 1;
        }
    }

    private static JELoginHandler CreateLoginHandler(string? clientId, string accountFile, bool useDefaultClient)
    {
        var builder = new JELoginHandlerBuilder()
            .WithAccountManager(accountFile);

        if (useDefaultClient)
        {
            // Temporary mode while the launcher's own Azure Client ID is waiting
            // for Minecraft API approval. JELoginHandlerBuilder supplies its
            // built-in WebView2 OAuth provider.
            return builder.Build();
        }

        var clientInfo = new MicrosoftOAuthClientInfo(
            clientId!,
            JELoginHandler.DefaultMicrosoftOAuthClientInfo.Scopes);

        return builder
            .WithOAuthProvider(new MicrosoftOAuthCodeFlowProvider(clientInfo))
            .Build();
    }

    private static async Task<int> Login(JELoginHandler loginHandler)
    {
        var session = await loginHandler.AuthenticateInteractively();
        WriteJson(new { success = true, account = CreateAccountResult(loginHandler, session.UUID) });
        return 0;
    }

    private static int ValidateConfiguration(bool useDefaultClient)
    {
        WriteJson(new
        {
            success = true,
            authenticationMode = useDefaultClient ? "cmllib-default" : "custom-client-id"
        });
        return 0;
    }

    private static async Task<int> Refresh(JELoginHandler loginHandler, string uuid)
    {
        var account = FindAccount(loginHandler.AccountManager, uuid);
        var session = await loginHandler.Authenticate(account);
        WriteJson(new { success = true, account = CreateAccountResult(loginHandler, session.UUID) });
        return 0;
    }

    private static async Task<int> Logout(JELoginHandler loginHandler, string uuid)
    {
        var account = FindAccount(loginHandler.AccountManager, uuid);
        await loginHandler.Signout(account);
        WriteJson(new { success = true });
        return 0;
    }

    private static IXboxGameAccount FindAccount(IXboxGameAccountManager accountManager, string uuid)
    {
        var normalizedUuid = NormalizeUuid(uuid);
        var account = accountManager.GetAccounts().FirstOrDefault(candidate =>
            NormalizeUuid(candidate.Identifier) == normalizedUuid);

        return account ?? throw new InvalidOperationException("저장된 Microsoft 계정을 찾을 수 없습니다.");
    }

    private static object CreateAccountResult(JELoginHandler loginHandler, string? uuid)
    {
        if (string.IsNullOrWhiteSpace(uuid))
            throw new InvalidOperationException("Minecraft 프로필 UUID를 받지 못했습니다.");

        var account = FindAccount(loginHandler.AccountManager, uuid) as JEGameAccount
            ?? throw new InvalidOperationException("Minecraft 계정 정보를 읽지 못했습니다.");
        var profile = account.Profile
            ?? throw new InvalidOperationException("Minecraft 프로필을 읽지 못했습니다.");
        var token = account.Token
            ?? throw new InvalidOperationException("Minecraft 인증 토큰을 읽지 못했습니다.");

        if (string.IsNullOrWhiteSpace(profile.Username) || string.IsNullOrWhiteSpace(token.AccessToken))
            throw new InvalidOperationException("Minecraft 계정 정보가 완전하지 않습니다.");

        return new
        {
            uuid = NormalizeUuid(profile.UUID),
            username = profile.Username,
            accessToken = token.AccessToken,
            expiresAt = new DateTimeOffset(token.ExpiresOn.ToUniversalTime()).ToUnixTimeMilliseconds()
        };
    }

    private static Dictionary<string, string> ParseOptions(IEnumerable<string> args)
    {
        var values = args.ToArray();
        var options = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        for (var index = 0; index < values.Length; index += 2)
        {
            if (index + 1 >= values.Length || !values[index].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException("인증 도우미 인수가 올바르지 않습니다.");

            options[values[index][2..]] = values[index + 1];
        }

        return options;
    }

    private static string RequiredOption(IReadOnlyDictionary<string, string> options, string name)
    {
        if (!options.TryGetValue(name, out var value) || string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"필수 설정이 없습니다: {name}");
        return value;
    }

    private static string NormalizeUuid(string? uuid) =>
        (uuid ?? string.Empty).Replace("-", string.Empty, StringComparison.Ordinal).Trim().ToLowerInvariant();

    private static object ToSafeError(Exception exception)
    {
        var root = exception;
        while (root.InnerException != null)
            root = root.InnerException;

        if (root is OperationCanceledException)
            return new { code = "cancelled", message = "Microsoft 로그인이 취소되었습니다." };

        if (root is HttpRequestException)
            return new { code = "network", message = "Microsoft 인증 서버에 연결하지 못했습니다." };

        if (root is JEAuthException jeError)
        {
            var message = jeError.Message.Contains("doesn't own", StringComparison.OrdinalIgnoreCase)
                ? "이 Microsoft 계정에는 Minecraft Java Edition 이용 권한이 없습니다."
                : "Minecraft 계정 인증에 실패했습니다. Azure 승인 상태와 계정 권한을 확인해주세요.";
            return new { code = "minecraft_auth", message };
        }

        if (root is ArgumentException or InvalidOperationException)
            return new { code = "configuration", message = root.Message };

        return new { code = "microsoft_auth", message = "Microsoft 로그인에 실패했습니다. Azure 승인 전에는 Minecraft 인증 단계에서 실패할 수 있습니다." };
    }

    private static void WriteJson(object value) =>
        Console.Out.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
}
