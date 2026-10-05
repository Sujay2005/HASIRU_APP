from flask import Flask, render_template, jsonify, request

from services.prediction import get_predicted_points

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

from services.estimate import estimate_aqi

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from datetime import datetime, timezone

import pandas as pd


app = Flask(__name__)


# ============================================================
# LOCAL BENGALURU SEARCH DATABASE
# ============================================================

LOCAL_PLACES = [

    {
        "name": "RNS Institute of Technology",
        "aliases": [
            "rns",
            "rnsit",
            "rns institute",
            "rns institute of technology",
            "rnsit bangalore"
        ],
        "lat": 12.9078,
        "lon": 77.5183
    },

    {
        "name": "RV College of Engineering",
        "aliases": [
            "rvc",
            "rvce",
            "rv college",
            "rv college of engineering",
            "rv engineering college"
        ],
        "lat": 12.9237,
        "lon": 77.4987
    },

    {
        "name": "PES University",
        "aliases": [
            "pes",
            "pes university",
            "pes university ring road",
            "pesit"
        ],
        "lat": 12.9346,
        "lon": 77.5347
    },

    {
        "name": "Indian Institute of Science",
        "aliases": [
            "iisc",
            "iisc bangalore",
            "indian institute of science"
        ],
        "lat": 13.0219,
        "lon": 77.5671
    },

    {
        "name": "BMS College of Engineering",
        "aliases": [
            "bms",
            "bmsce",
            "bms college",
            "bms college of engineering"
        ],
        "lat": 12.9416,
        "lon": 77.5656
    },

    {
        "name": "Bangalore Institute of Technology",
        "aliases": [
            "bit",
            "bit bangalore",
            "bangalore institute of technology"
        ],
        "lat": 12.9560,
        "lon": 77.5747
    },

    {
        "name": "R.V. Institute of Technology and Management",
        "aliases": [
            "rvitm",
            "rv institute of technology",
            "rvitm bangalore"
        ],
        "lat": 12.8975,
        "lon": 77.5106
    },

    {
        "name": "Kempegowda International Airport",
        "aliases": [
            "kempegowda airport",
            "blr airport",
            "bangalore airport",
            "bengaluru airport",
            "airport"
        ],
        "lat": 13.1986,
        "lon": 77.7066
    },

    {
        "name": "Bangalore Palace",
        "aliases": [
            "bangalore palace",
            "bengaluru palace"
        ],
        "lat": 12.9987,
        "lon": 77.5920
    },

    {
        "name": "Cubbon Park",
        "aliases": [
            "cubbon",
            "cubbon park"
        ],
        "lat": 12.9763,
        "lon": 77.5929
    },

    {
        "name": "Lalbagh Botanical Garden",
        "aliases": [
            "lalbagh",
            "lal bagh",
            "lalbagh botanical garden"
        ],
        "lat": 12.9507,
        "lon": 77.5848
    },

    {
        "name": "Vidhana Soudha",
        "aliases": [
            "vidhana soudha",
            "vidhan soudha"
        ],
        "lat": 12.9797,
        "lon": 77.5908
    },

    {
        "name": "Majestic",
        "aliases": [
            "majestic",
            "kempegowda bus station",
            "kempegowda bus stand"
        ],
        "lat": 12.9767,
        "lon": 77.5713
    },

    {
        "name": "Electronic City",
        "aliases": [
            "electronic city",
            "electronic city bangalore"
        ],
        "lat": 12.8452,
        "lon": 77.6602
    },

    {
        "name": "Whitefield",
        "aliases": [
            "whitefield",
            "whitefield bangalore"
        ],
        "lat": 12.9698,
        "lon": 77.7500
    },

    {
        "name": "Koramangala",
        "aliases": [
            "koramangala",
            "koramangala bangalore"
        ],
        "lat": 12.9352,
        "lon": 77.6245
    },

    {
        "name": "Indiranagar",
        "aliases": [
            "indiranagar",
            "indiranagar bangalore"
        ],
        "lat": 12.9784,
        "lon": 77.6408
    },

    {
        "name": "MG Road",
        "aliases": [
            "mg road",
            "mg road bangalore",
            "mahatma gandhi road"
        ],
        "lat": 12.9756,
        "lon": 77.6060
    },

    {
        "name": "Yeshwanthpur",
        "aliases": [
            "yeshwanthpur",
            "yeshwanthpur bangalore"
        ],
        "lat": 13.0280,
        "lon": 77.5407
    },

    {
        "name": "Jayanagar",
        "aliases": [
            "jayanagar",
            "jayanagar bangalore"
        ],
        "lat": 12.9250,
        "lon": 77.5938
    },

    {
        "name": "Banashankari",
        "aliases": [
            "banashankari",
            "banashankari bangalore"
        ],
        "lat": 12.9255,
        "lon": 77.5468
    },

    {
        "name": "Marathahalli",
        "aliases": [
            "marathahalli",
            "marathahalli bangalore"
        ],
        "lat": 12.9591,
        "lon": 77.6974
    },

    {
        "name": "Hebbal",
        "aliases": [
            "hebbal",
            "hebbal bangalore"
        ],
        "lat": 13.0358,
        "lon": 77.5970
    },

    {
        "name": "BTM Layout",
        "aliases": [
            "btm",
            "btm layout",
            "btm layout bangalore"
        ],
        "lat": 12.9166,
        "lon": 77.6101
    },

    {
        "name": "HSR Layout",
        "aliases": [
            "hsr",
            "hsr layout",
            "hsr layout bangalore"
        ],
        "lat": 12.9116,
        "lon": 77.6389
    },

    {
        "name": "Rajajinagar",
        "aliases": [
            "rajajinagar",
            "rajajinagar bangalore"
        ],
        "lat": 12.9910,
        "lon": 77.5530
    },

    {
        "name": "Bangalore University",
        "aliases": [
            "bangalore university",
            "bengaluru university"
        ],
        "lat": 12.9416,
        "lon": 77.5013
    }
]


# ============================================================
# LOCAL SEARCH
# ============================================================

def local_search(query):

    query = query.strip().lower()

    if not query:
        return []

    results = []

    for place in LOCAL_PLACES:

        name = place["name"].lower()

        aliases = [
            alias.lower()
            for alias in place["aliases"]
        ]

        score = 0

        if query == name:
            score = 100

        elif query in aliases:
            score = 95

        elif name.startswith(query):
            score = 90

        elif any(
            alias.startswith(query)
            for alias in aliases
        ):
            score = 85

        elif query in name:
            score = 75

        elif any(
            query in alias
            for alias in aliases
        ):
            score = 70

        if score > 0:

            results.append({
                "display_name":
                    place["name"] +
                    ", Bengaluru, Karnataka, India",

                "lat":
                    place["lat"],

                "lon":
                    place["lon"],

                "source":
                    "local",

                "_score":
                    score
            })

    results.sort(
        key=lambda x: x["_score"],
        reverse=True
    )

    for result in results:
        result.pop("_score", None)

    return results[:5]


# ============================================================
# ARC GIS SEARCH
# ============================================================

def arcgis_search(query, limit=5):

    params = urlencode({

        "SingleLine":
            query,

        "f":
            "json",

        "maxLocations":
            limit,

        "outFields":
            "*",

        "countryCode":
            "IND",

        "searchExtent":
            "77.30,12.75,77.90,13.25",

        "location":
            "77.5946,12.9716"
    })

    url = (
        "https://geocode.arcgis.com/"
        "arcgis/rest/services/World/GeocodeServer/"
        "findAddressCandidates?"
        + params
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
        timeout=6
    ) as response:

        data = json.loads(
            response.read().decode(
                "utf-8"
            )
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

        lat = location.get("y")
        lon = location.get("x")

        if (
            lat is None or
            lon is None
        ):
            continue

        results.append({

            "display_name":
                candidate.get(
                    "address",
                    query
                ),

            "lat":
                lat,

            "lon":
                lon,

            "source":
                "arcgis"
        })

    return results[:limit]


# ============================================================
# AUTOCOMPLETE
# ============================================================

@app.route("/autocomplete")
def autocomplete():

    query = request.args.get(
        "q",
        ""
    ).strip()

    if len(query) < 2:
        return jsonify([])

    try:

        local_results = local_search(
            query
        )

        arcgis_results = arcgis_search(
            query,
            5
        )

        results = []

        results.extend(
            local_results
        )

        existing = {
            (
                round(
                    float(x["lat"]),
                    5
                ),
                round(
                    float(x["lon"]),
                    5
                )
            )
            for x in local_results
        }

        for result in arcgis_results:

            key = (
                round(
                    float(result["lat"]),
                    5
                ),
                round(
                    float(result["lon"]),
                    5
                )
            )

            if key not in existing:

                results.append(
                    result
                )

                existing.add(key)

            if len(results) >= 5:
                break

        return jsonify(
            results[:5]
        )

    except Exception as e:

        print(
            "Autocomplete error:",
            e
        )

        local_results = local_search(
            query
        )

        if local_results:
            return jsonify(
                local_results
            )

        return jsonify([])


# ============================================================
# GEOCODE
# Used by routing.js
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

        local_results = local_search(
            query
        )

        if local_results:
            return jsonify(
                local_results
            )

        results = arcgis_search(
            query,
            5
        )

        return jsonify(results)

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
# HOME
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# AQI POINTS
# ============================================================

@app.route("/aqi_points")
def aqi_points():

    return jsonify(
        get_latest_points()
    )


# ============================================================
# FUTURE AQI POINTS
# ============================================================

@app.route("/future_aqi_points")
def future_aqi_points():

    return jsonify(
        get_predicted_points()
    )


# ============================================================
# HEATMAP
# ============================================================

@app.route("/heatmap")
def heatmap():

    return jsonify(
        generate_heatmap()
    )


# ============================================================
# FUTURE HEATMAP
# ============================================================

@app.route("/future_heatmap")
def future_heatmap():

    return jsonify(
        generate_future_heatmap()
    )


# ============================================================
# ESTIMATE AQI
# ============================================================

@app.route(
    "/estimate/<lat>/<lon>"
)
def estimate(lat, lon):

    try:

        lat = float(lat)
        lon = float(lon)

        return jsonify(
            estimate_aqi(
                lat,
                lon
            )
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
# ROUTE AQI
# ============================================================

@app.route(
    "/route_aqi",
    methods=["POST"]
)
def route_aqi():

    try:

        data = request.get_json()

        route = data["route"]

        travel_time = float(
            data["travel_time"]
        )

        return jsonify(
            calculate_route(
                route,
                travel_time
            )
        )

    except Exception as e:

        print(
            "Route AQI error:",
            e
        )

        return jsonify({
            "average_aqi": 0,
            "max_aqi": 0,
            "exposure_score": 0,
            "category": "Unknown",
            "error": str(e)
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

        data = request.get_json()

        route = data["route"]

        travel_time = float(
            data["travel_time"]
        )

        return jsonify(
            calculate_future_route(
                route,
                travel_time
            )
        )

    except Exception as e:

        print(
            "Future route AQI error:",
            e
        )

        return jsonify({
            "average_aqi": 0,
            "max_aqi": 0,
            "exposure_score": 0,
            "category": "Unknown",
            "error": str(e)
        }), 500


# ============================================================
# ROUTE SEGMENTS
# ============================================================

@app.route(
    "/route_segments",
    methods=["POST"]
)
def route_segments():

    data = request.get_json()

    return jsonify(
        calculate_route_segments(data)
    )


# ============================================================
# RANKING
# ============================================================

@app.route("/ranking")
def ranking():

    try:

        points = get_latest_points()

        valid_points = []

        for point in points:

            try:

                aqi = float(
                    point.get(
                        "aqi",
                        point.get(
                            "aqi_calibrated"
                        )
                    )
                )

                if pd.notna(aqi):

                    point = dict(point)

                    point["aqi"] = aqi

                    valid_points.append(
                        point
                    )

            except (
                TypeError,
                ValueError
            ):

                continue


        # Lowest AQI first
        clean = sorted(
            valid_points,
            key=lambda x:
                x["aqi"]
        )[:3]


        # Highest AQI first
        polluted = sorted(
            valid_points,
            key=lambda x:
                x["aqi"],
            reverse=True
        )[:3]


        # IMPORTANT:
        # Frontend expects "clean".
        return jsonify({

            "clean":
                clean,

            "polluted":
                polluted
        })


    except Exception as e:

        print(
            "Ranking error:",
            e
        )

        return jsonify({
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

        print(
            "Loading station history:",
            device
        )


        # ----------------------------------------------------
        # FIRST: use the actual historical data
        # ----------------------------------------------------

        try:

            df = get_all_history()

            print(
                "get_all_history rows:",
                len(df)
            )

            if (
                df is not None and
                not df.empty
            ):

                if "device_id" in df.columns:

                    df = df[
                        df["device_id"].astype(str)
                        == str(device)
                    ]


                if not df.empty:

                    if "timestamp" in df.columns:

                        df["timestamp"] = (
                            pd.to_datetime(
                                df["timestamp"],
                                errors="coerce"
                            )
                        )

                        df = df.dropna(
                            subset=[
                                "timestamp"
                            ]
                        )

                        df = df.sort_values(
                            "timestamp"
                        )


                    # Return the history needed
                    # by the Trends page.
                    if (
                        "aqi_calibrated"
                        in df.columns
                    ):

                        result = df[
                            [
                                "timestamp",
                                "aqi_calibrated"
                            ]
                        ].copy()

                        result = result.dropna(
                            subset=[
                                "aqi_calibrated"
                            ]
                        )

                        result = result.tail(
                            500
                        )

                        result["timestamp"] = (
                            result["timestamp"]
                            .astype(str)
                        )

                        result[
                            "aqi_calibrated"
                        ] = pd.to_numeric(
                            result[
                                "aqi_calibrated"
                            ],
                            errors="coerce"
                        )

                        result = result.dropna(
                            subset=[
                                "aqi_calibrated"
                            ]
                        )

                        print(
                            "Returning historical rows:",
                            len(result)
                        )

                        return jsonify(
                            result.to_dict(
                                "records"
                            )
                        )

        except Exception as history_error:

            print(
                "Historical dataframe error:",
                history_error
            )


        # ----------------------------------------------------
        # SECOND FALLBACK: get_history(device)
        # ----------------------------------------------------

        try:

            history = get_history(
                device
            )

            if history is not None:

                if isinstance(
                    history,
                    pd.DataFrame
                ):

                    df = history.copy()

                    if not df.empty:

                        if "timestamp" in df.columns:

                            df["timestamp"] = (
                                pd.to_datetime(
                                    df["timestamp"],
                                    errors="coerce"
                                )
                            )

                            df = df.sort_values(
                                "timestamp"
                            )


                        if (
                            "aqi_calibrated"
                            in df.columns
                        ):

                            result = df[
                                [
                                    "timestamp",
                                    "aqi_calibrated"
                                ]
                            ].tail(500)

                            result[
                                "timestamp"
                            ] = result[
                                "timestamp"
                            ].astype(str)

                            return jsonify(
                                result.to_dict(
                                    "records"
                                )
                            )


                elif isinstance(
                    history,
                    list
                ):

                    return jsonify(
                        history[-500:]
                    )

        except Exception as history_error:

            print(
                "get_history error:",
                history_error
            )


        # ----------------------------------------------------
        # FINAL FALLBACK: latest dataframe
        # ----------------------------------------------------

        print(
            "Using latest dataframe fallback"
        )

        df = get_latest_dataframe()

        if df is None or df.empty:

            return jsonify([])


        df = df[
            df["device_id"].astype(str)
            == str(device)
        ]


        if df.empty:

            return jsonify([])


        df = df.sort_values(
            "timestamp"
        )


        result = df[
            [
                "timestamp",
                "aqi_calibrated"
            ]
        ].tail(24)


        result["timestamp"] = (
            result["timestamp"]
            .astype(str)
        )


        return jsonify(
            result.to_dict(
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
# HEATMAP BY HOUR
# ============================================================

@app.route(
    "/heatmap_hour/<int:hour>"
)
def heatmap_hour(hour):

    try:

        df = get_all_history()

        df["timestamp"] = (
            pd.to_datetime(
                df["timestamp"],
                errors="coerce"
            )
        )

        filtered = df[
            df["timestamp"].dt.hour
            == hour
        ]

        return jsonify(
            filtered.to_dict(
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
# AI DASHBOARD
# ============================================================

@app.route("/ai_dashboard")
def ai_dashboard():

    return jsonify({
        "status":
            "ok"
    })


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.route("/system_status")
def system_status():

    return jsonify({

        "status":
            "online",

        "timestamp":
            datetime.now(
                timezone.utc
            ).isoformat()
    })


# ============================================================
# STATION PREDICTION STATUS
# ============================================================

@app.route(
    "/station_prediction_status"
)
def station_prediction_status():

    try:

        points = get_predicted_points()

        return jsonify({

            "status":
                "ok",

            "count":
                len(points)
        })

    except Exception as e:

        print(
            "Prediction status error:",
            e
        )

        return jsonify({

            "status":
                "error",

            "error":
                str(e)
        }), 500


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )
