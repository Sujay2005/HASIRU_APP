import joblib
import pandas as pd
from datetime import datetime

from config import MODEL_PATH
from services.api_service import get_latest_dataframe

model = joblib.load(MODEL_PATH)


def get_predicted_points():

    df = get_latest_dataframe()

    latest = df[
        df["device_id"] != "esp32_1"
    ]

    print("\n=========================")
    print("Latest Timestamp")
    print(latest["timestamp"].max())
    print("=========================\n")

    device_mapping = {
        device: i
        for i, device in enumerate(
            sorted(latest["device_id"].unique())
        )
    }

    predicted_points = []

    for _, row in latest.iterrows():

        current_time = datetime.now()

        X = pd.DataFrame([{
            "device_code": device_mapping[row["device_id"]],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "hour": current_time.hour,
            "day": current_time.day,
            "month": current_time.month,
            "prev_aqi": row["aqi_calibrated"]
        }])

        predicted_aqi = model.predict(X)[0]

        predicted_points.append({
            "device": row["device_id"],
            "lat": float(row["latitude"]),
            "lon": float(row["longitude"]),
            "aqi": float(predicted_aqi)
        })

    return predicted_points