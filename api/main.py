"""Fixed, read-only queries against InfluxDB 2.x. Never return upstream errors."""
import csv
import io
import json
import math
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

from fastapi import Depends, FastAPI, HTTPException, Request as APIRequest
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

UTC = timezone.utc
UNITS = {"nitrogen": "mg/kg", "phosphorus": "mg/kg", "potassium": "mg/kg",
         "temperature": "°C", "humidity": "%"}
DEVICES = [
    {"device_id": f"rs485-lb-0{i}", "node": f"npk-0{i}", "sensor_type": "npk"}
    for i in range(1, 4)
] + [{"device_id": "rak7431-byx-01", "node": "byx-01", "sensor_type": "byx"}]


def metrics(device):
    return list(UNITS)[:3] if device["sensor_type"] == "npk" else list(UNITS)[3:]


def stamp(value):
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class UpstreamError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    url: str
    org: str
    bucket: str
    token: str = field(repr=False)

    @classmethod
    def load(cls):
        values = [os.getenv(name, "").strip() for name in
                  ("INFLUXDB_URL", "INFLUXDB_ORG", "INFLUXDB_BUCKET", "INFLUXDB_TOKEN")]
        url = urlsplit(values[0])
        if (not all(values) or url.scheme not in ("http", "https") or not url.hostname
                or url.username or url.password or url.query or url.fragment
                or values[3] == "replace_with_bucket_read_only_token"):
            raise HTTPException(503, "API sin configurar")
        return cls(*values)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward Authorization to a redirected host.


class Influx:
    def __init__(self, settings):
        self.settings = settings

    def query(self, flux):
        config = self.settings
        request = Request(
            config.url.rstrip("/") + "/api/v2/query?" + urlencode({"org": config.org}),
            data=json.dumps({"query": flux, "type": "flux"}).encode(),
            headers={"Authorization": "Token " + config.token,
                     "Content-Type": "application/json", "Accept": "application/csv"},
            method="POST",
        )
        try:
            with build_opener(NoRedirect).open(request, timeout=5) as response:
                content = response.read(2_000_001)
            if len(content) > 2_000_000:
                raise ValueError("Response too large")
            rows, header = [], None
            for row in csv.reader(io.StringIO(content.decode("utf-8"))):
                if not row or row[0].startswith("#"):
                    continue
                if "_time" in row and "_value" in row:
                    header = row
                elif "error" in row:
                    raise ValueError("Query error")
                elif header:
                    if len(row) != len(header):
                        raise ValueError("Malformed CSV")
                    rows.append(dict(zip(header, row)))
                else:
                    raise ValueError("Unexpected CSV")
            return rows
        except Exception:
            raise UpstreamError from None

    def base(self, device, start, stop, fields):
        # Only server-owned identifiers enter these queries. JSON escapes strings.
        q = json.dumps
        sensor_type = "environment" if device["sensor_type"] == "byx" else "npk"
        predicates = [f'r._field == {q(name)}' for name in fields]
        return (f'from(bucket: {q(self.settings.bucket)})'
                f' |> range(start: {start}, stop: {stop})'
                ' |> filter(fn: (r) => r._measurement == "sensores")'
                f' |> filter(fn: (r) => r.device_id == {q(device["device_id"])}'
                f' and r.node == {q(device["node"])} and r.sensor_type == {q(sensor_type)})'
                f' |> filter(fn: (r) => {" or ".join(predicates)})')


def get_influx():
    return Influx(Settings.load())


def device_by_id(device_id):
    for device in DEVICES:
        if device["device_id"] == device_id:
            return device
    raise HTTPException(404, "Dispositivo desconocido")


def observations(rows, allowed, start, stop):
    result = []
    for row in rows:
        try:
            timestamp = datetime.fromisoformat(row["_time"].replace("Z", "+00:00"))
            value = float(row["_value"])
            if (timestamp.tzinfo is None or not math.isfinite(value) or value == -999
                    or row["_field"] not in allowed or not start <= timestamp < stop):
                continue
            result.append((timestamp, row["_field"], value))
        except (KeyError, ValueError, TypeError, OverflowError):
            continue
    return result


app = FastAPI(title="Sensado API", docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(UpstreamError)
async def upstream_error(request, exc):
    return JSONResponse({"detail": "InfluxDB no disponible o respuesta inválida"}, status_code=503)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({"detail": "Parámetros inválidos"}, status_code=422)


@app.middleware("http")
async def guard(request: APIRequest, call_next):
    if request.method != "GET":
        return JSONResponse({"detail": "Solo lectura"}, status_code=405)
    allowed = {"metric", "hours", "limit"} if request.url.path.endswith("/history") else set()
    keys = list(request.query_params.keys())
    if (set(keys) - allowed or any(len(request.query_params.getlist(k)) != 1 for k in keys)):
        return JSONResponse({"detail": "Parámetros inválidos"}, status_code=422)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    try:
        # Authenticated read checks both reachability and access to this bucket.
        influx = get_influx()
        influx.query(influx.base(DEVICES[0], "-1m", "now()", ["nitrogen"]) + ' |> limit(n: 1)')
        return {"api": "ok", "influxdb": "accessible"}
    except (HTTPException, UpstreamError):
        return JSONResponse({"api": "ok", "influxdb": "unavailable"}, status_code=503)


@app.get("/api/devices")
def devices():
    return {"schema_version": 1, "source": "real", "devices": DEVICES}


@app.get("/api/devices/{device_id}/latest")
def latest(device_id: str, device=Depends(device_by_id), influx=Depends(get_influx)):
    now = datetime.now(UTC)
    start = datetime(1970, 1, 1, tzinfo=UTC)
    # Last per field first keeps the response small. Only fields from the newest
    # actual timestamp are used: do not fill a partial uplink with older values.
    flux = influx.base(device, "0", f'time(v: "{stamp(now)}")', metrics(device))
    rows = observations(influx.query(flux + ' |> last() |> group(columns: ["_field"])'
                                    ' |> sort(columns: ["_time"]) |> last()'),
                        metrics(device), start, now)
    newest = max((r[0] for r in rows), default=None)
    values = {name: value for time, name, value in rows if time == newest}
    return {"schema_version": 1, "source": "real", **device,
            "timestamp": stamp(newest) if newest else None,
            "measurements": {name: {"value": values.get(name), "unit": UNITS[name]}
                             for name in metrics(device)}}


@app.get("/api/devices/{device_id}/history")
def history(device_id: str, metric: str, hours: int = 24, limit: int = 500,
            device=Depends(device_by_id), influx=Depends(get_influx)):
    if metric not in metrics(device) or hours not in (6, 24, 168) or not 1 <= limit <= 1000:
        raise HTTPException(422, "Parámetros de histórico inválidos")
    stop = datetime.now(UTC)
    start = stop - timedelta(hours=hours)
    # Last real observation per window, retaining its actual timestamp. Empty
    # windows disappear. At most limit+1 windows before the final global limit.
    seconds = math.ceil(hours * 3600 / limit)
    flux = influx.base(device, f'time(v: "{stamp(start)}")',
                       f'time(v: "{stamp(stop)}")', [metric])
    flux += (f' |> group(columns: ["_field"]) |> window(every: {seconds}s)'
             ' |> sort(columns: ["_time"]) |> last() |> group() |> sort(columns: ["_time"], desc: true)'
             f' |> limit(n: {limit})')
    rows = observations(influx.query(flux), [metric], start, stop)
    points = {stamp(time): value for time, _, value in sorted(rows)}
    return {"schema_version": 1, "source": "real", "device_id": device_id,
            "metric": metric, "unit": UNITS[metric], "from": stamp(start), "to": stamp(stop),
            "points": [{"timestamp": time, "value": value} for time, value in sorted(points.items())][-limit:]}
