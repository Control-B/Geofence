namespace FreightCheckIn.Api.Services;

public sealed class GeofenceService
{
    public int CalculateDistanceMeters(decimal fromLatitude, decimal fromLongitude, decimal toLatitude, decimal toLongitude)
    {
        const double earthRadiusMeters = 6371000;
        var deltaLatitude = ToRadians((double)(toLatitude - fromLatitude));
        var deltaLongitude = ToRadians((double)(toLongitude - fromLongitude));
        var startLatitude = ToRadians((double)fromLatitude);
        var endLatitude = ToRadians((double)toLatitude);

        var haversine = Math.Pow(Math.Sin(deltaLatitude / 2), 2) +
            Math.Cos(startLatitude) * Math.Cos(endLatitude) * Math.Pow(Math.Sin(deltaLongitude / 2), 2);

        return (int)Math.Round(earthRadiusMeters * 2 * Math.Atan2(Math.Sqrt(haversine), Math.Sqrt(1 - haversine)));
    }

    private static double ToRadians(double value) => value * Math.PI / 180;
}
