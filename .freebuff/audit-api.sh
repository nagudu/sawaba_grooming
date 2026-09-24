# Public API smoke: pages must be backed by real data
B=http://localhost:5000/api
for ep in "/services" "/barbers" "/gallery" "/reviews?approved=true" "/settings/payment" "/availability?barberId=1&date=2026-09-24&serviceId=1"; do
  out=$(curl -s -m 6 "$B$ep")
  ok=$(echo "$out" | head -c 60)
  echo "== $ep => ${ok}"
done
