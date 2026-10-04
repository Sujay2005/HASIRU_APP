import numpy as np

from services.api_service import get_latest_points
from services.prediction import get_predicted_points


def idw(lat, lon, points):

    numerator = 0
    denominator = 0

    for p in points:

        d = np.sqrt(
            (lat - p["lat"]) ** 2 +
            (lon - p["lon"]) ** 2
        )

        if d < 0.00001:
            return p["aqi"]

        w = 1 / (d ** 2)

        numerator += w * p["aqi"]
        denominator += w

    return numerator / denominator


def generate_heatmap():

    points = get_latest_points()

    grid = []

    lat_range = np.arange(12.75, 13.10, 0.005)
    lon_range = np.arange(77.45, 77.75, 0.005)

    for lat in lat_range:
        for lon in lon_range:

            aqi = idw(lat, lon, points)

            grid.append([
                float(lat),
                float(lon),
                float(aqi)
            ])

    return grid


def generate_future_heatmap():

    points = get_predicted_points()

    grid = []

    lat_range = np.arange(12.75, 13.10, 0.005)
    lon_range = np.arange(77.45, 77.75, 0.005)

    for lat in lat_range:
        for lon in lon_range:

            aqi = idw(lat, lon, points)

            grid.append([
                float(lat),
                float(lon),
                float(aqi)
            ])

    return grid