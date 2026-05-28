using System.Text.Json;
using Azure.Messaging.ServiceBus;
using FreightCheckIn.Api.Options;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Services;

public sealed record TripIntegrationEvent(
    string EventType,
    Guid TripId,
    string TripReference,
    string DriverName,
    string WarehouseName,
    int? DistanceToWarehouseMeters,
    DateTimeOffset OccurredAt,
    string CorrelationId);

public interface ITripEventPublisher
{
    Task PublishAsync(TripIntegrationEvent integrationEvent, CancellationToken cancellationToken);
}

public sealed class ServiceBusTripEventPublisher(IOptions<ServiceBusOptions> options, ILogger<ServiceBusTripEventPublisher> logger) : ITripEventPublisher
{
    private readonly ServiceBusOptions _options = options.Value;

    public async Task PublishAsync(TripIntegrationEvent integrationEvent, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            logger.LogWarning("Service Bus publish skipped for {EventType} trip {TripId}; SERVICE_BUS_CONNECTION_STRING is not configured", integrationEvent.EventType, integrationEvent.TripId);
            return;
        }

        await using var client = new ServiceBusClient(_options.ConnectionString);
        await using var sender = client.CreateSender(_options.TripEventsQueueName);
        var message = new ServiceBusMessage(BinaryData.FromString(JsonSerializer.Serialize(integrationEvent)))
        {
            MessageId = $"{integrationEvent.EventType}:{integrationEvent.TripId}:{integrationEvent.CorrelationId}",
            CorrelationId = integrationEvent.CorrelationId,
            Subject = integrationEvent.EventType,
            ContentType = "application/json"
        };

        await sender.SendMessageAsync(message, cancellationToken);
        logger.LogInformation("Published {EventType} for trip {TripId} to Service Bus", integrationEvent.EventType, integrationEvent.TripId);
    }
}
