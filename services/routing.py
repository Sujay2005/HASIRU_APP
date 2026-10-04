from services.api_service import get_latest_points
from services.prediction import get_predicted_points
from services.interpolation import idw


def calculate_route(route, travel_time):

    points = get_latest_points()

    aqi_values = []

    for p in route:

        lat = p[0]
        lon = p[1]

        aqi = idw(lat, lon, points)

        aqi_values.append(aqi)

    avg_aqi = sum(aqi_values) / len(aqi_values)
    max_aqi = max(aqi_values)

    exposure_score = avg_aqi * travel_time

    category = "Good"

    if avg_aqi > 50:
        category = "Satisfactory"

    if avg_aqi > 100:
        category = "Moderate"

    if avg_aqi > 200:
        category = "Poor"

    if avg_aqi > 300:
        category = "Very Poor"

    if avg_aqi > 400:
        category = "Severe"

    return {

        "average_aqi": round(avg_aqi, 2),
        "max_aqi": round(max_aqi, 2),
        "exposure_score": round(exposure_score, 2),
        "category": category

    }


def calculate_future_route(route, travel_time):

    points = get_predicted_points()

    aqi_values = []

    for p in route:

        lat = p[0]
        lon = p[1]

        aqi = idw(lat, lon, points)

        aqi_values.append(aqi)

    avg_aqi = sum(aqi_values) / len(aqi_values)
    max_aqi = max(aqi_values)

    exposure_score = avg_aqi * travel_time

    category = "Good"

    if avg_aqi > 50:
        category = "Satisfactory"

    if avg_aqi > 100:
        category = "Moderate"

    if avg_aqi > 200:
        category = "Poor"

    if avg_aqi > 300:
        category = "Very Poor"

    if avg_aqi > 400:
        category = "Severe"

    return {

        "average_aqi": round(avg_aqi, 2),
        "max_aqi": round(max_aqi, 2),
        "exposure_score": round(exposure_score, 2),
        "category": category

    }


def calculate_route_segments(route):

    points = get_latest_points()

    result = []

    for p in route:

        lat = p[0]
        lon = p[1]

        aqi = idw(lat, lon, points)

        result.append({

            "lat": lat,
            "lon": lon,
            "aqi": round(aqi, 2)

        })

    return result