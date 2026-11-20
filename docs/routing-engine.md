# Routing engine for live jobs (OSRM on the droplet)

Live jobs on the Vibe Map (bakkie, truck, tow truck) get their road route,
turn-by-turn steps and arrival time from our own routing engine. Until it is
running, the job map shows a dashed straight line and an estimated time, and
says so on screen.

The app asks it through `/api/route` and reads its address from `ROUTING_URL`.

## 1. Build South Africa's roads (once, then monthly)

Needs Docker and about 4 GB of free memory while it builds (about 2 GB to run).

```bash
sudo mkdir -p /srv/osrm && cd /srv/osrm
sudo curl -LO https://download.geofabrik.de/africa/south-africa-latest.osm.pbf
sudo docker run --rm -t -v /srv/osrm:/data ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-extract -p /opt/car.lua /data/south-africa-latest.osm.pbf
sudo docker run --rm -t -v /srv/osrm:/data ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-partition /data/south-africa-latest.osrm
sudo docker run --rm -t -v /srv/osrm:/data ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-customize /data/south-africa-latest.osrm
```

## 2. Run it, reachable only from the droplet itself

```bash
sudo docker run -d --name osrm --restart unless-stopped -p 127.0.0.1:5000:5000 \
  -v /srv/osrm:/data ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-routed --algorithm mld --max-table-size 1000 /data/south-africa-latest.osrm
```

Check it (Braamfontein to Sandton):

```bash
curl -s "http://127.0.0.1:5000/route/v1/driving/28.0305,-26.1929;28.0567,-26.1076?overview=false" | head -c 300
```

It should start with `{"code":"Ok"`.

## 3. Point the app at it

Add to the app's environment on the droplet and restart the app:

```
ROUTING_URL=http://127.0.0.1:5000
```

Then open `/api/route?fromLat=-26.1929&fromLon=28.0305&toLat=-26.1076&toLon=28.0567`
on the live site: `"source":"road"` means it is working.

## 4. Keep the roads fresh

Re-run step 1 once a month (new roads, closures), then `sudo docker restart osrm`.
