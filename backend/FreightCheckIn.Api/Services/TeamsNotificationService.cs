using System.Text.Json;
using FreightCheckIn.Api.Options;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Services;

public interface ITeamsNotificationService
{
    Task SendArrivalCardAsync(TripIntegrationEvent integrationEvent, CancellationToken cancellationToken);
}

public sealed class TeamsNotificationService(IOptions<TeamsBotOptions> options, IOptions<PublicAppOptions> publicAppOptions, ILogger<TeamsNotificationService> logger) : ITeamsNotificationService
{
    private readonly TeamsBotOptions _options = options.Value;
    private readonly PublicAppOptions _publicApp = publicAppOptions.Value;

    public Task SendArrivalCardAsync(TripIntegrationEvent integrationEvent, CancellationToken cancellationToken)
    {
        var card = BuildArrivalCard(integrationEvent);
        if (string.IsNullOrWhiteSpace(_options.MicrosoftAppId) || string.IsNullOrWhiteSpace(_options.TargetConversationId))
        {
            logger.LogWarning("Teams Bot notification skipped for trip {TripId}; TeamsBot settings are not configured. Card: {AdaptiveCard}", integrationEvent.TripId, JsonSerializer.Serialize(card));
            return Task.CompletedTask;
        }

        logger.LogInformation("Teams Bot notification prepared for trip {TripId} conversation {ConversationId}", integrationEvent.TripId, _options.TargetConversationId);
        return Task.CompletedTask;
    }

    private object BuildArrivalCard(TripIntegrationEvent integrationEvent)
    {
        var mapUrl = $"{_publicApp.BaseUrl.TrimEnd('/')}/dashboard/{integrationEvent.TripId}";
        return new
        {
            type = "AdaptiveCard",
            version = "1.5",
            body = new object[]
            {
                new { type = "TextBlock", text = "ARRIVAL ALERT", color = "Good", weight = "Bolder", size = "Medium" },
                new { type = "FactSet", facts = new object[]
                {
                    new { title = "Driver", value = integrationEvent.DriverName },
                    new { title = "Trip", value = integrationEvent.TripReference },
                    new { title = "Warehouse", value = integrationEvent.WarehouseName },
                    new { title = "Arrival time", value = integrationEvent.OccurredAt.ToString("u") },
                    new { title = "Distance", value = integrationEvent.DistanceToWarehouseMeters is null ? "Within geofence" : $"{integrationEvent.DistanceToWarehouseMeters} meters" },
                    new { title = "Status", value = "ARRIVED" }
                }}
            },
            actions = new object[]
            {
                new { type = "Action.Submit", title = "Confirm Arrival", data = new { action = "confirm_arrival", tripId = integrationEvent.TripId } },
                new { type = "Action.Submit", title = "Request Documents", data = new { action = "request_documents", tripId = integrationEvent.TripId } },
                new { type = "Action.Submit", title = "Mark Docked", data = new { action = "mark_docked", tripId = integrationEvent.TripId } },
                new { type = "Action.OpenUrl", title = "Open Live Map", url = mapUrl },
                new { type = "Action.OpenUrl", title = "Upload Delivery Documents", url = mapUrl }
            }
        };
    }
}
