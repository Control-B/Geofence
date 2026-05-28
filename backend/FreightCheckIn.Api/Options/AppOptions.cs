namespace FreightCheckIn.Api.Options;

public sealed class PublicAppOptions
{
    public string BaseUrl { get; set; } = "http://localhost:3000";
    public string[] CorsOrigins { get; set; } = ["http://localhost:3000"];
}

public sealed class GeofenceOptions
{
    public int DefaultRadiusMeters { get; set; } = 250;
    public int MaxGpsAccuracyMeters { get; set; } = 100;
    public int RequiredInsidePingCount { get; set; } = 2;
}

public sealed class AzureCommunicationServicesOptions
{
    public string ConnectionString { get; set; } = "";
    public string FromNumber { get; set; } = "";
}

public sealed class ServiceBusOptions
{
    public string ConnectionString { get; set; } = "";
    public string TripEventsQueueName { get; set; } = "trip-events";
}

public sealed class AzureBlobStorageOptions
{
    public string ConnectionString { get; set; } = "";
    public string ContainerName { get; set; } = "delivery-documents";
}

public sealed class TeamsBotOptions
{
    public string MicrosoftAppId { get; set; } = "";
    public string MicrosoftAppPassword { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string TargetConversationId { get; set; } = "";
}
