using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var dataRoot = Environment.GetEnvironmentVariable("CALCULUS_DATA") ?? Path.Combine(AppContext.BaseDirectory, "Data");
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
    var entry = new RunRecord(DateTimeOffset.Now, request.Limit, request.Seconds, request.Correct, request.Incorrect);
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

app.MapDelete("/api/history/{name}", async (string name) =>
{
    name = CleanName(name);
    if (name.Length == 0) return Results.BadRequest();
    await File.WriteAllTextAsync(UserFile(name, "-History.log"), string.Empty);
    return Results.Ok(new { history = Array.Empty<RunRecord>(), best = (RunRecord?)null });
});

app.MapGet("/api/history/{name}", async (string name) =>
{
    name = CleanName(name);
    if (name.Length == 0) return Results.BadRequest();
    var records = await ReadRecords(name);
    var best = records.OrderByDescending(x => x.Correct).ThenBy(x => x.Incorrect).FirstOrDefault();
    return Results.Ok(new { history = records.OrderByDescending(x => x.At).Take(20), best });
});

app.MapFallbackToFile("index.html");
app.Run();

string CleanName(string? value)
{
    var name = Regex.Replace((value ?? "").Trim(), @"[^\p{L}\p{N}_ -]", "");
    name = Regex.Replace(name, @"\s+", " ").Trim(' ', '.', '-');
    return name.Length > 32 ? name[..32] : name;
}

string UserFile(string name, string suffix)
{
    var slug = Regex.Replace(name, @"\s+", "-");
    slug = Regex.Replace(slug, @"[^\p{L}\p{N}_-]+", "_").Trim('_');
    return Path.Combine(dataRoot, slug + suffix);
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
record RunRecord(DateTimeOffset At, int Limit, int Seconds, int Correct, int Incorrect);
