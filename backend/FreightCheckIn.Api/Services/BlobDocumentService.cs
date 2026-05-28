using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using FreightCheckIn.Api.Options;
using Microsoft.Extensions.Options;

namespace FreightCheckIn.Api.Services;

public sealed record BlobUploadTicket(string UploadUrl, string BlobUrl, string BlobName, string ContainerName);

public interface IBlobDocumentService
{
    Task<BlobUploadTicket> CreateUploadTicketAsync(Guid tripId, string fileName, string contentType, CancellationToken cancellationToken);
    Task<bool> BlobExistsAsync(string blobUrl, CancellationToken cancellationToken);
}

public sealed class BlobDocumentService(IOptions<AzureBlobStorageOptions> options, ILogger<BlobDocumentService> logger) : IBlobDocumentService
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg",
        "image/png"
    };

    private readonly AzureBlobStorageOptions _options = options.Value;

    public async Task<BlobUploadTicket> CreateUploadTicketAsync(Guid tripId, string fileName, string contentType, CancellationToken cancellationToken)
    {
        if (!AllowedContentTypes.Contains(contentType))
        {
            throw new ArgumentException("Only PDF, JPG, and PNG files are allowed.");
        }

        var safeName = string.Join("_", Path.GetFileName(fileName).Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        var blobName = $"trips/{tripId:N}/{Guid.NewGuid():N}-{safeName}";

        if (string.IsNullOrWhiteSpace(_options.ConnectionString))
        {
            logger.LogWarning("Azure Blob SAS skipped for trip {TripId}; AzureBlobStorage:ConnectionString is not configured", tripId);
            var localUrl = $"local-blob://{_options.ContainerName}/{blobName}";
            return new BlobUploadTicket(localUrl, localUrl, blobName, _options.ContainerName);
        }

        var container = new BlobContainerClient(_options.ConnectionString, _options.ContainerName);
        await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        var blob = container.GetBlobClient(blobName);
        var sas = blob.GenerateSasUri(BlobSasPermissions.Create | BlobSasPermissions.Write, DateTimeOffset.UtcNow.AddMinutes(20));
        return new BlobUploadTicket(sas.ToString(), blob.Uri.ToString(), blobName, _options.ContainerName);
    }

    public async Task<bool> BlobExistsAsync(string blobUrl, CancellationToken cancellationToken)
    {
        if (blobUrl.StartsWith("local-blob://", StringComparison.OrdinalIgnoreCase)) return true;
        if (string.IsNullOrWhiteSpace(_options.ConnectionString)) return false;

        var container = new BlobContainerClient(_options.ConnectionString, _options.ContainerName);
        var pathSegments = new Uri(blobUrl).AbsolutePath.Trim('/').Split('/');
        var blobName = string.Join('/', pathSegments.Skip(1));
        return await container.GetBlobClient(blobName).ExistsAsync(cancellationToken);
    }
}
