# Realtime Database layout

The dashboard reads (R) and writes (W) these paths. `ts` is always Firebase
server time in ms (`{".sv": "timestamp"}` from the gateway, `serverTimestamp()`
from the dashboard). Anything the gateway does not write yet shows as "No data"
on the dashboard.

| Path | Who writes | Dashboard | Shape |
|---|---|---|---|
| `latest/node1` | gateway (exists) | R | `{node, seq, ts, ph, water_temp, turbidity, tds, *_ok, rx, lost}` – a missing sensor is omitted |
| `latest/gateway` | gateway (exists) | R | `{ts, air_temp, humidity, pressure, lux, distance_mm, rssi, uptime_s}` |
| `readings/{id}/{push}` | gateway (exists) | R (fallback) | same as `latest/{id}`; dashboard loads only the last 2000 |
| `hourly/{id}/{YYYYMMDDHH}` | gateway (todo) | R | `{ts, ph, water_temp, tds, turbidity}` hourly averages – lets the chart show 7 days cheaply |
| `forecast/{metric}` | AI (todo, M4) | R | `{updated, model, limit, reach_at, points: [{ts, v}, …]}` – `metric` is `tds`, `ph`, `water_temp` or `turbidity` |
| `ai/status` | AI (todo, M4) | R | `{updated, anomaly: bool, summary?: string}` |
| `tanks` | gateway (todo) | R | `{fresh, waste, food}` in % full |
| `devices/{id}` | gateway (todo) | R | `{on: bool, note?: string, ts}` – ids: `filter, air, led, drain, refill, feeder` |
| `water_change` | gateway (todo) | R | `{running, step: "drain"\|"refill", last_at, last_pct}` |
| `feed_log/{push}` | gateway (todo) | R | `{ts, portions, by}` |
| `alerts/{push}` | gateway (todo, M6) | R | `{title, ts, level: "info"\|"warn"\|"crit", type, discord: bool}` |
| `settings/schedule` | you (Firebase console) | R | `{feed_times: ["08:00","18:00"], portions: 1, led_on: "08:00", led_off: "20:00"}` |
| `settings/alerts/{type}` | dashboard | R/W | `true`/`false` – types listed in `src/lib/config.ts` (`ALERT_TYPES`); missing = on |
| `control/estop` | dashboard | R/W | `{on: bool, by, ts}` – gateway must stop all pumps + feeder while `on` |
| `control/{device}` | dashboard | W | `{on: bool, by, ts}` – manual switch for `filter`, `air`, `led` |
| `commands/{push}` | dashboard | W | `{cmd: "feed"\|"water_change"\|"estop"\|"resume", by, ts}` – gateway runs it, then deletes it |

## Suggested rules

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "readings": { "$id": { ".indexOn": ["ts"] } }
  }
}
```
