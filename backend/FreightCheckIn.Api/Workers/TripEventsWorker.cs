using System.Text.Json;
using Azure.Messaging.ServiceBus;
using FreightCheckIn.Api.Domain;
using FreightCheckIn.Api.Options;
using FreightCheckIn.Api.Services;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Workers;

public sealed class TripEventsWorker(IOptions<ServiceBusOptions> options, ITeamsNotificationService teamsNotificationService, ILogger<TripEventsWorker> logger) : BackgroundService
{
    private readonly ServiceBusOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            logger.LogWarning("Trip event worker disabled; SERVICE_BUS_CONNECTION_STRING is not configured");
            return;
        }

        await using var client = new ServiceBusClient(_options.ConnectionString);
        await using var processor = client.CreateProcessor(_options.TripEventsQueueName, new ServiceBusProcessorOptions
        {
            AutoCompleteMessages = false,
            MaxConcurrentCalls = 4
        });

        processor.ProcessMessageAsync += async args =>
        {
            var integrationEvent = JsonSerializer.Deserialize<TripIntegrationEvent>(args.Message.Body);
            if (integrationEvent?.EventType == TripEventTypes.GeofenceArrived)
            {
                await teamsNotificationService.SendArrivalCardAsync(integrationEvent, args.CancellationToken);
            }

            await args.CompleteMessageAsync(args.Message, args.CancellationToken);
        };
        processor.ProcessErrorAsync += args =>
        {
            logger.LogError(args.Exception, "Service Bus trip event processing failed from {ErrorSource}", args.ErrorSource);
            return Task.CompletedTask;
        };

        await processor.StartProcessingAsync(stoppingToken);
        logger.LogInformation("Trip event worker started for queue {QueueName}", _options.TripEventsQueueName);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            await processor.StopProcessingAsync(CancellationToken.None);
        }
    }
}
