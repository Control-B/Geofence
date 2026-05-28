using System.Text.Json;
using FreightCheckIn.Api.Domain;
using Npgsql;
using NpgsqlTypes;

namespace FreightCheckIn.Api.Infrastructure;

public sealed class TripRepository(NpgsqlDataSource dataSource)
{
    public async Task<Trip> CreateTripAsync(Trip trip, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into trips (
                id, public_trip_token, public_token_expires_at, trip_reference, driver_name, driver_phone,
                warehouse_name, warehouse_lat, warehouse_lng, geofence_radius_meters, scheduled_arrival_time,
                status, created_at, updated_at
            ) values (
                @id, @token, @tokenExpiresAt, @tripReference, @driverName, @driverPhone,
                @warehouseName, @warehouseLat, @warehouseLng, @radius, @scheduledArrivalTime,
                @status, @createdAt, @updatedAt
            )
            returning id, public_trip_token, public_token_expires_at, trip_reference, driver_name, driver_phone,
                warehouse_name, warehouse_lat, warehouse_lng, geofence_radius_meters, scheduled_arrival_time,
                status, created_at, updated_at;
            """;

        await using var command = dataSource.CreateCommand(sql);
        AddTripParameters(command, trip);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return ReadTrip(reader);
    }

    public async Task<Trip?> GetTripByPublicTokenAsync(string token, CancellationToken cancellationToken)
    {
        const string sql = """
            select id, public_trip_token, public_token_expires_at, trip_reference, driver_name, driver_phone,
                warehouse_name, warehouse_lat, warehouse_lng, geofence_radius_meters, scheduled_arrival_time,
                status, created_at, updated_at
            from trips
            where public_trip_token = @token and public_token_expires_at > now();
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("token", token);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        return ReadTrip(reader);
    }

    public async Task<Trip?> GetTripByIdAsync(Guid tripId, CancellationToken cancellationToken)
    {
        const string sql = """
            select id, public_trip_token, public_token_expires_at, trip_reference, driver_name, driver_phone,
                warehouse_name, warehouse_lat, warehouse_lng, geofence_radius_meters, scheduled_arrival_time,
                status, created_at, updated_at
            from trips where id = @tripId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("tripId", tripId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        return ReadTrip(reader);
    }

    public async Task SaveEventAsync(Guid tripId, string eventType, object payload, string createdBy, string correlationId, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into trip_events (trip_id, event_type, event_payload_json, created_by, correlation_id)
            values (@tripId, @eventType, @payload::jsonb, @createdBy, @correlationId);
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("eventType", eventType);
        command.Parameters.AddWithValue("payload", JsonSerializer.Serialize(payload));
        command.Parameters.AddWithValue("createdBy", createdBy);
        command.Parameters.AddWithValue("correlationId", correlationId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateTripStatusAsync(Guid tripId, string status, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("update trips set status = @status, updated_at = now() where id = @tripId;");
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("status", status);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> TryMarkArrivedAsync(Guid tripId, CancellationToken cancellationToken)
    {
        const string sql = """
            update trips
            set status = @arrived, updated_at = now()
            where id = @tripId and status <> @arrived
            returning true;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("arrived", TripStatuses.Arrived);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is true;
    }

    public async Task<int> CountRecentInsidePingsAsync(Guid tripId, int requiredCount, CancellationToken cancellationToken)
    {
        const string sql = """
            select count(*)::int
            from (
                select is_inside_geofence
                from location_pings
                where trip_id = @tripId
                order by timestamp desc
                limit @requiredCount
            ) recent
            where is_inside_geofence = true;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("requiredCount", requiredCount);
        return (int)(await command.ExecuteScalarAsync(cancellationToken) ?? 0);
    }

    public async Task SaveLocationPingAsync(LocationPing ping, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into location_pings (
                id, trip_id, latitude, longitude, accuracy_meters, speed, heading, timestamp,
                distance_to_warehouse_meters, is_inside_geofence, created_at
            ) values (
                @id, @tripId, @latitude, @longitude, @accuracyMeters, @speed, @heading, @timestamp,
                @distance, @insideGeofence, @createdAt
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("id", ping.Id);
        command.Parameters.AddWithValue("tripId", ping.TripId);
        command.Parameters.AddWithValue("latitude", ping.Latitude);
        command.Parameters.AddWithValue("longitude", ping.Longitude);
        command.Parameters.AddWithValue("accuracyMeters", ping.AccuracyMeters);
        command.Parameters.AddWithValue("speed", ping.Speed is null ? DBNull.Value : ping.Speed);
        command.Parameters.AddWithValue("heading", ping.Heading is null ? DBNull.Value : ping.Heading);
        command.Parameters.AddWithValue("timestamp", ping.Timestamp);
        command.Parameters.AddWithValue("distance", ping.DistanceToWarehouseMeters);
        command.Parameters.AddWithValue("insideGeofence", ping.IsInsideGeofence);
        command.Parameters.AddWithValue("createdAt", ping.CreatedAt);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<TripDocument> CreateDocumentAsync(Guid tripId, string documentType, string fileName, string blobUrl, string uploadedBy, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into trip_documents (trip_id, document_type, file_name, blob_url, uploaded_by, status)
            values (@tripId, @documentType, @fileName, @blobUrl, @uploadedBy, 'PENDING')
            returning id, trip_id, document_type, file_name, blob_url, uploaded_by, uploaded_at, status;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("documentType", documentType);
        command.Parameters.AddWithValue("fileName", fileName);
        command.Parameters.AddWithValue("blobUrl", blobUrl);
        command.Parameters.AddWithValue("uploadedBy", uploadedBy);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return ReadDocument(reader);
    }

    public async Task<TripDocument?> MarkDocumentUploadedAsync(Guid documentId, CancellationToken cancellationToken)
    {
        const string sql = """
            update trip_documents set status = 'UPLOADED', uploaded_at = now()
            where id = @documentId
            returning id, trip_id, document_type, file_name, blob_url, uploaded_by, uploaded_at, status;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("documentId", documentId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        return ReadDocument(reader);
    }

    private static void AddTripParameters(NpgsqlCommand command, Trip trip)
    {
        command.Parameters.AddWithValue("id", trip.Id);
        command.Parameters.AddWithValue("token", trip.PublicTripToken);
        command.Parameters.AddWithValue("tokenExpiresAt", trip.PublicTokenExpiresAt);
        command.Parameters.AddWithValue("tripReference", trip.TripReference);
        command.Parameters.AddWithValue("driverName", trip.DriverName);
        command.Parameters.AddWithValue("driverPhone", trip.DriverPhone);
        command.Parameters.AddWithValue("warehouseName", trip.WarehouseName);
        command.Parameters.AddWithValue("warehouseLat", trip.WarehouseLat);
        command.Parameters.AddWithValue("warehouseLng", trip.WarehouseLng);
        command.Parameters.AddWithValue("radius", trip.GeofenceRadiusMeters);
        command.Parameters.AddWithValue("scheduledArrivalTime", trip.ScheduledArrivalTime);
        command.Parameters.AddWithValue("status", trip.Status);
        command.Parameters.AddWithValue("createdAt", trip.CreatedAt);
        command.Parameters.AddWithValue("updatedAt", trip.UpdatedAt);
    }

    private static Trip ReadTrip(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.GetFieldValue<DateTimeOffset>(2),
        reader.GetString(3),
        reader.GetString(4),
        reader.GetString(5),
        reader.GetString(6),
        reader.GetDecimal(7),
        reader.GetDecimal(8),
        reader.GetInt32(9),
        reader.GetFieldValue<DateTimeOffset>(10),
        reader.GetString(11),
        reader.GetFieldValue<DateTimeOffset>(12),
        reader.GetFieldValue<DateTimeOffset>(13));

    private static TripDocument ReadDocument(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        reader.GetString(2),
        reader.GetString(3),
        reader.GetString(4),
        reader.GetString(5),
        reader.GetFieldValue<DateTimeOffset>(6),
        reader.GetString(7));
}
