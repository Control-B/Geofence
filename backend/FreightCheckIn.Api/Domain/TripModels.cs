namespace FreightCheckIn.Api.Domain;

public static class TripStatuses
{
    public const string Created = "CREATED";
    public const string SmsSent = "SMS_SENT";
    public const string TrackingStarted = "TRACKING_STARTED";
    public const string Arrived = "ARRIVED";
    public const string Confirmed = "CONFIRMED";
    public const string Docked = "DOCKED";
    public const string Completed = "COMPLETED";
    public const string Cancelled = "CANCELLED";

    public static readonly HashSet<string> Active = new(StringComparer.OrdinalIgnoreCase)
    {
        Created,
        SmsSent,
        TrackingStarted,
        Arrived,
        Confirmed,
        Docked
    };
}

public static class TripEventTypes
{
    public const string TripCreated = "TRIP_CREATED";
    public const string SmsSent = "SMS_SENT";
    public const string TrackingStarted = "TRACKING_STARTED";
    public const string GeofenceArrived = "GEOFENCE_ARRIVED";
    public const string DocumentUploaded = "DOCUMENT_UPLOADED";
    public const string ArrivalConfirmed = "ARRIVAL_CONFIRMED";
    public const string Docked = "DOCKED";
    public const string Completed = "COMPLETED";
    public const string DocumentsRequested = "DOCUMENTS_REQUESTED";
}

public sealed record Trip(
    Guid Id,
    string PublicTripToken,
    DateTimeOffset PublicTokenExpiresAt,
    string TripReference,
    string DriverName,
    string DriverPhone,
    string WarehouseName,
    decimal WarehouseLat,
    decimal WarehouseLng,
    int GeofenceRadiusMeters,
    DateTimeOffset ScheduledArrivalTime,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record LocationPing(
    Guid Id,
    Guid TripId,
    decimal Latitude,
    decimal Longitude,
    decimal AccuracyMeters,
    decimal? Speed,
    decimal? Heading,
    DateTimeOffset Timestamp,
    int DistanceToWarehouseMeters,
    bool IsInsideGeofence,
    DateTimeOffset CreatedAt);

public sealed record TripDocument(
    Guid Id,
    Guid TripId,
    string DocumentType,
    string FileName,
    string BlobUrl,
    string UploadedBy,
    DateTimeOffset UploadedAt,
    string Status);
