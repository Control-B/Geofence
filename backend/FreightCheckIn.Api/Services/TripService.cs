using System.Security.Cryptography;
using FreightCheckIn.Api.Domain;
using FreightCheckIn.Api.Dtos;
using FreightCheckIn.Api.Infrastructure;
using FreightCheckIn.Api.Options;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Services;

public sealed class TripService(
    TripRepository repository,
    GeofenceService geofence,
    IAcsSmsService smsService,
    ITripEventPublisher eventPublisher,
    IBlobDocumentService blobDocumentService,
    IOptions<PublicAppOptions> publicAppOptions,
    IOptions<GeofenceOptions> geofenceOptions,
    IConfiguration configuration,
    ILogger<TripService> logger)
{
    private readonly PublicAppOptions _publicApp = publicAppOptions.Value;
    private readonly GeofenceOptions _geofence = geofenceOptions.Value;

    public async Task<TripSummaryResponse> CreateTripAsync(CreateTripRequest request, CancellationToken cancellationToken)
    {
        ValidateTrip(request);
        var now = DateTimeOffset.UtcNow;
        var radius = request.GeofenceRadiusMeters ?? _geofence.DefaultRadiusMeters;
        var trip = new Trip(
            Guid.NewGuid(),
            CreatePublicToken(),
            now.AddHours(configuration.GetValue("PublicTokenTtlHours", 72)),
            request.TripReference.Trim(),
            request.DriverName.Trim(),
            request.DriverPhone.Trim(),
            request.WarehouseName.Trim(),
            request.WarehouseLat,
            request.WarehouseLng,
            radius,
            request.ScheduledArrivalTime,
            TripStatuses.Created,
            now,
            now);

        var created = await repository.CreateTripAsync(trip, cancellationToken);
        var checkInUrl = BuildCheckInUrl(created.PublicTripToken);
        var correlationId = Guid.NewGuid().ToString("N");

        await repository.SaveEventAsync(created.Id, TripEventTypes.TripCreated, new { created.TripReference, created.DriverName, created.WarehouseName }, "system", correlationId, cancellationToken);
        await eventPublisher.PublishAsync(ToIntegrationEvent(TripEventTypes.TripCreated, created, null, correlationId), cancellationToken);

        await smsService.SendTripLinkAsync(created, checkInUrl, cancellationToken);
        await repository.UpdateTripStatusAsync(created.Id, TripStatuses.SmsSent, cancellationToken);
        await repository.SaveEventAsync(created.Id, TripEventTypes.SmsSent, new { checkInUrl }, "system", correlationId, cancellationToken);
        await eventPublisher.PublishAsync(ToIntegrationEvent(TripEventTypes.SmsSent, created with { Status = TripStatuses.SmsSent }, null, correlationId), cancellationToken);

        logger.LogInformation("Trip {TripId} created and SMS workflow completed with correlation {CorrelationId}", created.Id, correlationId);
        return ToSummary(created with { Status = TripStatuses.SmsSent }, checkInUrl);
    }

    public async Task<PublicTripResponse?> GetPublicTripAsync(string token, CancellationToken cancellationToken)
    {
        var trip = await repository.GetTripByPublicTokenAsync(token, cancellationToken);
        if (trip is null) return null;
        return new PublicTripResponse(
            trip.DriverName,
            trip.WarehouseName,
            trip.WarehouseLat,
            trip.WarehouseLng,
            trip.GeofenceRadiusMeters,
            trip.Status,
            trip.ScheduledArrivalTime,
            new MapConfigResponse(configuration["Mapbox:PublicToken"], configuration.GetValue("LocationPingIntervalSeconds", 10), _geofence.MaxGpsAccuracyMeters));
    }

    public async Task<LocationPingResponse> RecordLocationPingAsync(string token, LocationPingRequest request, CancellationToken cancellationToken)
    {
        var trip = await repository.GetTripByPublicTokenAsync(token, cancellationToken) ?? throw new KeyNotFoundException("Trip link is invalid or expired.");
        if (!TripStatuses.Active.Contains(trip.Status)) throw new InvalidOperationException("Trip is not active.");
        if (request.AccuracyMeters > _geofence.MaxGpsAccuracyMeters) throw new ArgumentException($"GPS accuracy must be within {_geofence.MaxGpsAccuracyMeters} meters.");
        ValidateCoordinates(request.Latitude, request.Longitude);

        var distance = geofence.CalculateDistanceMeters(request.Latitude, request.Longitude, trip.WarehouseLat, trip.WarehouseLng);
        var inside = distance <= trip.GeofenceRadiusMeters;
        var now = DateTimeOffset.UtcNow;
        var ping = new LocationPing(Guid.NewGuid(), trip.Id, request.Latitude, request.Longitude, request.AccuracyMeters, request.Speed, request.Heading, request.Timestamp, distance, inside, now);
        await repository.SaveLocationPingAsync(ping, cancellationToken);

        if (trip.Status is TripStatuses.SmsSent or TripStatuses.Created)
        {
            await repository.UpdateTripStatusAsync(trip.Id, TripStatuses.TrackingStarted, cancellationToken);
            await repository.SaveEventAsync(trip.Id, TripEventTypes.TrackingStarted, new { request.AccuracyMeters }, "driver", Guid.NewGuid().ToString("N"), cancellationToken);
            trip = trip with { Status = TripStatuses.TrackingStarted };
        }

        logger.LogInformation("Location ping for trip {TripId}: distance {DistanceMeters}m inside {InsideGeofence} accuracy {AccuracyMeters}m", trip.Id, distance, inside, request.AccuracyMeters);

        if (inside && trip.Status != TripStatuses.Arrived)
        {
            var insideCount = await repository.CountRecentInsidePingsAsync(trip.Id, _geofence.RequiredInsidePingCount, cancellationToken);
            if (insideCount >= _geofence.RequiredInsidePingCount && await repository.TryMarkArrivedAsync(trip.Id, cancellationToken))
            {
                var correlationId = Guid.NewGuid().ToString("N");
                trip = trip with { Status = TripStatuses.Arrived };
                await repository.SaveEventAsync(trip.Id, TripEventTypes.GeofenceArrived, new { distanceToWarehouseMeters = distance, requiredInsidePingCount = _geofence.RequiredInsidePingCount }, "system", correlationId, cancellationToken);
                await eventPublisher.PublishAsync(ToIntegrationEvent(TripEventTypes.GeofenceArrived, trip, distance, correlationId), cancellationToken);
                logger.LogInformation("Arrival detected for trip {TripId} with correlation {CorrelationId}", trip.Id, correlationId);
            }
        }

        var currentTrip = await repository.GetTripByIdAsync(trip.Id, cancellationToken) ?? trip;
        return new LocationPingResponse(currentTrip.Status, distance, inside);
    }

    public async Task<UploadUrlResponse> CreateUploadUrlAsync(Guid tripId, UploadUrlRequest request, CancellationToken cancellationToken)
    {
        var trip = await repository.GetTripByIdAsync(tripId, cancellationToken) ?? throw new KeyNotFoundException("Trip not found.");
        ValidateUpload(request);
        var ticket = await blobDocumentService.CreateUploadTicketAsync(tripId, request.FileName, request.ContentType, cancellationToken);
        var document = await repository.CreateDocumentAsync(tripId, request.DocumentType.Trim(), Path.GetFileName(request.FileName), ticket.BlobUrl, request.UploadedBy.Trim(), cancellationToken);
        await repository.SaveEventAsync(trip.Id, "DOCUMENT_UPLOAD_STARTED", new { document.Id, request.DocumentType, request.FileName }, request.UploadedBy, Guid.NewGuid().ToString("N"), cancellationToken);
        logger.LogInformation("Document upload started for trip {TripId} document {DocumentId}", trip.Id, document.Id);
        return new UploadUrlResponse(document.Id, ticket.UploadUrl, ticket.BlobUrl, ticket.BlobName, ticket.ContainerName);
    }

    public async Task CompleteUploadAsync(Guid tripId, CompleteUploadRequest request, CancellationToken cancellationToken)
    {
        var document = await repository.MarkDocumentUploadedAsync(request.DocumentId, cancellationToken) ?? throw new KeyNotFoundException("Document not found.");
        if (document.TripId != tripId) throw new InvalidOperationException("Document does not belong to this trip.");
        if (!await blobDocumentService.BlobExistsAsync(document.BlobUrl, cancellationToken)) throw new InvalidOperationException("Uploaded blob was not found.");

        var trip = await repository.GetTripByIdAsync(tripId, cancellationToken) ?? throw new KeyNotFoundException("Trip not found.");
        var correlationId = Guid.NewGuid().ToString("N");
        await repository.SaveEventAsync(tripId, TripEventTypes.DocumentUploaded, new { document.Id, document.DocumentType, document.FileName }, request.UploadedBy, correlationId, cancellationToken);
        await eventPublisher.PublishAsync(ToIntegrationEvent(TripEventTypes.DocumentUploaded, trip, null, correlationId), cancellationToken);
        logger.LogInformation("Document upload completed for trip {TripId} document {DocumentId}", tripId, document.Id);
    }

    public async Task ApplyActionAsync(Guid tripId, string action, string createdBy, CancellationToken cancellationToken)
    {
        var trip = await repository.GetTripByIdAsync(tripId, cancellationToken) ?? throw new KeyNotFoundException("Trip not found.");
        var (status, eventType) = action switch
        {
            "confirm_arrival" => (TripStatuses.Confirmed, TripEventTypes.ArrivalConfirmed),
            "mark_docked" => (TripStatuses.Docked, TripEventTypes.Docked),
            "complete" => (TripStatuses.Completed, TripEventTypes.Completed),
            "request_documents" => (trip.Status, TripEventTypes.DocumentsRequested),
            _ => throw new ArgumentException("Unsupported action.")
        };

        if (status != trip.Status) await repository.UpdateTripStatusAsync(tripId, status, cancellationToken);
        var correlationId = Guid.NewGuid().ToString("N");
        await repository.SaveEventAsync(tripId, eventType, new { action }, createdBy, correlationId, cancellationToken);
        await eventPublisher.PublishAsync(ToIntegrationEvent(eventType, trip with { Status = status }, null, correlationId), cancellationToken);
    }

    private TripSummaryResponse ToSummary(Trip trip, string checkInUrl) => new(trip.Id, trip.PublicTripToken, trip.TripReference, trip.DriverName, trip.WarehouseName, trip.Status, trip.ScheduledArrivalTime, checkInUrl);

    private string BuildCheckInUrl(string token) => $"{_publicApp.BaseUrl.TrimEnd('/')}/checkin/{token}";

    private static TripIntegrationEvent ToIntegrationEvent(string eventType, Trip trip, int? distanceMeters, string correlationId) =>
        new(eventType, trip.Id, trip.TripReference, trip.DriverName, trip.WarehouseName, distanceMeters, DateTimeOffset.UtcNow, correlationId);

    private static string CreatePublicToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static void ValidateTrip(CreateTripRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TripReference)) throw new ArgumentException("Trip reference is required.");
        if (string.IsNullOrWhiteSpace(request.DriverName)) throw new ArgumentException("Driver name is required.");
        if (string.IsNullOrWhiteSpace(request.DriverPhone)) throw new ArgumentException("Driver phone is required.");
        if (string.IsNullOrWhiteSpace(request.WarehouseName)) throw new ArgumentException("Warehouse name is required.");
        ValidateCoordinates(request.WarehouseLat, request.WarehouseLng);
        if (request.GeofenceRadiusMeters is < 25 or > 5000) throw new ArgumentException("Geofence radius must be between 25 and 5000 meters.");
    }

    private static void ValidateCoordinates(decimal latitude, decimal longitude)
    {
        if (latitude is < -90 or > 90) throw new ArgumentException("Latitude is invalid.");
        if (longitude is < -180 or > 180) throw new ArgumentException("Longitude is invalid.");
    }

    private static void ValidateUpload(UploadUrlRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DocumentType)) throw new ArgumentException("Document type is required.");
        if (string.IsNullOrWhiteSpace(request.FileName)) throw new ArgumentException("File name is required.");
        if (string.IsNullOrWhiteSpace(request.UploadedBy)) throw new ArgumentException("Uploaded by is required.");
    }
}
