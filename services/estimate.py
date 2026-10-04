from services.api_service import get_latest_points
from services.interpolation import idw


def estimate_aqi(lat, lon):

    points = get_latest_points()

    aqi = idw(lat, lon, points)

    category = "Good"

    if aqi > 50:
        category = "Satisfactory"

    if aqi > 100:
        category = "Moderate"

    if aqi > 200:
        category = "Poor"

    if aqi > 300:
        category = "Very Poor"

    if aqi > 400:
        category = "Severe"

    return {
        "aqi": round(aqi, 2),
        "category": category
    }