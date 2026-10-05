from flask import (
    Flask,
    render_template,
    jsonify,
    request
)

from services.prediction import (
    get_predicted_points
)

from services.api_service import (
    get_latest_points,
    get_latest_dataframe,
    get_all_history,
    get_history
)

from services.interpolation import (
    generate_heatmap,
    generate_future_heatmap,
    idw
)

from services.routing import (
    calculate_route,
    calculate_future_route,
    calculate_route_segments
)

from services.estimate import (
    estimate_aqi
)

import json
import math

from urllib.parse import urlencode
from urllib.request import (
    Request,
    urlopen
)

from datetime import (
    datetime,
    timezone
)


app = Flask(__name__)


# ============================================================
# HOME
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# GEOCODING
# ============================================================

@app.route("/geocode")
def geocode():

    query = request.args.get(
        "q",
        ""
    ).strip()

    if not query:

        return jsonify([])


    try:

        # ArcGIS geocoding is used here instead
        # of Nominatim so Render does not get
        # HTTP 429 rate-limit errors.

        params = urlencode({

            "SingleLine":
                query + ", Bengaluru, Karnataka, India",

            "f":
                "json",

            "maxLocations":
                5,

            "outFields":
                "*",

            "countryCode":
                "IND"

        })


        url = (
            "https://geocode.arcgis.com/"
            "arcgis/rest/services/"
            "World/GeocodeServer/"
            "findAddressCandidates?"
            +
            params
        )


        req = Request(
            url,
            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0"
            }
        )


        with urlopen(
            req,
            timeout=8
        ) as response:

            data = json.loads(
                response
                .read()
                .decode("utf-8")
            )


        results = []


        for candidate in data.get(
            "candidates",
            []
        ):

            location = candidate.get(
                "location",
                {}
            )

            lat = location.get(
                "y"
            )

            lon = location.get(
                "x"
            )


            if (
                lat is None
                or
                lon is None
            ):

                continue


            results.append({

                "lat":
                    str(lat),

                "lon":
                    str(lon),

                "display_name":
                    candidate.get(
                        "address",
                        query
                    )

            })


        return jsonify(
            results
        )


    except Exception as e:

        print(
            "Geocoding error:",
            e
        )

        return jsonify({

            "error":
                "Geocoding failed"

        }), 502


# ============================================================
# AUTOCOMPLETE
# ============================================================

@app.route("/autocomplete")
def autocomplete():

    query = request.args.get(
        "q",
        ""
    ).strip()


    if len(query) < 3:

        return jsonify([])


    try:

        params = urlencode({

            "text":
                query,

            "f":
                "json",

            "countryCode":
                "IND",

            "location":
                "77.5946,12.9716",

            "searchExtent":
                "77.30,12.75,77.90,13.25",

            "maxSuggestions":
                8

        })


        url = (
            "https://geocode-api.arcgis.com/"
            "arcgis/rest/services/"
            "World/GeocodeServer/"
            "suggest?"
            +
            params
        )


        req = Request(
            url,
            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0"
            }
        )


        with urlopen(
            req,
            timeout=5
        ) as response:

            data = json.loads(
                response
                .read()
                .decode("utf-8")
            )


        results = []


        for item in data.get(
            "suggestions",
            []
        ):

            results.append({

                "text":
                    item.get(
                        "text",
                        ""
                    ),

                "magicKey":
                    item.get(
                        "magicKey",
                        ""
                    ),

                "isCollection":
                    item.get(
                        "isCollection",
                        False
                    )

            })


        return jsonify(
            results
        )


    except Exception as e:

        print(
            "Autocomplete error:",
            e
        )

        return jsonify([])


# ============================================================
# GEOCODE SELECTED AUTOCOMPLETE RESULT
# ============================================================

@app.route("/geocode_resolve")
def geocode_resolve():

    text = request.args.get(
        "text",
        ""
    ).strip()

    magic_key = request.args.get(
        "magicKey",
        ""
    ).strip()


    if not text:

        return jsonify({

            "error":
                "Missing location"

        }), 400


    try:

        params = {

            "SingleLine":
                text,

            "f":
                "json",

            "maxLocations":
                5,

            "outFields":
                "*",

            "countryCode":
                "IND"

        }


        if magic_key:

            params[
                "magicKey"
            ] = magic_key


        query_string = urlencode(
            params
        )


        url = (
            "https://geocode.arcgis.com/"
            "arcgis/rest/services/"
            "World/GeocodeServer/"
            "findAddressCandidates?"
            +
            query_string
        )


        req = Request(
            url,
            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0"
            }
        )


        with urlopen(
            req,
            timeout=8
        ) as response:

            data = json.loads(
                response
                .read()
                .decode("utf-8")
            )


        candidates = data.get(
            "candidates",
            []
        )


        if not candidates:

            return jsonify({

                "error":
                    "Location not found"

            }), 404


        candidate = candidates[0]

        location = candidate.get(
            "location",
            {}
        )


        lat = location.get(
            "y"
        )

        lon = location.get(
            "x"
        )


        if (
            lat is None
            or
            lon is None
        ):

            return jsonify({

                "error":
                    "Invalid coordinates"

            }), 404


        return jsonify({

            "lat":
                float(lat),

            "lon":
                float(lon),

            "display_name":
                candidate.get(
                    "address",
                    text
                )

        })


    except Exception as e:

        print(
            "Geocode resolve error:",
            e
        )

        return jsonify({

            "error":
                "Geocoding failed"

        }), 502


# ============================================================
# CURRENT AQI POINTS
# ============================================================

@app.route("/aqi_points")
def aqi_points():

    try:

        points = get_latest_points()

        return jsonify(
            points
        )

    except Exception as e:

        print(
            "AQI points error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# FUTURE AQI POINTS
# ============================================================

@app.route("/future_aqi_points")
def future_aqi_points():

    try:

        points = get_predicted_points()

        return jsonify(
            points
        )

    except Exception as e:

        print(
            "Future AQI points error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# CURRENT HEATMAP
# ============================================================

@app.route("/heatmap")
def heatmap():

    try:

        result = generate_heatmap()

        return jsonify(
            result
        )

    except Exception as e:

        print(
            "Heatmap error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# FUTURE HEATMAP
# ============================================================

@app.route("/future_heatmap")
def future_heatmap():

    try:

        result = (
            generate_future_heatmap()
        )

        return jsonify(
            result
        )

    except Exception as e:

        print(
            "Future heatmap error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# AQI ESTIMATE
# ============================================================

@app.route(
    "/estimate/<lat>/<lon>"
)
def estimate(
    lat,
    lon
):

    try:

        latitude = float(
            lat
        )

        longitude = float(
            lon
        )


        result = estimate_aqi(
            latitude,
            longitude
        )


        return jsonify(
            result
        )


    except Exception as e:

        print(
            "Estimate error:",
            e
        )

        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# ROUTE AQI HELPERS
# ============================================================

def _get_point_lat(point):

    for key in [
        "lat",
        "latitude",
        "y"
    ]:

        value = point.get(
            key
        )

        if value is not None:

            try:

                return float(
                    value
                )

            except (
                TypeError,
                ValueError
            ):

                pass

    return None


def _get_point_lon(point):

    for key in [
        "lon",
        "lng",
        "longitude",
        "x"
    ]:

        value = point.get(
            key
        )

        if value is not None:

            try:

                return float(
                    value
                )

            except (
                TypeError,
                ValueError
            ):

                pass

    return None


def _get_point_aqi(
    point,
    future=False
):

    if future:

        keys = [

            "predicted_aqi",

            "forecast_aqi",

            "future_aqi",

            "aqi_predicted",

            "aqi_forecast",

            "aqi"

        ]

    else:

        keys = [

            "aqi",

            "aqi_calibrated",

            "AQI",

            "aqi_value"

        ]


    for key in keys:

        value = point.get(
            key
        )

        if value is not None:

            try:

                value = float(
                    value
                )

                if math.isfinite(
                    value
                ):

                    return value

            except (
                TypeError,
                ValueError
            ):

                pass


    return None


def _haversine_distance(
    lat1,
    lon1,
    lat2,
    lon2
):

    R = 6371000.0


    dlat = math.radians(
        lat2 - lat1
    )

    dlon = math.radians(
        lon2 - lon1
    )


    a = (

        math.sin(
            dlat / 2
        ) ** 2

        +

        math.cos(
            math.radians(lat1)
        )

        *

        math.cos(
            math.radians(lat2)
        )

        *

        math.sin(
            dlon / 2
        ) ** 2

    )


    return (

        R

        *

        2

        *

        math.atan2(

            math.sqrt(a),

            math.sqrt(
                1 - a
            )

        )

    )


def _interpolate_route_aqi(
    route,
    points,
    future=False
):

    if not route:

        return None


    if not points:

        return None


    stations = []


    for point in points:

        lat = _get_point_lat(
            point
        )

        lon = _get_point_lon(
            point
        )

        aqi = _get_point_aqi(
            point,
            future=future
        )


        if (
            lat is None
            or
            lon is None
            or
            aqi is None
        ):

            continue


        stations.append(
            (
                lat,
                lon,
                aqi
            )
        )


    if not stations:

        return None


    route_aqi_values = []


    # Sample the route so a long OSRM route
    # does not cause thousands of calculations.

    step = max(
        1,
        len(route) // 80
    )


    sampled_route = list(
        route[::step]
    )


    if (
        route
        and
        sampled_route
        and
        sampled_route[-1]
        != route[-1]
    ):

        sampled_route.append(
            route[-1]
        )


    for coordinate in sampled_route:

        if (
            not isinstance(
                coordinate,
                (list, tuple)
            )
            or
            len(coordinate) < 2
        ):

            continue


        try:

            route_lat = float(
                coordinate[0]
            )

            route_lon = float(
                coordinate[1]
            )

        except (
            TypeError,
            ValueError
        ):

            continue


        nearby = []


        for (
            station_lat,
            station_lon,
            station_aqi
        ) in stations:

            distance = (
                _haversine_distance(
                    route_lat,
                    route_lon,
                    station_lat,
                    station_lon
                )
            )


            nearby.append(
                (
                    distance,
                    station_aqi
                )
            )


        nearby.sort(
            key=lambda x: x[0]
        )


        # Use the nearest 8 AQI stations.

        nearby = nearby[:8]


        if not nearby:

            continue


        # If the route passes essentially
        # through a station, use that AQI.

        if nearby[0][0] < 1:

            interpolated_aqi = (
                nearby[0][1]
            )

        else:

            numerator = 0.0

            denominator = 0.0


            for (
                distance,
                station_aqi
            ) in nearby:

                # Ignore stations more than
                # 30 km away.

                if distance > 30000:

                    continue


                # IDW weighting.

                weight = 1.0 / (
                    distance ** 2
                    +
                    1.0
                )


                numerator += (
                    station_aqi
                    *
                    weight
                )


                denominator += weight


            if denominator <= 0:

                continue


            interpolated_aqi = (
                numerator
                /
                denominator
            )


        if math.isfinite(
            interpolated_aqi
        ):

            route_aqi_values.append(
                interpolated_aqi
            )


    if not route_aqi_values:

        return None


    average_aqi = (
        sum(route_aqi_values)
        /
        len(route_aqi_values)
    )


    maximum_aqi = max(
        route_aqi_values
    )


    return {

        "average_aqi":
            round(
                average_aqi,
                2
            ),

        "max_aqi":
            round(
                maximum_aqi,
                2
            )

    }


def _aqi_category(aqi):

    try:

        aqi = float(
            aqi
        )

    except (
        TypeError,
        ValueError
    ):

        return "Unknown"


    if aqi <= 50:

        return "Good"


    if aqi <= 100:

        return "Satisfactory"


    if aqi <= 150:

        return "Moderate"


    if aqi <= 200:

        return "Poor"


    if aqi <= 300:

        return "Very Poor"


    return "Severe"


def _calculate_route_aqi_fallback(
    route,
    travel_time,
    future=False
):

    try:

        if future:

            points = (
                get_predicted_points()
            )

        else:

            points = (
                get_latest_points()
            )


        result = (
            _interpolate_route_aqi(
                route,
                points,
                future=future
            )
        )


        if result is None:

            return {

                "average_aqi": 0,

                "max_aqi": 0,

                "exposure_score": 0,

                "category":
                    "Unknown"

            }


        average_aqi = float(
            result[
                "average_aqi"
            ]
        )


        max_aqi = float(
            result[
                "max_aqi"
            ]
        )


        try:

            travel_time = float(
                travel_time
            )

        except (
            TypeError,
            ValueError
        ):

            travel_time = 0


        # AQI exposure score.

        exposure_score = (
            average_aqi
            *
            travel_time
        )


        return {

            "average_aqi":
                round(
                    average_aqi,
                    2
                ),

            "max_aqi":
                round(
                    max_aqi,
                    2
                ),

            "exposure_score":
                round(
                    exposure_score,
                    2
                ),

            "category":
                _aqi_category(
                    average_aqi
                )

        }


    except Exception as e:

        print(
            "Route AQI fallback error:",
            e
        )


        return {

            "average_aqi": 0,

            "max_aqi": 0,

            "exposure_score": 0,

            "category":
                "Unknown"

        }


# ============================================================
# CURRENT ROUTE AQI
# ============================================================

@app.route(
    "/route_aqi",
    methods=["POST"]
)
def route_aqi():

    try:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )


        route = data.get(
            "route",
            []
        )


        travel_time = data.get(
            "travel_time",
            0
        )


        if (
            not isinstance(
                route,
                list
            )
            or
            len(route) < 2
        ):

            return jsonify({

                "average_aqi": 0,

                "max_aqi": 0,

                "exposure_score": 0,

                "category":
                    "Unknown"

            })


        result = (
            _calculate_route_aqi_fallback(
                route,
                travel_time,
                future=False
            )
        )


        print(
            "Current route AQI:",
            result
        )


        return jsonify(
            result
        )


    except Exception as e:

        print(
            "Route AQI endpoint error:",
            e
        )


        return jsonify({

            "average_aqi": 0,

            "max_aqi": 0,

            "exposure_score": 0,

            "category":
                "Unknown",

            "error":
                str(e)

        }), 500


# ============================================================
# FUTURE ROUTE AQI
# ============================================================

@app.route(
    "/future_route_aqi",
    methods=["POST"]
)
def future_route_aqi():

    try:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )


        route = data.get(
            "route",
            []
        )


        travel_time = data.get(
            "travel_time",
            0
        )


        if (
            not isinstance(
                route,
                list
            )
            or
            len(route) < 2
        ):

            return jsonify({

                "average_aqi": 0,

                "max_aqi": 0,

                "exposure_score": 0,

                "category":
                    "Unknown"

            })


        result = (
            _calculate_route_aqi_fallback(
                route,
                travel_time,
                future=True
            )
        )


        print(
            "Future route AQI:",
            result
        )


        return jsonify(
            result
        )


    except Exception as e:

        print(
            "Future route AQI endpoint error:",
            e
        )


        return jsonify({

            "average_aqi": 0,

            "max_aqi": 0,

            "exposure_score": 0,

            "category":
                "Unknown",

            "error":
                str(e)

        }), 500


# ============================================================
# ROUTE SEGMENTS
# ============================================================

@app.route(
    "/route_segments",
    methods=["POST"]
)
def route_segments():

    try:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )


        route = data.get(
            "route",
            []
        )


        if (
            not isinstance(
                route,
                list
            )
            or
            len(route) < 2
        ):

            return jsonify([])


        result = (
            calculate_route_segments(
                route
            )
        )


        return jsonify(
            result
        )


    except Exception as e:

        print(
            "Route segments error:",
            e
        )


        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# HEATMAP BY HOUR
# ============================================================

@app.route(
    "/heatmap_hour/<int:hour>"
)
def heatmap_hour(hour):

    try:

        df = get_all_history()


        if df is None:

            return jsonify([])


        if df.empty:

            return jsonify([])


        df = df.copy()


        df[
            "timestamp"
        ] = datetime.now(
            timezone.utc
        ) if False else df[
            "timestamp"
        ]


        try:

            timestamps = (
                __import__(
                    "pandas"
                )
                .to_datetime(
                    df["timestamp"],
                    errors="coerce"
                )
            )

            df = df[
                timestamps.dt.hour
                ==
                hour
            ]

        except Exception as e:

            print(
                "Hour filtering error:",
                e
            )


        return jsonify(
            df.to_dict(
                "records"
            )
        )


    except Exception as e:

        print(
            "Heatmap hour error:",
            e
        )


        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# RANKING
# ============================================================

@app.route("/ranking")
def ranking():

    try:

        points = get_latest_points()


        if not points:

            return jsonify({

                "cleanest": [],

                "polluted": []

            })


        valid_points = []


        for point in points:

            try:

                aqi = float(
                    point.get(
                        "aqi",
                        point.get(
                            "aqi_calibrated",
                            0
                        )
                    )
                )

                point_copy = dict(
                    point
                )

                point_copy[
                    "aqi"
                ] = aqi

                valid_points.append(
                    point_copy
                )

            except (
                TypeError,
                ValueError
            ):

                continue


        valid_points.sort(
            key=lambda x:
                x["aqi"]
        )


        cleanest = (
            valid_points[:3]
        )


        polluted = (
            valid_points[-3:]
        )


        polluted.reverse()


        return jsonify({

            "cleanest":
                cleanest,

            "polluted":
                polluted

        })


    except Exception as e:

        print(
            "Ranking error:",
            e
        )


        return jsonify({

            "cleanest": [],

            "polluted": [],

            "error":
                str(e)

        }), 500


# ============================================================
# STATION HISTORY
# ============================================================

@app.route(
    "/station_history/<device>"
)
def station_history(device):

    try:

        # Keep the original working source:
        # latest_dataframe rather than all_history.

        df = (
            get_latest_dataframe()
        )


        if df is None:

            return jsonify([])


        df = df[
            df["device_id"]
            ==
            device
        ]


        df = df.sort_values(
            "timestamp"
        )


        return jsonify(

            df[
                [
                    "timestamp",
                    "aqi_calibrated"
                ]
            ]
            .tail(24)
            .to_dict(
                "records"
            )

        )


    except Exception as e:

        print(
            "Station history error:",
            e
        )


        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# HISTORY
# ============================================================

@app.route("/history")
def history():

    try:

        result = get_history()

        return jsonify(
            result
        )

    except Exception as e:

        print(
            "History error:",
            e
        )


        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# AI DASHBOARD
# ============================================================

@app.route("/ai_dashboard")
def ai_dashboard():

    try:

        return render_template(
            "ai_dashboard.html"
        )

    except Exception as e:

        print(
            "AI dashboard error:",
            e
        )


        return jsonify({

            "error":
                str(e)

        }), 500


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.route("/system_status")
def system_status():

    try:

        return jsonify({

            "status":
                "online",

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat()

        })

    except Exception as e:

        return jsonify({

            "status":
                "error",

            "error":
                str(e)

        }), 500


# ============================================================
# STATION PREDICTION STATUS
# ============================================================

@app.route(
    "/station_prediction_status"
)
def station_prediction_status():

    try:

        points = (
            get_predicted_points()
        )


        return jsonify({

            "status":
                "available",

            "count":
                len(points)
                if points
                else 0

        })


    except Exception as e:

        print(
            "Station prediction status error:",
            e
        )


        return jsonify({

            "status":
                "unavailable",

            "count":
                0

        })


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )
