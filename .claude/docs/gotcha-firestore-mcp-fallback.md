---
name: gotcha-firestore-mcp-fallback
description: Si los MCP firestore-dev/prod no cargan (falta ./toolbox), inspeccionar Firestore vía REST API con token ADC de gcloud
metadata:
  type: reference
---

`.mcp.json` declara `firestore-dev` (mirada-dev-22100) y `firestore-prod` (mirada-fs1) ejecutando `./toolbox --prebuilt firestore --stdio`. **El binario `./toolbox` no está en el repo** (no versionado), así que en sesiones donde falta, los MCP no cargan y `ToolSearch` no encuentra `firestore_*`.

Fallback que funciona — REST API con Application Default Credentials:

```bash
TOKEN=$(gcloud auth application-default print-access-token)
BASE="https://firestore.googleapis.com/v1/projects/mirada-fs1/databases/(default)/documents"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/<path>"                    # get/list
curl -s -X POST ... -d '{"structuredQuery":{...}}' "$BASE/<parent>:runQuery" # query
```

Notas:
- `gcloud auth print-access-token` falla (proyecto activo `n8nmanager-800d7`); usar la variante **`application-default`**.
- El REST API **sí soporta collection group queries** (`from:[{collectionId,allDescendants:true}]` con parent arbitrario), a diferencia del MCP. Muy útil para `servicesRequest`.
- **`:listCollectionIds` regresa `[]` con falsos negativos** — devolvió vacío para docs que sí tenían `checkListAnswers` con 25 documentos. No confiar en él; consultar la subcolección directamente.
- Requiere `dangerouslyDisableSandbox: true` en Bash (red).
