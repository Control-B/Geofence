using Azure.Communication.Sms;
using FreightCheckIn.Api.Domain;
using FreightCheckIn.Api.Options;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Services;

public interface IAcsSmsService
{
    Task SendTripLinkAsync(Trip trip, string checkInUrl, CancellationToken cancellationToken);
}

public sealed class AcsSmsService(IOptions<AzureCommunicationServicesOptions> options, ILogger<AcsSmsService> logger) : IAcsSmsService
{
    private readonly AzureCommunicationServicesOptions _options = options.Value;

    public async Task SendTripLinkAsync(Trip trip, string checkInUrl, CancellationToken cancellationToken)
    {
        var message = $"Hi {trip.DriverName}, track your freight arrival here: {checkInUrl}";

        if (string.IsNullOrWhiteSpace(_options.ConnectionString) || string.IsNullOrWhiteSpace(_options.FromNumber))
        {
            logger.LogWarning("ACS SMS skipped for trip {TripId}; ACS_CONNECTION_STRING or ACS_FROM_NUMBER is not configured", trip.Id);
            return;
        }

        var client = new SmsClient(_options.ConnectionString);
        var response = await client.SendAsync(_options.FromNumber, trip.DriverPhone, message, cancellationToken: cancellationToken);
        var receipt = response.Value;

        if (!receipt.Successful)
        {
            logger.LogError("ACS SMS failed for trip {TripId} with message id {MessageId}: {ErrorMessage}", trip.Id, receipt.MessageId, receipt.ErrorMessage);
            throw new InvalidOperationException($"ACS SMS failed: {receipt.ErrorMessage}");
        }

        logger.LogInformation("ACS SMS sent for trip {TripId} with message id {MessageId}", trip.Id, receipt.MessageId);
    }
}
