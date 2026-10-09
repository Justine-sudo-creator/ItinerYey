# ItinerYey — offline commute assistant

ItinerYey is a crowd-sourced guide to Philippine public transport (jeepney, bus, UV Express, LRT/MRT). Commuters post the routes they ride, other commuters verify them, and an A* planner combines legs from different posts into one trip.

**Hackathon build: it keeps working when the cloud is gone.** Signal drops in MRT tunnels, on provincial roads and when prepaid data runs out, so the app does all of the following on the laptop itself:

| Feature | Runs on | Cloud needed? |
|---|---|---|
| Taglish/English question → origin & destination | `qwen2.5:3b` via Ollama | No |
| Place lookup (SM North → North Avenue MRT, …) | Local stop index + aliases | No (replaces Nominatim) |
| Multi-vehicle route, fare, time | Existing A* engine on `data/offline/snapshot.json.gz` | No (Supabase optional) |
| Signboard photo → matching routes, fare, "dadaan ba sa …?" | `qwen2.5vl:3b` via Ollama | No |

The model only *understands* the question and *reads* signboards. Fares, stops and transfers always come from the planner, so the assistant cannot invent routes.

## Run the offline demo

```bash
# 1. Local models (one-time download, ~5 GB)
ollama serve &
ollama pull qwen2.5:3b
ollama pull qwen2.5vl:3b

# 2. App in offline mode (no Supabase keys needed)
npm install
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=offline-demo \
OFFLINE_MODE=1 npm run dev
```

Or simply `npm run demo` — builds once, serves on the local network and prints the URL for phones.

**On a phone:** turn on the laptop's hotspot (or join the same Wi-Fi), open the printed `http://<laptop-ip>:3000/ask`, and use *Take / upload photo* to scan a real signboard. Nothing leaves the laptop–phone link. *(Windows: allow Node.js through the firewall on "Private" networks when prompted.)*

Open http://localhost:3000/ask, then turn Wi-Fi off and try:

- `Paano pumunta sa SM North galing Cubao?`
- `Galing Recto papuntang Katipunan, magkano?`
- **Scan signboard** → *Try sample signboard* (or upload/take a photo of a real jeepney sign)

Environment overrides: `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL`, `ASSISTANT_REPHRASE=1` (let the LLM re-word directions; best with a 7B+ model).

## Offline route snapshot

`data/offline/snapshot.json.gz` ships with routes built from the [Sakay.ph GTFS feed](https://github.com/sakayph/gtfs) (1,717 routes). Rebuild it from your own Supabase data or a GTFS folder:

```bash
npx tsx scripts/build_offline_snapshot.ts               # from Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
npx tsx scripts/build_offline_snapshot.ts --gtfs ./gtfs  # from a GTFS feed
```

With Supabase configured, the planner uses live data and falls back to the snapshot automatically if Supabase can't be reached.

## Full (online) app

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, then `npm run dev`.
