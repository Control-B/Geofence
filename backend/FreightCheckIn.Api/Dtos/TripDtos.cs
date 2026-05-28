namespace FreightCheckIn.Api.Dtos;

public sealed record CreateTripRequest(
    string TripReference,
    string DriverName,
    string DriverPhone,
    string WarehouseName,
    decimal WarehouseLat,
    decimal WarehouseLng,
    int? GeofenceRadiusMeters,
    DateTimeOffset ScheduledArrivalTime);

public sealed record TripSummaryResponse(
    Guid Id,
    string PublicTripToken,
    string TripReference,
    string DriverName,
    string WarehouseName,
    string Status,
    DateTimeOffset ScheduledArrivalTime,
    string CheckInUrl);

public sealed record PublicTripResponse(
    string DriverName,
    string WarehouseName,
    decimal WarehouseLat,
    decimal WarehouseLng,
    int GeofenceRadiusMeters,
    string TripStatus,
    DateTimeOffset ScheduledArrivalTime,
    MapConfigResponse MapConfig);

public sealed record MapConfigResponse(string? PublicToken, int PingIntervalSeconds, int MaxGpsAccuracyMeters);

public sealed record LocationPingRequest(
    decimal Latitude,
    decimal Longitude,
    decimal AccuracyMeters,
    decimal? Speed,
    decimal? Heading,
    DateTimeOffset Timestamp);

public sealed record LocationPingResponse(string TripStatus, int DistanceToWarehouseMeters, bool InsideGeofence);

public sealed record UploadUrlRequest(string DocumentType, string FileName, string ContentType, string UploadedBy);

public sealed record UploadUrlResponse(Guid DocumentId, string UploadUrl, string BlobUrl, string BlobName, string ContainerName);

public sealed record CompleteUploadRequest(Guid DocumentId, string UploadedBy);

public sealed record TripActionRequest(string CreatedBy = "teams-bot");
