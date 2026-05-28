using System.Threading.RateLimiting;
using FreightCheckIn.Api.Dtos;
using FreightCheckIn.Api.Infrastructure;
using FreightCheckIn.Api.Options;
using FreightCheckIn.Api.Services;
using FreightCheckIn.Api.Workers;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services.Configure<PublicAppOptions>(builder.Configuration.GetSection("PublicApp"));
builder.Services.Configure<GeofenceOptions>(builder.Configuration.GetSection("Geofence"));
builder.Services.Configure<AzureCommunicationServicesOptions>(builder.Configuration.GetSection("AzureCommunicationServices"));
builder.Services.Configure<ServiceBusOptions>(builder.Configuration.GetSection("ServiceBus"));
builder.Services.Configure<AzureBlobStorageOptions>(builder.Configuration.GetSection("AzureBlobStorage"));
builder.Services.Configure<TeamsBotOptions>(builder.Configuration.GetSection("TeamsBot"));

builder.Services.PostConfigure<PublicAppOptions>(options =>
{
    options.BaseUrl = Environment.GetEnvironmentVariable("PUBLIC_APP_BASE_URL") ?? options.BaseUrl;
    var cors = Environment.GetEnvironmentVariable("CORS_ORIGIN");
    if (!string.IsNullOrWhiteSpace(cors)) options.CorsOrigins = cors.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
});
builder.Services.PostConfigure<AzureCommunicationServicesOptions>(options =>
{
    options.ConnectionString = Environment.GetEnvironmentVariable("ACS_CONNECTION_STRING") ?? options.ConnectionString;
    options.FromNumber = Environment.GetEnvironmentVariable("ACS_FROM_NUMBER") ?? options.FromNumber;
});
builder.Services.PostConfigure<ServiceBusOptions>(options =>
{
    options.ConnectionString = Environment.GetEnvironmentVariable("SERVICE_BUS_CONNECTION_STRING") ?? options.ConnectionString;
    options.TripEventsQueueName = Environment.GetEnvironmentVariable("TRIP_EVENTS_QUEUE_NAME") ?? options.TripEventsQueueName;
});

builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddCors();
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("public-location", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
        limiterOptions.AutoReplenishment = true;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var databaseConnectionString = builder.Configuration.GetConnectionString("Database") ?? Environment.GetEnvironmentVariable("DATABASE_URL");
if (string.IsNullOrWhiteSpace(databaseConnectionString))
{
    throw new InvalidOperationException("ConnectionStrings:Database or DATABASE_URL is required.");
}

builder.Services.AddSingleton(NpgsqlDataSource.Create(databaseConnectionString));
builder.Services.AddScoped<TripRepository>();
builder.Services.AddScoped<GeofenceService>();
builder.Services.AddScoped<TripService>();
builder.Services.AddScoped<IAcsSmsService, AcsSmsService>();
builder.Services.AddScoped<ITripEventPublisher, ServiceBusTripEventPublisher>();
builder.Services.AddScoped<IBlobDocumentService, BlobDocumentService>();
builder.Services.AddSingleton<ITeamsNotificationService, TeamsNotificationService>();
builder.Services.AddHostedService<TripEventsWorker>();

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        var statusCode = exception switch
        {
            ArgumentException => StatusCodes.Status400BadRequest,
            KeyNotFoundException => StatusCodes.Status404NotFound,
            InvalidOperationException => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError
        };
        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new { error = exception?.Message ?? "Unexpected server error." });
    });
});

app.UseCors(policy =>
{
    var origins = app.Configuration.GetSection("PublicApp:CorsOrigins").Get<string[]>() ?? ["http://localhost:3000"];
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
});
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { service = "freight-checkin-api", ok = true }));

app.MapPost("/api/trips", async (CreateTripRequest request, TripService service, CancellationToken cancellationToken) =>
{
    var trip = await service.CreateTripAsync(request, cancellationToken);
    return Results.Created($"/api/trips/{trip.Id}", trip);
});

app.MapGet("/api/trips/public/{token}", async (string token, TripService service, CancellationToken cancellationToken) =>
{
    var trip = await service.GetPublicTripAsync(token, cancellationToken);
    return trip is null ? Results.NotFound(new { error = "Trip link is invalid or expired." }) : Results.Ok(trip);
});

app.MapPost("/api/trips/public/{token}/location", async (string token, LocationPingRequest request, TripService service, CancellationToken cancellationToken) =>
{
    var response = await service.RecordLocationPingAsync(token, request, cancellationToken);
    return Results.Ok(response);
}).RequireRateLimiting("public-location");

app.MapPost("/api/trips/{tripId:guid}/documents/upload-url", async (Guid tripId, UploadUrlRequest request, TripService service, CancellationToken cancellationToken) =>
{
    var response = await service.CreateUploadUrlAsync(tripId, request, cancellationToken);
    return Results.Ok(response);
});

app.MapPost("/api/trips/{tripId:guid}/documents/complete", async (Guid tripId, CompleteUploadRequest request, TripService service, CancellationToken cancellationToken) =>
{
    await service.CompleteUploadAsync(tripId, request, cancellationToken);
    return Results.Ok(new { status = "UPLOADED" });
});

app.MapPost("/api/trips/{tripId:guid}/actions/{action}", async (Guid tripId, string action, TripActionRequest request, TripService service, CancellationToken cancellationToken) =>
{
    await service.ApplyActionAsync(tripId, action, request.CreatedBy, cancellationToken);
    return Results.Ok(new { status = "accepted" });
});

app.MapPost("/api/teams/actions", async (TeamsCardAction action, TripService service, CancellationToken cancellationToken) =>
{
    await service.ApplyActionAsync(action.TripId, action.Action, action.CreatedBy, cancellationToken);
    return Results.Ok(new { status = "accepted" });
});

app.Run();

public sealed record TeamsCardAction(Guid TripId, string Action, string CreatedBy = "teams-bot");
