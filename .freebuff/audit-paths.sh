# Public page smoke: every route returns the SPA shell (200) and no obvious JS error
for p in / /about /services /barbers /gallery /booking /book /reviews /contact /login /register /nonexistent-404-probe; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 6 "http://localhost:5173$p")
  echo "$p -> $code"
done
