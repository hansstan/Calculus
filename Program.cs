using System.Text.Json;
using System.Text.RegularExpressions;
using System.Globalization;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var dataRoot = Environment.GetEnvironmentVariable("CALCULUS_DATA") ?? "/srv/www/data/calculus";
Directory.CreateDirectory(dataRoot);
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/user", async (UserRequest request) =>
{
    var name = CleanName(request.Name);
    if (name.Length == 0) return Results.BadRequest(new { error = "Bitte gib deinen Namen ein." });
    var records = await ReadRecords(name);
    var best = records.OrderByDescending(x => x.Correct).ThenBy(x => x.Incorrect).FirstOrDefault();
    return Results.Ok(new { name, best, history = records.OrderByDescending(x => x.At).Take(20) });
});

app.MapPost("/api/result", async (ResultRequest request) =>
{
    var name = CleanName(request.Name);
    if (name.Length == 0 || request.Limit is not (10 or 20) || request.Seconds < 1 || request.Correct < 0 || request.Incorrect < 0)
        return Results.BadRequest(new { error = "Ungültige Ergebnisdaten." });
    var entry = new RunRecord(DateTimeOffset.Now, request.Limit, request.Seconds, request.Correct, request.Incorrect, name);
    var historyPath = UserFile(name, "-History.log");
    var userPath = UserFile(name, ".log");
    var json = JsonSerializer.Serialize(entry);
    await File.AppendAllTextAsync(historyPath, json + Environment.NewLine);
    var timestamp = entry.At.ToLocalTime().ToString("dd.MM.yyyy HH:mm:ss");
    var size = request.Limit == 10 ? "Einmaleins 1-10" : "Einmaleins 1-20";
    await File.AppendAllTextAsync(userPath, $"{timestamp} <{size}> Zeit {FormatTime(request.Seconds)} richtig {request.Correct} / falsch {request.Incorrect}{Environment.NewLine}");
    var records = await ReadRecords(name);
    var best = records.OrderByDescending(x => x.Correct).ThenBy(x => x.Incorrect).FirstOrDefault();
    return Results.Ok(new { current = entry, best, history = records.OrderByDescending(x => x.At).Take(20) });
});

app.MapPost("/api/prime-result", async (PrimeResultRequest request) =>
{
    var name = CleanName(request.Name);
    if (name.Length == 0 || request.Maximum is < 4 or > 15000 || request.Number is < 2 || request.Number > request.Maximum || request.Factors.Length is < 1 or > 14)
        return Results.BadRequest(new { error = "Ungültige Primfaktorzerlegung." });
    long product = 1;
    var previous = 0;
    foreach (var factor in request.Factors)
    {
        if (!IsPrime(factor) || factor < previous || product > request.Number / factor)
            return Results.BadRequest(new { error = "Ungültige Primfaktorzerlegung." });
        product *= factor;
        previous = factor;
    }
    if (product != request.Number) return Results.BadRequest(new { error = "Die Faktoren ergeben nicht die Ausgangszahl." });
    var timestamp = DateTimeOffset.Now;
    var userPath = UserFile(name, ".log");
    var details = $"Zahlen bis {request.Maximum.ToString("N0", CultureInfo.GetCultureInfo("de-DE"))} · Zahl {request.Number} = {string.Join(" × ", request.Factors)}";
    var logTimestamp = timestamp.ToLocalTime().ToString("dd.MM.yyyy HH:mm:ss");
    await File.AppendAllTextAsync(userPath, $"{logTimestamp} <Primfaktorzerlegung> {details}{Environment.NewLine}");
    return Results.Ok(new { at = timestamp, name, action = "Primfaktorzerlegung", details });
});

app.MapPost("/api/prime-session-result", async (PrimeSessionResultRequest request) =>
{
    var name = CleanName(request.Name);
    if (name.Length == 0 || request.Maximum is < 4 or > 15000 || request.Seconds is < 60 or > 1800 || request.Correct < 0 || request.Incorrect < 0)
        return Results.BadRequest(new { error = "Ungültige Rundendaten." });
    var timestamp = DateTimeOffset.Now;
    var logTimestamp = timestamp.ToLocalTime().ToString("dd.MM.yyyy HH:mm:ss");
    var summary = $"Zahlen bis {request.Maximum.ToString("N0", CultureInfo.GetCultureInfo("de-DE"))} · Zeit {FormatTime(request.Seconds)} richtig {request.Correct} / falsch {request.Incorrect}";
    await File.AppendAllTextAsync(UserFile(name, ".log"), $"{logTimestamp} <Primfaktorzerlegung> {summary}{Environment.NewLine}");
    return Results.Ok(new { at = timestamp, name, action = "Primfaktorzerlegung", details = summary });
});

app.MapPost("/api/reverse-session-result", async (ReverseSessionResultRequest request) =>
{
    var name = CleanName(request.Name);
    if (name.Length == 0 || request.Seconds is < 60 or > 1800 || request.Correct < 0 || request.Incorrect < 0)
        return Results.BadRequest(new { error = "Ungültige Rundendaten." });
    var timestamp = DateTimeOffset.Now;
    var logTimestamp = timestamp.ToLocalTime().ToString("dd.MM.yyyy HH:mm:ss");
    var summary = $"Zeit {FormatTime(request.Seconds)} richtig {request.Correct} / falsch {request.Incorrect}";
    await File.AppendAllTextAsync(UserFile(name, ".log"), $"{logTimestamp} <1x1 Reverse> {summary}{Environment.NewLine}");
    return Results.Ok(new { at = timestamp, name, action = "1x1 Reverse", details = summary });
});

app.MapDelete("/api/history/{name}", async (string name) =>
{
    name = CleanName(name);
    if (name.Length == 0) return Results.BadRequest();
    await File.WriteAllTextAsync(UserFile(name, "-History.log"), string.Empty);
    var timestamp = DateTimeOffset.Now.ToLocalTime().ToString("dd.MM.yyyy HH:mm:ss");
    await File.AppendAllTextAsync(UserFile(name, ".log"), $"{timestamp} <History gelöscht>{Environment.NewLine}");
    return Results.Ok(new { history = Array.Empty<RunRecord>(), best = (RunRecord?)null });
});

app.MapGet("/api/history/{name}", async (string name) =>
{
    name = CleanName(name);
    if (name.Length == 0) return Results.BadRequest();
    var records = await ReadRecords(name);
    var best = records.OrderByDescending(x => x.Correct).ThenBy(x => x.Incorrect).FirstOrDefault();
    return Results.Ok(new { history = records.OrderByDescending(x => x.At), best });
});

app.MapGet("/api/leaderboard", async () =>
{
    var users = new List<UserStanding>();
    foreach (var path in Directory.EnumerateFiles(dataRoot, "*-History.log"))
    {
        var records = new List<RunRecord>();
        foreach (var line in await File.ReadAllLinesAsync(path))
            try { var item = JsonSerializer.Deserialize<RunRecord>(line); if (item is not null) records.Add(item); } catch (JsonException) { }
        if (records.Count == 0) continue;
        var fallbackName = Path.GetFileName(path)[..^"-History.log".Length].Replace('-', ' ');
        var name = records.Select(x => x.Name).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? fallbackName;
        var best = records.OrderByDescending(x => x.Correct).ThenBy(x => x.Incorrect).ThenBy(x => x.At).First();
        users.Add(new UserStanding(name, records.Count, best));
    }
    return Results.Ok(users.OrderByDescending(x => x.Best.Correct).ThenBy(x => x.Best.Incorrect).ThenBy(x => x.Best.At));
});

app.MapGet("/api/overview", async () =>
{
    var activities = new List<ActivityRecord>();
    foreach (var path in Directory.EnumerateFiles(dataRoot, "*.log"))
    {
        var filename = Path.GetFileName(path);
        if (filename.EndsWith("-History.log", StringComparison.OrdinalIgnoreCase)) continue;
        var name = Path.GetFileNameWithoutExtension(path);
        foreach (var line in await File.ReadAllLinesAsync(path))
        {
            var match = Regex.Match(line, @"^(?<at>\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}) <(?<action>[^>]+)>(?:\s*(?<details>.*))?$");
            if (!match.Success || !DateTimeOffset.TryParseExact(match.Groups["at"].Value, "dd.MM.yyyy HH:mm:ss", CultureInfo.GetCultureInfo("de-DE"), DateTimeStyles.AssumeLocal, out var at)) continue;
            var details = match.Groups["details"].Value;
            var result = Regex.Match(details, @"Zeit (?<minutes>\d+):(?<seconds>\d{2}) richtig (?<correct>\d+) / falsch (?<incorrect>\d+)");
            double? correctPerMinute = null;
            double? incorrectPerMinute = null;
            if (result.Success)
            {
                var seconds = int.Parse(result.Groups["minutes"].Value, CultureInfo.InvariantCulture) * 60
                    + int.Parse(result.Groups["seconds"].Value, CultureInfo.InvariantCulture);
                if (seconds > 0)
                {
                    var minutes = seconds / 60d;
                    correctPerMinute = int.Parse(result.Groups["correct"].Value, CultureInfo.InvariantCulture) / minutes;
                    incorrectPerMinute = int.Parse(result.Groups["incorrect"].Value, CultureInfo.InvariantCulture) / minutes;
                }
            }
            activities.Add(new ActivityRecord(at, name, match.Groups["action"].Value, details, correctPerMinute, incorrectPerMinute));
        }
    }
    return Results.Ok(activities.OrderBy(x => x.At).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase));
});

app.MapFallbackToFile("index.html");
app.Run();

string CleanName(string? value)
{
    var name = Regex.Replace((value ?? "").Trim(), @"[^\p{L}\p{N}_ -]", "");
    name = Regex.Replace(name, @"\s+", " ").Trim(' ', '.', '-', '_');
    return name.Length > 32 ? name[..32] : name;
}

string UserFile(string name, string suffix)
{
    var parts = Regex.Split(name, @"[\s_-]+").Where(part => part.Length > 0);
    var pascalName = string.Concat(parts.Select(part =>
    {
        var lower = part.ToLowerInvariant();
        return char.ToUpperInvariant(lower[0]) + lower[1..];
    }));
    return Path.Combine(dataRoot, pascalName + suffix);
}

bool IsPrime(int value)
{
    if (value < 2) return false;
    for (var divisor = 2; divisor * divisor <= value; divisor++)
        if (value % divisor == 0) return false;
    return true;
}

async Task<List<RunRecord>> ReadRecords(string name)
{
    var path = UserFile(name, "-History.log");
    var result = new List<RunRecord>();
    if (!File.Exists(path)) return result;
    foreach (var line in await File.ReadAllLinesAsync(path))
        try { var item = JsonSerializer.Deserialize<RunRecord>(line); if (item is not null) result.Add(item); } catch (JsonException) { }
    return result;
}

string FormatTime(int seconds) => $"{seconds / 60}:{seconds % 60:00}";

record UserRequest(string Name);
record ResultRequest(string Name, int Limit, int Seconds, int Correct, int Incorrect);
record PrimeResultRequest(string Name, int Number, int Maximum, int[] Factors);
record PrimeSessionResultRequest(string Name, int Maximum, int Seconds, int Correct, int Incorrect);
record ReverseSessionResultRequest(string Name, int Seconds, int Correct, int Incorrect);
record RunRecord(DateTimeOffset At, int Limit, int Seconds, int Correct, int Incorrect, string? Name = null);
record UserStanding(string Name, int Attempts, RunRecord Best);
record ActivityRecord(DateTimeOffset At, string Name, string Action, string Details, double? CorrectPerMinute, double? IncorrectPerMinute);
